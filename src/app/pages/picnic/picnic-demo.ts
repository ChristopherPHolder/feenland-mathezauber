import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { StackedFraction } from '@feenland/ui';
import { LocaleService } from '../../core/locale';
import { equalSizes, Fraction, pieceSizes, TICKS } from './fractions';
import { PicnicDeal } from './picnic-deal';
import { PicnicFace } from './picnic-face';
import { PicnicFood } from './picnic-food';
import { FRIENDS } from './picnic-friends';
import { Food, roundFood } from './picnic-levels';
import { fractionWords, picnicText, PicnicMessageKey } from './picnic-messages';

/** What the film shows: the made-up example, never the share on screen. */
export type DemoCard =
  | { readonly kind: 'cut'; readonly food: Food; readonly parts: number }
  | {
      readonly kind: 'name';
      readonly food: Food;
      readonly share: Fraction;
      readonly others: readonly Fraction[];
    }
  | {
      readonly kind: 'compare';
      readonly food: Food;
      readonly left: Fraction;
      readonly right: Fraction;
    }
  | {
      readonly kind: 'deal';
      readonly total: number;
      readonly plates: number;
      readonly others: readonly number[];
    };

interface Step {
  readonly caption: PicnicMessageKey;
  readonly ms: number;
}

/** The film's steps, in order. */
export function demoSteps(card: DemoCard): readonly Step[] {
  const yum = { caption: 'demoYum', ms: 2200 } as const;
  switch (card.kind) {
    case 'cut':
      return [
        { caption: 'demoFriends', ms: 1300 },
        ...Array.from({ length: card.parts - 1 }, () => ({
          caption: 'demoTapCut' as const,
          ms: 1200,
        })),
        { caption: 'demoShare', ms: 1300 },
        yum,
      ];
    case 'name':
      return [{ caption: 'demoLook', ms: 1800 }, { caption: 'demoTapFraction', ms: 1600 }, yum];
    case 'compare':
      return [{ caption: 'demoBlankets', ms: 2000 }, { caption: 'demoTapBigger', ms: 1600 }, yum];
    case 'deal':
      return [
        ...Array.from({ length: card.total / card.plates + 1 }, () => ({
          caption: 'demoDeal' as const,
          ms: 1000,
        })),
        { caption: 'demoCount', ms: 1600 },
        { caption: 'demoTapFraction', ms: 1500 },
        yum,
      ];
  }
}

/**
 * A tiny "how to share" film in the picnic's own pieces with made-up numbers: friends sit down
 * and a finger cuts a pie and taps Share, or taps a fraction, a blanket, or deals berries and
 * counts a plate. It plays once by itself and waits on the last picture; the button plays it
 * again or pauses it.
 */
