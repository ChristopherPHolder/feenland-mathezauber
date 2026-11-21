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
import { clockText, ClockMessageKey } from './clock-messages';
import { at, digital, handAngles } from './clock-time';

type Press = 'hour' | 'minute' | 'ring' | null;
interface Shot {
  readonly caption: ClockMessageKey;
  /** Hands on the face, as minutes after 12:00. */
  readonly dial: number;
  readonly press: Press;
  readonly ms: number;
}

/** The film: the card, two taps on the short hand, the long hand in fives, then the bell. */
function shots(target: number): Shot[] {
  const hours = Math.floor(target / 60);
  const fives = (target % 60) / 5;
  const list: Shot[] = [{ caption: 'demoCard', dial: 0, press: null, ms: 1500 }];
  for (let h = 1; h <= hours; h++)
    list.push({ caption: 'demoShort', dial: h * 60, press: 'hour', ms: 650 });
  list.push({ caption: 'demoShort', dial: hours * 60, press: null, ms: 500 });
  for (let f = 1; f <= fives; f++)
    list.push({ caption: 'demoLong', dial: hours * 60 + f * 5, press: 'minute', ms: 650 });
  list.push({ caption: 'demoLong', dial: target, press: null, ms: 700 });
  list.push({ caption: 'demoRing', dial: target, press: 'ring', ms: 2600 });
  return list;
}

/**
 * A tiny "how to play" film in the game's own pieces: an event card with a made-up time, the
 * clock at 12, a finger tapping the short-hand + and then the long-hand + in fives while the
 * short hand creeps along, and the bell ringing. The time is 2:15, or 7:45 when the turn on
 * screen is 2:15, so it shows how to play without giving an answer away. It plays once and
 * waits on the last picture; the button plays it again or pauses it.
 */
