import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { LocaleService } from '../../core/locale';
import { MONEY_LOOK } from './market-frame';
import type { MarketSkill } from './market-levels';
import { marketText, MarketMessageKey } from './market-messages';
import { Denomination, EURO, formatMoney } from './market-money';

/** The four films: paying coin by coin, enough?, counting up to what's left, adding a list. */
export type Film = 'pay' | 'enough' | 'left' | 'total';

export function filmFor(skill: MarketSkill): Film {
  switch (skill) {
    case 'coinByCoin':
    case 'notes':
      return 'pay';
    case 'enough':
    case 'spree':
      return 'enough';
    case 'left':
      return 'left';
    default:
      return 'total';
  }
}

/**
 * The made-up numbers of each film, in euros, and another set for when the turn on screen
 * uses the same price: a film must never show how to solve the question being asked.
 */
export const FILM_NUMBERS = {
  pay: [
    { price: 5, coins: [200, 200, 100] as Denomination[] },
    { price: 4, coins: [200, 100, 100] as Denomination[] },
  ],
  enough: [
    { purse: [500, 200] as Denomination[], yes: 6, no: 9 },
    { purse: [500, 200, 100] as Denomination[], yes: 7, no: 10 },
  ],
  left: [
    { price: 5, purse: 8 },
    { price: 6, purse: 9 },
  ],
  total: [
    { a: 3, b: 4 },
    { a: 2, b: 5 },
  ],
} as const;

/** Whether the turn on screen (prices in cents) would be answered by the usual film. */
export function filmClash(film: Film, prices: readonly number[]): boolean {
  const used = new Set(prices.map((price) => price / EURO));
  const usual = FILM_NUMBERS;
  switch (film) {
    case 'pay':
      return used.has(usual.pay[0].price);
    case 'enough':
      return used.has(usual.enough[0].yes) || used.has(usual.enough[0].no);
    case 'left':
      return used.has(usual.left[0].price);
    case 'total':
      return used.has(usual.total[0].a + usual.total[0].b);
  }
}

const STEPS: Record<Film, readonly number[]> = {
  pay: [1100, 1000, 1000, 1000, 2600],
  enough: [1200, 1400, 1800, 1400, 2600],
  left: [1300, 900, 900, 900, 2600],
  total: [1300, 900, 900, 900, 2600],
};
const CAPTIONS: Record<Film, readonly MarketMessageKey[]> = {
  pay: ['demoPay1', 'demoPay1', 'demoPay1', 'demoPay1', 'demoPay2'],
  enough: ['demoEnough1', 'demoEnough1', 'demoEnough2', 'demoEnough1', 'demoEnough2'],
  left: ['demoLeft1', 'demoLeft2', 'demoLeft2', 'demoLeft2', 'demoLeft3'],
  total: ['demoTotal1', 'demoTotal2', 'demoTotal2', 'demoTotal2', 'demoTotal3'],
};
/** The little number track of the counting films: 0 to 10 across the picture. */
const trackX = (n: number) => 30 + n * 26;

/**
 * A tiny "how to shop" film made from the game's own pieces, so a child sees the move instead
 * of reading about it: coins hopping onto the tray as they are counted, a purse checked
 * against two prices, hops counted up from the price to the purse, and two prices counted on.
 * The numbers are made up. It plays once by itself and waits on the last picture; the button
 * plays it again. Under calm motion it still steps, without the hops.
 */