@Component({
  selector: 'app-picnic-demo',
  imports: [PicnicFood, PicnicFace, PicnicDeal, StackedFraction],
  template: `
    <div class="film" [attr.data-kind]="card().kind" aria-hidden="true">
      @switch (card().kind) {
        @case ('cut') {
          <div class="faces">
            @for (friend of friends(); track $index) {
              <app-picnic-face [kind]="friend" [class.munch]="yum()" />
            }
          </div>
          <app-picnic-food
            class="food"
            [class.strip]="!round()"
            [food]="food()"
            [sizes]="cutSizes()"
            [apart]="shared()"
          />
          <span class="pill share-pill" [class.lit]="caption() === 'demoShare'">{{
            t('shareButton')
          }}</span>
        }
        @case ('name') {
          <div class="row">
            <app-picnic-face [kind]="friends()[0]" />
            <app-picnic-food
              class="food small"
              [food]="food()"
              [sizes]="nameSizes()"
              [shaded]="nameJam()"
            />
          </div>
          <div class="chips">
            @for (option of nameOptions(); track $index) {
              <span class="chip" [class.lit]="tapped() && $index === 0"
                ><ui-fraction [numerator]="option.n" [denominator]="option.d" label=""
              /></span>
            }
          </div>
        }
        @case ('compare') {
          <div class="blankets">
            @for (side of sides(); track $index) {
              <div class="blanket" [class.lit]="tapped() && side.big">
                <div class="faces mini">
                  @for (friend of side.friends; track $index) {
                    <app-picnic-face [kind]="friend" />
                  }
                </div>
                <app-picnic-food
                  class="food small"
                  [food]="food()"
                  [sizes]="side.sizes"
                  [shaded]="side.jam"
                />
                <ui-fraction [numerator]="1" [denominator]="side.d" label="" />
              </div>
            }
          </div>
        }
        @case ('deal') {
          <app-picnic-deal
            [total]="dealTotal()"
            [dealt]="dealt()"
            [before]="Math.max(0, dealt() - 1)"
            [guests]="friends()"
            basketLabel=""
            [plateLabels]="[]"
          />
          <div class="chips">
            @for (option of dealOptions(); track option) {
              <span class="chip" [class.lit]="tapped() && option === dealAnswer()">{{
                option
              }}</span>
            }
          </div>
        }
      }
      @if (finger(); as finger) {
        <svg class="finger" viewBox="0 0 48 50" [style.left.%]="finger.x" [style.top.%]="finger.y">
          <path
            d="M15 25V7a4.5 4.5 0 0 1 9 0v13l9.5 2.2A5 5 0 0 1 37 27.6L35 40a9 9 0 0 1-9 7.5h-8.6a9 9 0 0 1-7.3-3.8L4 35.4a4 4 0 0 1 6-5.2l5 4.3z"
          />
        </svg>
      }
      @if (yum()) {
        <span class="heart">♥</span>
      }
    </div>
    <div class="controls">
      <ol class="steps" aria-hidden="true">
        @for (n of numbers(); track n) {
          <li [class.on]="step() === n" [class.done]="step() > n">{{ n }}</li>
        }
      </ol>
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
            <path d="M7 4v16l13-8z" />
          }
        </svg>
      </button>
    </div>
    <p class="caption" aria-hidden="true">{{ t(caption()) }}</p>
    <p class="sr-only">{{ t('demoSummary') }}</p>
  `,
  styleUrl: './picnic-demo.css',
})
export class PicnicDemo {
  private readonly i = inject(LocaleService);
  readonly card = input.required<DemoCard>();

  protected readonly Math = Math;
  protected readonly step = signal(0);
  protected readonly playing = signal(false);
  private timer?: ReturnType<typeof setTimeout>;

  protected readonly steps = computed(() => demoSteps(this.card()));
  protected readonly numbers = computed(() =>
    this.steps()
      .map((_, index) => index)
      .slice(1),
  );
  protected readonly caption = computed(
    () => this.steps()[Math.min(this.step(), this.steps().length - 1)].caption,
  );
  protected readonly yum = computed(() => this.caption() === 'demoYum');
  protected readonly tapped = computed(
    () => this.yum() || this.caption() === 'demoTapFraction' || this.caption() === 'demoTapBigger',
  );
  protected readonly food = computed<Food>(() => {
    const card = this.card();
    return card.kind === 'deal' ? 'pie' : card.food;
  });
  protected readonly round = computed(() => roundFood(this.food()));
  protected readonly friends = computed(() => {
    const card = this.card();
    const count = card.kind === 'cut' ? card.parts : card.kind === 'deal' ? card.plates : 1;
    return FRIENDS.slice(4, 4 + count);
  });

  // ---- Cutting
  private readonly cutsMade = computed(() => {
    const card = this.card();
    if (card.kind !== 'cut') return 0;
    return Math.max(0, Math.min(card.parts - 1, this.step()));
  });
  protected readonly cutSizes = computed(() => {
    const card = this.card();
    if (card.kind !== 'cut') return [1];
    const step = TICKS / card.parts;
    const cuts = Array.from({ length: this.cutsMade() }, (_, index) => (index + 1) * step);
    return pieceSizes(this.round() ? 'round' : 'strip', cuts).map((size) => size / TICKS);
  });
  protected readonly shared = computed(() => this.caption() === 'demoShare' || this.yum());