@Component({
  selector: 'app-clock-demo',
  template: `
    <svg class="film" viewBox="0 0 320 200" [attr.data-press]="shot().press" aria-hidden="true">
      <rect class="sky" width="320" height="200" rx="16" />
      <g class="card" transform="translate(14 16)">
        <rect width="104" height="64" rx="12" />
        <circle class="cupcake" cx="22" cy="24" r="10" />
        <path class="cupcake-base" d="M12 30h20l-3 12H15z" />
        <text x="72" y="40">{{ label() }}</text>
      </g>
      <g transform="translate(206 92)">
        <circle class="rim" r="74" />
        <circle class="face" r="66" />
        @for (n of numbers; track n) {
          <text class="number" [attr.x]="48 * sin(n * 30)" [attr.y]="-48 * cos(n * 30) + 5">
            {{ n }}
          </text>
        }
        <g class="hand hour" [style.rotate.deg]="angles().hour">
          <path d="M-5 6 0-34 5 6z" />
        </g>
        <g class="hand minute" [style.rotate.deg]="angles().minute">
          <path d="M-3.5 8 0-58 3.5 8z" />
        </g>
        <circle class="pin" r="5" />
      </g>
      <g class="bell" [class.ringing]="shot().press === 'ring'" transform="translate(206 10)">
        <path d="M-10 18q0-16 10-16t10 16l3 3h-26z" />
      </g>
      <g class="buttons">
        <g class="btn" [class.pressed]="shot().press === 'hour'" transform="translate(14 104)">
          <rect width="104" height="34" rx="10" />
          <text x="52" y="23">◷ +1</text>
        </g>
        <g class="btn" [class.pressed]="shot().press === 'minute'" transform="translate(14 146)">
          <rect width="104" height="34" rx="10" />
          <text x="52" y="23">◴ +5</text>
        </g>
      </g>
      <path
        class="finger"
        [attr.transform]="finger()"
        d="M10 18V4a3.5 3.5 0 0 1 7 0v10l7 1.6a4 4 0 0 1 2.8 4.5L25.4 30a7 7 0 0 1-7 5.8H12a7 7 0 0 1-5.6-3L1 26a3 3 0 0 1 4.6-3.9L10 26z"
      />
    </svg>
    <div class="controls">
      <p class="caption" aria-hidden="true">{{ t(shot().caption) }}</p>
      <button
        type="button"
        class="replay"
        [attr.aria-label]="t(playing() ? 'demoPause' : 'demoReplay')"
        [title]="t(playing() ? 'demoPause' : 'demoReplay')"
        (click)="toggle()"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          @if (playing()) {
            <path d="M8 5v14M16 5v14" />
          } @else {
            <path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5" />
          }
        </svg>
      </button>
    </div>
  `,
  styles: `
    :host {
      display: grid;
      gap: 6px;
    }
    .film {
      display: block;
      width: 100%;
      height: auto;
    }
    .sky {
      fill: #cfe3ff;
    }
    .card rect {
      fill: #fffdf5;
      stroke: #c98a3a;
      stroke-width: 3;
    }
    .card text {
      font: 600 24px var(--font-sans);
      fill: var(--ink);
      text-anchor: middle;
    }
    .cupcake {
      fill: #f6a6c1;
    }
    .cupcake-base {
      fill: #c98a3a;
    }
    .rim {
      fill: #c98a3a;
    }
    .face {
      fill: #fff8e6;
    }
    .number {
      font: 600 13px var(--font-sans);
      fill: var(--ink);
      text-anchor: middle;
    }
    .hand {
      transition: rotate 0.45s cubic-bezier(0.3, 1.4, 0.5, 1);
    }
    .hand path {
      fill: var(--ink);
    }
    .hand.minute path {
      fill: #3d3470;
    }
    .pin {
      fill: #ffcf33;
    }
    .bell {
      fill: #c98a3a;
      transform-box: fill-box;
      transform-origin: 50% 0;
    }
    .btn rect {
      fill: var(--paper);
      stroke: #9bb3cc;
      stroke-width: 2;
    }
    .btn text {
      font: 600 17px var(--font-sans);
      fill: var(--ink);
      text-anchor: middle;
    }
    .btn.pressed rect {
      fill: #ffe066;
      stroke: #c48a00;
    }
    .finger {
      fill: #fff;
      stroke: var(--ink);
      stroke-width: 2;
      transition: transform 0.35s ease;
    }
    .controls {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .caption {
      flex: 1;
      margin: 0;
      min-height: 2.6em;
      font-weight: 600;
      line-height: 1.3;
    }
    .replay {
      flex: none;
      width: 44px;
      height: 44px;
      border: 0;
      border-radius: 50%;
      background: var(--paper);
      box-shadow: var(--shadow-rest);
      cursor: pointer;
    }
    .replay svg {
      width: 22px;
      height: 22px;
      fill: none;
      stroke: var(--sky-deep);
      stroke-width: 2.5;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .replay:focus-visible {
      outline: 3px solid var(--focus);
      outline-offset: 3px;
    }
    @media (prefers-reduced-motion: no-preference) {
      .bell.ringing {
        animation: swing 1.1s ease-out;
      }
    }
    @keyframes swing {
      20% {
        rotate: 22deg;
      }
      45% {
        rotate: -16deg;
      }
      70% {
        rotate: 8deg;
      }
    }
    :host-context(.calm-motion) .bell.ringing {
      animation: none;
    }
    :host-context(.calm-motion) .hand,
    :host-context(.calm-motion) .finger {
      transition: none;
    }
  `,
})
export class ClockDemo {
  private readonly i = inject(LocaleService);
  /** The turn on screen is the film's usual time: show the other one. */
  readonly alternate = input(false);
  protected readonly numbers = Array.from({ length: 12 }, (_, index) => index + 1);
  private readonly film = computed(() => shots(this.alternate() ? at(7, 45) : at(2, 15)));
  protected readonly index = signal(0);
  protected readonly playing = signal(false);
  protected readonly shot = computed(
    () => this.film()[Math.min(this.index(), this.film().length - 1)],
  );
  protected readonly label = computed(() => digital(this.alternate() ? at(7, 45) : at(2, 15)));
  protected readonly angles = computed(() => handAngles(this.shot().dial));
  protected readonly finger = computed(() => {
    switch (this.shot().press) {
      case 'hour':
        return 'translate(92 118)';
      case 'minute':
        return 'translate(92 160)';
      case 'ring':
        return 'translate(222 24)';
      default:
        return 'translate(130 176)';
    }
  });
  private timer?: ReturnType<typeof setTimeout>;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
    afterNextRender(() => this.play());
  }

  protected t(key: ClockMessageKey) {
    return clockText(this.i.locale(), key);
  }
  protected sin(degrees: number) {
    return Math.sin((degrees * Math.PI) / 180);
  }
  protected cos(degrees: number) {
    return Math.cos((degrees * Math.PI) / 180);
  }

  protected toggle() {
    if (this.playing()) {
      clearTimeout(this.timer);
      this.playing.set(false);
    } else this.play();
  }

  /** Plays from the start, or from where a pause left it, and stops on the last picture. */
  private play() {
    clearTimeout(this.timer);
    if (this.index() >= this.film().length - 1) this.index.set(0);
    this.playing.set(true);
    this.next();
  }

  private next() {
    this.timer = setTimeout(() => {
      if (this.index() >= this.film().length - 1) {
        this.playing.set(false);
        return;
      }
      this.index.update((index) => index + 1);
      this.next();
    }, this.shot().ms);
  }
}
