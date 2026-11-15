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
import { DrumFrame } from './drum-frame';
import { drumText, DrumMessageKey } from './drum-messages';
import { DrumPath } from './drum-path';
import { buildVerse, choicesFor, DrumStage, seeded } from './drum-patterns';

/** Rest, two hops by Pom, the "?" asks, the finger taps, Pom lands. */
type DemoStep = 0 | 1 | 2 | 3 | 4 | 5;
const STEP_MS = [800, 1100, 1100, 1300, 1200, 2200] as const;
const CAPTIONS: Record<DemoStep, DrumMessageKey> = {
  0: 'demoHop',
  1: 'demoHop',
  2: 'demoHop',
  3: 'demoAsk',
  4: 'demoTap',
  5: 'demoLand',
};
/** The question in the film is the fourth mushroom. */
const ASK = 3;
const now = () => Date.now() / 1000;

/**
 * A tiny "how to play" film in the game's own pieces: Pom hops two steps of the level's pattern,
 * the next mushroom asks "?", a finger taps the right drum below and Pom lands on it with the
 * step arc. The numbers come from a fixed made-up run, never the round the child will play. It
 * plays once by itself and waits on the last picture; the button plays it again or pauses it.
 */
@Component({
  selector: 'app-drum-demo',
  imports: [DrumPath],
  template: `
    <div class="film" [attr.data-step]="step()" aria-hidden="true">
      <div class="scene"><app-drum-path [frame]="frame()" /></div>
      <div class="chips" [style.--target]="target()">
        @for (choice of choices(); track choice) {
          <span class="chip" [class.right]="step() >= 4 && choice === answer()">{{
            i.format(choice)
          }}</span>
        }
        <svg class="finger" viewBox="0 0 40 50">
          <path
            d="M15 25V7a4.5 4.5 0 0 1 9 0v13l9.5 2.2A5 5 0 0 1 37 27.6L35 40a9 9 0 0 1-9 7.5h-8.6a9 9 0 0 1-7.3-3.8L4 35.4a4 4 0 0 1 6-5.2l5 4.3z"
          />
        </svg>
      </div>
    </div>
    <div class="bar">
      <p class="caption" aria-hidden="true">{{ t(caption()) }}</p>
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
    <p class="sr-only">{{ t('demoSummary') }}</p>
  `,
  styles: `
    :host {
      display: grid;
      gap: 6px;
      width: 100%;
    }
    .film {
      display: grid;
      gap: 8px;
    }
    .scene {
      aspect-ratio: 500 / 280;
      border-radius: var(--radius-surface);
      overflow: hidden;
      background: #17123a;
    }
    .chips {
      position: relative;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
    }
    .chip {
      display: grid;
      place-items: center;
      min-height: 44px;
      border-radius: var(--radius-chip);
      background: var(--violet);
      color: var(--paper);
      font-size: 22px;
      font-weight: 600;
      transition:
        background 0.2s,
        transform 0.2s;
    }
    .chip.right {
      background: var(--gold);
      color: var(--ink);
      transform: scale(1.06);
    }
    .finger {
      position: absolute;
      top: 55%;
      left: calc((var(--target) + 0.5) * 100% / 3 - 14px);
      width: 30px;
      fill: var(--paper);
      stroke: var(--ink);
      stroke-width: 2;
      opacity: 0;
      transition:
        opacity 0.3s,
        translate 0.3s;
    }
    .film[data-step='3'] .finger {
      opacity: 1;
      translate: 0 14px;
    }
    .film[data-step='4'] .finger {
      opacity: 1;
      translate: 0 0;
    }
    .bar {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .caption {
      flex: 1;
      margin: 0;
      font-weight: 600;
      line-height: 1.3;
    }
    .replay {
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      border: 2px solid var(--violet);
      border-radius: 50%;
      background: var(--paper);
      color: var(--violet);
    }
    .replay svg {
      width: 20px;
      height: 20px;
      fill: currentColor;
      stroke: currentColor;
      stroke-width: 2.5;
      stroke-linejoin: round;
      stroke-linecap: round;
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
    :host-context(.calm-motion) .chip,
    :host-context(.calm-motion) .finger {
      transition: none;
    }
    @media (prefers-reduced-motion: reduce) {
      .chip,
      .finger {
        transition: none;
      }
    }
  `,
})
export class DrumDemo {
  protected readonly i = inject(LocaleService);
  readonly stage = input.required<DrumStage>();

  protected readonly step = signal<DemoStep>(0);
  protected readonly playing = signal(false);
  protected readonly caption = computed(() => CAPTIONS[this.step()]);
  /** A fixed run of the level's own pattern: same step, made-up numbers. */
  private readonly run = computed(() => buildVerse(this.stage(), 0, seeded(4242)).slice(0, 5));
  protected readonly answer = computed(() => this.run()[ASK].value);
  protected readonly choices = computed(() => {
    const run = this.run();
    return choicesFor(run[ASK], run[ASK - 1].value, 3, this.i.locale());
  });
  protected readonly target = computed(() => this.choices().indexOf(this.answer()));
  /** Pom stays anchored on the first mushroom; each step is a jump from there along the path. */
  protected readonly frame = computed<DrumFrame>(() => {
    const step = this.step();
    const to = step === 0 ? 0 : step <= 2 ? step : step === 5 ? ASK : 2;
    const t = now();
    return {
      round: 0,
      mushrooms: this.run().map((m, index) => ({
        value: m.value,
        given: index !== ASK,
        fresh: index === 0,
        step: index === 0 ? 0 : m.step,
        solo: false,
      })),
      at: 0,
      hop: to === 0 ? null : { from: to - 1, to, start: t, end: t + 0.4 },
      ask: step === 3 || step === 4 ? ASK : null,
      ring: step === 3 || step === 4 ? { start: t, end: t + 2.5 } : null,
      beat: null,
      now,
      waiting: false,
      held: false,
      stepHint: null,
      layers: 1,
      hits: 0,
      bonks: 0,
      solo: false,
      finished: false,
      paused: false,
    };
  });
  private timer?: ReturnType<typeof setTimeout>;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
    afterNextRender(() => this.play());
  }

  protected t(key: DrumMessageKey) {
    return drumText(this.i.locale(), key);
  }

  protected toggle() {
    if (this.playing()) {
      clearTimeout(this.timer);
      this.playing.set(false);
    } else this.play();
  }

  /** Plays from the start, or from where a pause left it, and stops on Pom's landing. */
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