  // ---- Naming
  protected readonly nameSizes = computed(() => {
    const card = this.card();
    return card.kind === 'name' ? equalSizes(card.share.d) : [1];
  });
  protected readonly nameJam = computed(() => {
    const card = this.card();
    return card.kind === 'name' ? this.nameSizes().map((_, i) => i < card.share.n) : [];
  });
  protected readonly nameOptions = computed(() => {
    const card = this.card();
    return card.kind === 'name' ? [card.share, ...card.others] : [];
  });

  // ---- Comparing
  protected readonly sides = computed(() => {
    const card = this.card();
    if (card.kind !== 'compare') return [];
    return [card.left, card.right].map((f) => ({
      d: f.d,
      sizes: equalSizes(f.d),
      jam: equalSizes(f.d).map((_, i) => i < f.n),
      friends: FRIENDS.slice(0, f.d),
      big: f.n / f.d >= Math.max(card.left.n / card.left.d, card.right.n / card.right.d),
    }));
  });

  // ---- Dealing
  protected readonly dealTotal = computed(() => {
    const card = this.card();
    return card.kind === 'deal' ? card.total : 0;
  });
  protected readonly dealt = computed(() => {
    const card = this.card();
    if (card.kind !== 'deal') return 0;
    return Math.min(card.total / card.plates, this.step());
  });
  protected readonly dealAnswer = computed(() => {
    const card = this.card();
    return card.kind === 'deal' ? card.total / card.plates : 0;
  });
  protected readonly dealOptions = computed(() => {
    const card = this.card();
    return card.kind === 'deal' ? [...card.others, this.dealAnswer()].sort((a, b) => a - b) : [];
  });

  /** Where the finger points, in percent of the film. */
  protected readonly finger = computed(() => {
    const card = this.card();
    const caption = this.caption();
    if (card.kind === 'cut') {
      if (caption === 'demoTapCut') {
        const mark = (this.cutsMade() * TICKS) / card.parts / TICKS;
        if (this.round()) {
          const angle = mark * Math.PI * 2 - Math.PI / 2;
          return { x: 46 + Math.cos(angle) * 26, y: 50 + Math.sin(angle) * 34 };
        }
        return { x: 14 + mark * 70, y: 54 };
      }
      if (caption === 'demoShare') return { x: 70, y: 84 };
      return null;
    }
    if (card.kind === 'name' || card.kind === 'deal') {
      if (caption === 'demoTapFraction') {
        const options =
          card.kind === 'name' ? this.nameOptions().length : this.dealOptions().length;
        const at = card.kind === 'name' ? 0 : this.dealOptions().indexOf(this.dealAnswer());
        return { x: 50 + (at - (options - 1) / 2) * 22, y: 80 };
      }
      if (caption === 'demoCount') return { x: 30, y: 52 };
      if (caption === 'demoDeal' && this.step() > 0) return { x: 46, y: 6 };
      return null;
    }
    if (caption === 'demoTapBigger') {
      const left = this.sides()[0]?.big;
      return { x: left ? 22 : 72, y: 60 };
    }
    return null;
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
    afterNextRender(() => this.play());
  }

  protected t(key: PicnicMessageKey) {
    return picnicText(this.i.locale(), key);
  }

  protected words(f: Fraction) {
    return fractionWords(this.i.locale(), f);
  }

  protected toggle() {
    if (this.playing()) {
      clearTimeout(this.timer);
      this.playing.set(false);
    } else this.play();
  }

  private play() {
    clearTimeout(this.timer);
    const last = this.steps().length - 1;
    if (this.step() >= last) this.step.set(0);
    this.playing.set(true);
    const next = () => {
      const step = this.step();
      if (step >= last) {
        this.playing.set(false);
        return;
      }
      this.timer = setTimeout(() => {
        this.step.set(step + 1);
        next();
      }, this.steps()[step].ms);
    };
    next();
  }
}
