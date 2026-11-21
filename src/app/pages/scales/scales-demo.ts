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
import { DISHES, PanThing, ScalesFrame } from './scales-frame';
import type { ItemId } from './scales-levels';
import { formatAmount, formatNumber, tiltFor } from './scales-math';
import { scalesText, ScalesMessageKey } from './scales-messages';
import { ScalesScene } from './scales-scene';

/** Which film a level shows: the main thing its lines ask for. */
export type DemoKind = 'balance' | 'compare' | 'dial' | 'pour' | 'missing';

interface Step {
  readonly caption: ScalesMessageKey;
  readonly ms: number;
  /** The pretend button the finger taps on this step, by index; -1 for none. */
  readonly press: number;
}

/** The film's steps for each kind of line. Numbers are made up and fixed. */
export function demoSteps(kind: DemoKind): readonly Step[] {
  const recipe = { caption: 'demoRecipe', ms: 1300, press: -1 } as const;
  switch (kind) {
    case 'balance':
      return [
        recipe,
        { caption: 'demoAdd', ms: 1200, press: 0 },
        { caption: 'demoAdd', ms: 1200, press: 2 },
        { caption: 'demoWeigh', ms: 1600, press: 3 },
        { caption: 'demoLevel', ms: 2200, press: -1 },
      ];
    case 'compare':
      return [
        recipe,
        { caption: 'demoTips', ms: 2000, press: -1 },
        { caption: 'demoPick', ms: 1500, press: 0 },
        { caption: 'demoLevel', ms: 2200, press: -1 },
      ];
    case 'dial':
      return [
        recipe,
        { caption: 'demoRead', ms: 2200, press: -1 },
        { caption: 'demoType', ms: 1300, press: 0 },
        { caption: 'demoType', ms: 1300, press: 3 },
        { caption: 'demoLevel', ms: 2200, press: -1 },
      ];
    case 'pour':
      return [
        recipe,
        { caption: 'demoPour', ms: 1300, press: 0 },
        { caption: 'demoPour', ms: 1300, press: 1 },
        { caption: 'demoLine', ms: 1500, press: 2 },
        { caption: 'demoLevel', ms: 2200, press: -1 },
      ];
    case 'missing':
      return [
        recipe,
        { caption: 'demoBox', ms: 2400, press: -1 },
        { caption: 'demoType', ms: 1300, press: 0 },
        { caption: 'demoType', ms: 1300, press: 3 },
        { caption: 'demoLevel', ms: 2200, press: -1 },
      ];
  }
}

const BASE: ScalesFrame = {
  line: 0,
  mode: 'balance',
  left: [],
  right: [],
  tilt: 0,
  held: false,
  dial: null,
  pot: null,
  soup: 0,
  soupColor: DISHES[1].color,
  timer: null,
  bubbling: false,
  golden: false,
  feast: false,
  dishes: [],
  finished: false,
  mood: 'wait',
  cooks: 0,
  slips: 0,
  adds: 0,
  pours: 0,
};

/**
 * A tiny "how to cook" film made from the kitchen's own flat picture, with made-up numbers: a
 * finger taps weights onto the pan and Bramble lets go, or it counts the dial's marks, pours the
 * jugs, or picks the side that went down. It plays once by itself and then waits on the last
 * picture; the button plays it again or pauses it. The pretend buttons under it are the same
 * colours as the real ones, so the child knows what to tap.
 */
@Component({
  selector: 'app-scales-demo',
  imports: [ScalesScene],
  template: `
    <div class="film" aria-hidden="true">
      <app-scales-scene [frame]="frame()" [quick]="true" />
      <div class="pretend">
        @for (button of buttons(); track $index) {
          <span class="fake" [class.go]="button.go" [class.pressed]="pressed() === $index">{{
            button.text
          }}</span>
        }
        @if (pressed() >= 0) {
          <svg class="finger" viewBox="0 0 40 50" [style.left]="fingerAt()">
            <path
              d="M15 25V7a4.5 4.5 0 0 1 9 0v13l9.5 2.2A5 5 0 0 1 37 27.6L35 40a9 9 0 0 1-9 7.5h-8.6a9 9 0 0 1-7.3-3.8L4 35.4a4 4 0 0 1 6-5.2l5 4.3z"
            />
          </svg>
        }
      </div>
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
      <p class="caption" aria-hidden="true">{{ t(steps()[step()].caption) }}</p>
    </div>
    <p class="sr-only">{{ t(summary()) }}</p>
  `,
  styleUrl: './scales-demo.css',
})
export class ScalesDemo {
  private readonly i = inject(LocaleService);
  readonly kind = input<DemoKind>('balance');