@Component({
  selector: 'app-market-demo',
  template: `
    <svg class="film" viewBox="0 0 320 200" aria-hidden="true" [attr.data-step]="step()">
      <rect class="wall" width="320" height="200" rx="16" />
      <rect class="counter" x="0" y="150" width="320" height="50" />
      @switch (film()) {
        @case ('pay') {
          <g class="tag" transform="translate(222 22)">
            <rect width="78" height="40" rx="10" />
            <text x="39" y="27">🍯 {{ money(pay().price) }}</text>
          </g>
          <rect class="tray" x="40" y="96" width="190" height="44" rx="10" />
          @for (coin of pay().coins; track $index) {
            <g
              class="coin"
              [style.transform]="
                'translate(' +
                (step() > $index ? 70 + $index * 50 : 60 + $index * 46) +
                'px,' +
                (step() > $index ? 118 : 176) +
                'px)'
              "
            >
              <circle r="17" [attr.fill]="look(coin).rim" />
              <circle r="12" [attr.fill]="look(coin).fill" />
              <text y="5">{{ coin / 100 }}</text>
            </g>
          }
          @if (step() >= 1 && step() <= 3) {
            <g class="bubble" transform="translate(150 70)">
              <rect x="-40" y="-18" width="80" height="30" rx="15" />
              <text y="4">{{ money(running(step())) }}</text>
            </g>
          }
          @if (step() === 4) {
            <g class="pay-chip" transform="translate(262 116)">
              <rect x="-40" y="-18" width="80" height="36" rx="18" />
              <text y="6">✓</text>
            </g>
          }
        }
        @case ('enough') {
          <g class="purse" transform="translate(24 60)">
            <path d="M0 18h100l-8 62H8z" />
            <path class="clasp" d="M30 18a20 20 0 0 1 40 0" />
            @for (coin of enough().purse; track $index) {
              @if (coin >= 500) {
                <rect
                  [attr.x]="8 + $index * 30"
                  y="34"
                  width="42"
                  height="24"
                  rx="3"
                  [attr.fill]="look(coin).fill"
                  [attr.stroke]="look(coin).rim"
                  stroke-width="2"
                />
                <text [attr.x]="29 + $index * 30" y="51">{{ coin / 100 }}</text>
              } @else {
                <circle [attr.cx]="30 + $index * 30" cy="64" r="12" [attr.fill]="look(coin).rim" />
                <circle [attr.cx]="30 + $index * 30" cy="64" r="8" [attr.fill]="look(coin).fill" />
                <text [attr.x]="30 + $index * 30" y="68" class="small">{{ coin / 100 }}</text>
              }
            }
          </g>
          @if (step() >= 1) {
            <g class="bubble" transform="translate(74 40)">
              <rect x="-36" y="-18" width="72" height="30" rx="15" />
              <text y="4">{{ money(enoughTotal()) }}</text>
            </g>
          }
          <g class="tag" transform="translate(200 40)">
            <rect width="96" height="44" rx="10" />
            <text x="48" y="29">
              {{ step() < 3 ? '🧸' : '🪁' }} {{ money(step() < 3 ? enough().yes : enough().no) }}
            </text>
          </g>
          @if (step() === 2) {
            <text class="mark yes" x="248" y="132">✓</text>
          }
          @if (step() === 4) {
            <text class="mark no" x="248" y="132">✗</text>
          }
        }
        @default {
          <path class="track" [attr.d]="'M' + trackX(0) + ' 118H' + trackX(10)" />
          @for (n of ticks; track n) {
            <path class="tick" [attr.d]="'M' + trackX(n) + ' 110v16'" />
            <text class="small" [attr.x]="trackX(n)" y="142">{{ n }}</text>
          }
          <g class="flag start" [attr.transform]="'translate(' + trackX(start()) + ' 108)'">
            <rect x="-28" y="-62" width="56" height="28" rx="8" />
            <text y="-42">{{ startLabel() }}</text>
          </g>
          @for (hop of hops(); track hop) {
            @if (step() > $index) {
              <path class="hop" [attr.d]="'M' + trackX(hop - 1) + ' 110q13 -26 26 0'" />
              <circle class="hop-dot" [attr.cx]="trackX(hop) - 13" cy="92" r="9" />
              <text class="small hop-n" [attr.x]="trackX(hop) - 13" y="96">{{ $index + 1 }}</text>
            }
          }
          @if (film() === 'left') {
            <g class="flag end" [attr.transform]="'translate(' + trackX(left().purse) + ' 108)'">
              <rect x="-28" y="-62" width="56" height="28" rx="8" />
              <text y="-42">👛</text>
            </g>
          }
          @if (step() === 4) {
            <g class="bubble" transform="translate(160 176)">
              <rect x="-60" y="-18" width="120" height="30" rx="15" />
              <text y="4">{{ resultLabel() }}</text>
            </g>
          }
        }
      }
    </svg>
    <p class="caption">{{ caption() }}</p>
    <button type="button" class="replay" (click)="replay()">{{ t('demoReplay') }}</button>
  `,
  styles: `
    :host {
      display: grid;
      gap: 6px;
      justify-items: center;
      width: 100%;
    }
    .film {
      width: 100%;
      max-width: 420px;
      aspect-ratio: 8 / 5;
    }
    .wall {
      fill: #f6e2c2;
    }
    .counter {
      fill: #c99a62;
    }
    text {
      font: 600 16px var(--font-sans);
      text-anchor: middle;
      fill: var(--ink);
    }
    .small {
      font-size: 11px;
    }
    .tag rect,
    .flag rect {
      fill: var(--paper);
      stroke: var(--bronze);
      stroke-width: 2;
    }
    .tray {
      fill: #8a5a2b55;
    }
    .coin {
      transition: transform 0.45s cubic-bezier(0.3, 1.4, 0.5, 1);
    }
    .coin text {
      font-size: 13px;
    }
    .bubble rect {
      fill: var(--gold);
      stroke: var(--gold-deep);
      stroke-width: 2;
    }
    .pay-chip rect {
      fill: var(--pink);
    }
    .pay-chip text {
      fill: var(--paper);
      font-size: 22px;
    }
    .purse path {
      fill: #f7a8c4;
      stroke: var(--pink-deep);
      stroke-width: 2;
    }
    .purse .clasp {
      fill: none;
      stroke: var(--gold-deep);
      stroke-width: 3;
    }
    .mark {
      font-size: 54px;
    }
    .mark.yes {
      fill: var(--success-strong);
    }
    .mark.no {
      fill: var(--pink-deep);
    }
    .track,
    .tick {
      stroke: var(--bronze);
      stroke-width: 3;
      stroke-linecap: round;
    }
    .hop {
      fill: none;
      stroke: var(--pink);
      stroke-width: 3;
      stroke-linecap: round;
    }
    .hop-dot {
      fill: var(--pink);
    }
    .hop-n {
      fill: var(--paper);
    }
    .caption {
      min-height: 2.6em;
      margin: 0;
      font-weight: 600;
      text-align: center;
      line-height: 1.3;
    }
    .replay {
      min-height: 40px;
      padding: 4px 16px;
      border: 2px solid var(--bronze);
      border-radius: var(--radius-pill);
      background: var(--paper);
      color: var(--ink);
      font: 600 15px var(--font-sans);
      cursor: pointer;
    }
    .replay:focus-visible {
      outline: 3px solid var(--focus);
      outline-offset: 3px;
    }
    :host-context(.calm-motion) .coin {
      transition: none;
    }
    @media (prefers-reduced-motion: reduce) {
      .coin {
        transition: none;
      }
    }
  `,
})
export class MarketDemo {
  private readonly i = inject(LocaleService);
  readonly film = input.required<Film>();
  /** The turn on screen uses the usual numbers: show the other set. */
  readonly alternate = input(false);
  protected readonly step = signal(0);
  protected readonly ticks = Array.from({ length: 11 }, (_, n) => n);
  private timer?: ReturnType<typeof setTimeout>;
  private readonly set = computed(() => (this.alternate() ? 1 : 0));
  protected readonly pay = computed(() => FILM_NUMBERS.pay[this.set()]);
  protected readonly enough = computed(() => FILM_NUMBERS.enough[this.set()]);
  protected readonly left = computed(() => FILM_NUMBERS.left[this.set()]);
  protected readonly total = computed(() => FILM_NUMBERS.total[this.set()]);
  protected readonly enoughTotal = computed(() =>
    this.enough().purse.reduce((sum: number, coin) => sum + coin / EURO, 0),
  );
  /** Where the counting starts: the price, or the bigger of the two prices. */
  protected readonly start = computed(() =>
    this.film() === 'left' ? this.left().price : Math.max(this.total().a, this.total().b),
  );
  protected readonly hops = computed(() => {
    const steps =
      this.film() === 'left'
        ? this.left().purse - this.left().price
        : Math.min(this.total().a, this.total().b);
    return Array.from({ length: steps }, (_, n) => this.start() + n + 1);
  });
  protected readonly startLabel = computed(() =>
    this.film() === 'left' ? `🧁 ${this.money(this.left().price)}` : this.money(this.start()),
  );
  protected readonly resultLabel = computed(() =>
    this.film() === 'left'
      ? this.t('demoLeftResult', { amount: this.money(this.left().purse - this.left().price) })
      : this.t('demoTotalResult', { amount: this.money(this.total().a + this.total().b) }),
  );
  protected readonly caption = computed(() => {
    const key = CAPTIONS[this.film()][this.step()];
    const other = Math.min(this.total().a, this.total().b);
    return this.t(key, { n: this.money(other) });
  });

  constructor() {
    afterNextRender(() => this.run(0));
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  protected t(key: MarketMessageKey, values: Record<string, string | number> = {}) {
    return marketText(this.i.locale(), key, values);
  }
  protected money(euros: number) {
    return formatMoney(euros * EURO, this.i.locale());
  }
  protected look(value: Denomination) {
    return MONEY_LOOK[value];
  }
  protected trackX(n: number) {
    return trackX(n);
  }
  /** The money on the tray after `count` coins went down. */
  protected running(count: number) {
    return this.pay()
      .coins.slice(0, count)
      .reduce((sum: number, coin) => sum + coin / EURO, 0);
  }

  protected replay() {
    clearTimeout(this.timer);
    this.run(0);
  }

  private run(step: number) {
    this.step.set(step);
    const steps = STEPS[this.film()];
    if (step >= steps.length - 1) return;
    this.timer = setTimeout(() => this.run(step + 1), steps[step]);
  }
}
