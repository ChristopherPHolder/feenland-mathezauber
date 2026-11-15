import { afterNextRender, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { LocaleService } from '../../core/locale';
import { fireworkText, FireworkMessageKey } from './firework-messages';

/** The film's steps: rest, the rocket rises, the sparks glow, they fade, a tap, the re-bloom. */
type DemoStep = 0 | 1 | 2 | 3 | 4 | 5;
const STEP_MS = [600, 900, 1700, 1100, 1300, 2600] as const;
const CAPTIONS: Record<DemoStep, FireworkMessageKey> = {
  0: 'demoWatch',
  1: 'demoWatch',
  2: 'demoWatch',
  3: 'demoFade',
  4: 'demoTap',
  5: 'demoGroups',
};
/** The made-up firework: a ten-frame with a full row of five and two more. */
const SPARKS = 7;

/**
 * A tiny "how to play" film in the game's own pieces: a rocket rises and bursts into a ten-frame
 * of 7 sparks, they fade, a finger taps 7 on a little spark pad, and the firework blooms again with
 * the five and the two outlined. The numbers are made up, so it shows how to play without giving
 * an answer away. It plays once by itself and then waits on the last picture; the button plays it
 * again or pauses it.
 */
@Component({
  selector: 'app-firework-demo',
  template: `
    <div class="film" [attr.data-step]="step()" aria-hidden="true">
      <div class="sky">
        <span class="rocket"></span>
        <div class="burst">
          <span class="frame"></span>
          @for (cell of cells; track cell) {
            <span class="cell" [class.lit]="cell < sparks" [style.--i]="cell"></span>
          }
          <span class="group five"></span>
          <span class="group more"></span>
        </div>
        <span class="sentence">5 + 2 = 7</span>
      </div>
      <div class="pad">
        @for (n of keys; track n) {
          <span class="key" [class.hit]="n === sparks" [attr.data-tone]="n > 5 ? 1 : 0">{{
            n
          }}</span>
        }
        <svg class="finger" viewBox="0 0 40 50">
          <path
            d="M15 25V7a4.5 4.5 0 0 1 9 0v13l9.5 2.2A5 5 0 0 1 37 27.6L35 40a9 9 0 0 1-9 7.5h-8.6a9 9 0 0 1-7.3-3.8L4 35.4a4 4 0 0 1 6-5.2l5 4.3z"
          />
        </svg>
      </div>
    </div>
    <div class="controls">
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
  styleUrl: './firework-demo.css',
})
export class FireworkDemo {
  private readonly i = inject(LocaleService);
  protected readonly step = signal<DemoStep>(0);
  protected readonly playing = signal(false);
  protected readonly caption = computed(() => CAPTIONS[this.step()]);
  protected readonly cells = Array.from({ length: 10 }, (_, i) => i);
  protected readonly keys = Array.from({ length: 10 }, (_, i) => i + 1);
  protected readonly sparks = SPARKS;
  private timer?: ReturnType<typeof setTimeout>;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
    afterNextRender(() => this.play());
  }

  protected t(key: FireworkMessageKey) {
    return fireworkText(this.i.locale(), key);
  }

  protected toggle() {
    if (this.playing()) {
      clearTimeout(this.timer);
      this.playing.set(false);
    } else this.play();
  }

  /** Plays from the start, or from where a pause left it, and stops on the re-bloom. */
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