  protected readonly step = signal(0);
  protected readonly playing = signal(false);
  private timer?: ReturnType<typeof setTimeout>;

  protected readonly steps = computed(() => demoSteps(this.kind()));
  protected readonly numbers = computed(() =>
    this.steps()
      .map((_, index) => index)
      .slice(1),
  );
  protected readonly pressed = computed(() => this.steps()[this.step()].press);
  protected readonly summary = computed<ScalesMessageKey>(() => {
    const kind = this.kind();
    return kind === 'balance'
      ? 'demoSummaryBalance'
      : kind === 'compare'
        ? 'demoSummaryCompare'
        : kind === 'dial'
          ? 'demoSummaryDial'
          : kind === 'pour'
            ? 'demoSummaryPour'
            : 'demoSummaryMissing';
  });

  private amount(value: number, unit: 'kg' | 'l') {
    return formatAmount(value, unit, this.i.locale());
  }

  /** The pretend controls under the picture: weights and Weigh, digits and Check, jugs and Done. */
  protected readonly buttons = computed(() => {
    const kg = (n: number) => this.amount(n, 'kg');
    switch (this.kind()) {
      case 'balance':
        return [
          { text: kg(5), go: false },
          { text: kg(2), go: false },
          { text: kg(1), go: false },
          { text: this.t('weigh'), go: true },
        ];
      case 'compare':
        return [
          { text: this.t('cheese'), go: false },
          { text: this.t('pillow'), go: false },
        ];
      case 'pour':
        return [
          { text: this.amount(1000, 'l'), go: false },
          { text: this.amount(500, 'l'), go: false },
          { text: this.t('donePouring'), go: true },
        ];
      default:
        return [
          { text: this.kind() === 'dial' ? '3' : '4', go: false },
          { text: '5', go: false },
          { text: '6', go: false },
          { text: this.t('check'), go: true },
        ];
    }
  });
  protected readonly fingerAt = computed(() => {
    const count = this.buttons().length;
    return `calc(${((this.pressed() + 0.5) / count) * 100}% - 10px)`;
  });

  /** What the little kitchen shows at this step. */
  protected readonly frame = computed<ScalesFrame>(() => {
    const step = this.step();
    const last = step === this.steps().length - 1;
    const cooked = {
      soup: last ? 1 / 7 : 0,
      cooks: last ? 1 : 0,
      mood: last ? 'happy' : 'wait',
    } as const;
    const weight = (amount: number, added = true): PanThing => ({
      kind: 'weight',
      item: null,
      size: Math.sqrt(amount / 5),
      label: this.amount(amount, 'kg'),
      added,
    });
    const item = (id: ItemId, label = ''): PanThing => ({
      kind: 'item',
      item: id,
      size: 1,
      label,
      added: false,
    });
    switch (this.kind()) {
      case 'balance': {
        const right = step === 0 ? [] : step === 1 ? [weight(5)] : [weight(5), weight(1)];
        return {
          ...BASE,
          ...cooked,
          left: [item('pumpkin', this.amount(6, 'kg'))],
          right,
          held: step === 1 || step === 2,
          tilt: step === 0 ? tiltFor(6, 6) : 0,
        };
      }
      case 'compare':
        return {
          ...BASE,
          ...cooked,
          left: [item('cheese')],
          right: [item('pillow')],
          tilt: tiltFor(4, 6),
        };
      case 'dial':
        return {
          ...BASE,
          ...cooked,
          mode: 'dial',
          dial: {
            dial: { max: 10, step: 1, label: 5 },
            value: step === 0 ? 0 : 3,
            labels: [0, 5, 10].map((n) => formatNumber(n, this.i.locale())),
            unit: 'kg',
            item: 'cabbage',
          },
        };
      case 'pour':
        return {
          ...BASE,
          ...cooked,
          mode: 'pour',
          pours: step >= 1 ? step : 0,
          pot: {
            capacity: 3000,
            target: 1500,
            filled: step >= 2 ? 1500 : step === 1 ? 1000 : 0,
            line: this.amount(1500, 'l'),
            item: 'water',
            jugs: [1000, 500].map((amount) => ({ amount, label: this.amount(amount, 'l') })),
            lastJug: step === 1 ? 1000 : 500,
          },
        };
      case 'missing':
        return {
          ...BASE,
          ...cooked,
          left: [
            { kind: 'mystery', item: null, size: 1, label: '?', added: false },
            weight(3, false),
          ],
          right: [weight(7, false)],
        };
    }
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
    afterNextRender(() => this.play());
  }

  protected t(key: ScalesMessageKey) {
    return scalesText(this.i.locale(), key);
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
    if (this.step() === last) this.step.set(0);
    this.playing.set(true);
    const next = () => {
      const step = this.step();
      if (step === last) {
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
