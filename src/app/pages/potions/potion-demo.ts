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
import { potionText, PotionMessageKey } from './potion-messages';
import type { PotionOp } from './potion-puzzles';

/** The demo's steps: rest, tap a bottle, tap a spell, tap one more bottle, they mix, the potion brews. */
type DemoStep = 0 | 1 | 2 | 3 | 4 | 5;
const STEP_MS = [700, 1500, 1500, 1500, 1500, 2200] as const;
const CAPTIONS: Record<DemoStep, PotionMessageKey> = {
  0: 'demoBottle',
  1: 'demoBottle',
  2: 'demoSpell',
  3: 'demoSecond',
  4: 'demoMix',
  5: 'demoReady',
};

/**
 * A tiny "how to brew" film in the game's own pieces: a finger taps a 3 bottle, the + spell and a
 * 4 bottle; they mix into a 7 bottle, which matches the 7 cauldron, and the potion is ready. The
 * numbers are made up and never the potion on screen, so the demo shows how to play without
 * giving an answer away. It plays once by itself and then waits on the last picture; the button
 * plays it again or pauses it.
 */
@Component({
  selector: 'app-potion-demo',
  template: `
    <div class="film" [attr.data-step]="step()" [style.--n]="shownOps().length" aria-hidden="true">
      <div class="bottles">
        <span class="bottle first" style="--liquid: #e0457b"
          ><span class="neck"></span><span class="body">3</span></span
        >
        <span class="bottle second" style="--liquid: #3d8fe0"
          ><span class="neck"></span><span class="body">4</span></span
        >
        <span class="bottle made" style="--liquid: #3fa65a"
          ><span class="neck"></span><span class="body">7</span></span
        >
      </div>
      <div class="spells">
        @for (op of shownOps(); track op) {
          <span class="spell" [attr.data-op]="op">{{ sign(op) }}</span>
        }
      </div>
      <div class="mix">
        <span class="slot a">3</span>
        <span class="slot op">+</span>
        <span class="slot b">4</span>
        <span class="equals">=</span>
        <span class="slot r">7</span>
        <span class="cauldron">
          <svg viewBox="0 0 24 24">
            <path d="M4 9h16q1 9-5 11H9Q3 18 4 9z" />
            <path d="M3 9h18" />
          </svg>
          7
        </span>
      </div>
      <svg class="finger" viewBox="0 0 40 50">
        <path
          d="M15 25V7a4.5 4.5 0 0 1 9 0v13l9.5 2.2A5 5 0 0 1 37 27.6L35 40a9 9 0 0 1-9 7.5h-8.6a9 9 0 0 1-7.3-3.8L4 35.4a4 4 0 0 1 6-5.2l5 4.3z"
        />
      </svg>
    </div>
    <div class="controls">
      <ol class="steps" aria-hidden="true">
        @for (n of [1, 2, 3]; track n) {
          <li [class.on]="stepNumber() === n" [class.done]="stepNumber() > n">{{ n }}</li>
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
  styleUrl: './potion-demo.css',
})
export class PotionDemo {
  private readonly i = inject(LocaleService);
  /** The level's spells, so the demo shows the same buttons the child will see. */
  readonly ops = input<readonly PotionOp[]>(['+', '−']);

  protected readonly step = signal<DemoStep>(0);
  protected readonly playing = signal(false);
  protected readonly caption = computed(() => CAPTIONS[this.step()]);
  /** Which numbered step the caption is on: 4 when the bottles mix and the potion brews. */
  protected readonly stepNumber = computed(() => Math.min(Math.max(this.step(), 1), 4));
  protected readonly shownOps = computed(() => {
    const ops = this.ops();
    return ops.includes('+') ? ops : (['+', ...ops] as PotionOp[]);
  });
  private timer?: ReturnType<typeof setTimeout>;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
    // Plays by itself once when it appears.
    afterNextRender(() => this.play());
  }

  protected t(key: PotionMessageKey) {
    return potionText(this.i.locale(), key);
  }
  protected sign(op: PotionOp) {
    return op === '÷' ? this.i.t('divide') : op;
  }

  protected toggle() {
    if (this.playing()) {
      clearTimeout(this.timer);
      this.playing.set(false);
    } else this.play();
  }

  /** Plays from the start, or from where a pause left it, and stops on the brewed potion. */
  private play() {
    clearTimeout(this.timer);
    if (this.step() === 5) this.step.set(0);
    this.playing.set(true);
    const next = () => {
      const step = this.step();
      if (step === 5) {
        this.playing.set(false);
        return;
      }
      this.timer = setTimeout(() => {
        this.step.set((step + 1) as DemoStep);
        next();
      }, STEP_MS[step]);
    };
    next();
  }
}
