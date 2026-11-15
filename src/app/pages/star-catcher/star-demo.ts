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
import { starText, StarMessageKey } from './star-messages';

/**
 * The film's steps: rest, a star falls with its number, the finger slides Nova along the
 * bridge, the finger taps Catch!, the star drops into the net, and it flies up into the picture.
 */
type DemoStep = 0 | 1 | 2 | 3 | 4 | 5;
const STEP_MS = [600, 1400, 1700, 1100, 1300, 2200] as const;
const CAPTIONS: Record<DemoStep, StarMessageKey> = {
  0: 'demoStar',
  1: 'demoStar',
  2: 'demoSlide',
  3: 'demoCatch',
  4: 'demoCaught',
  5: 'demoCaught',
};

/**
 * A tiny "how to catch" film in the game's own pieces: a star with a number falls toward a
 * little bridge, a finger slides Nova to where the number lives and taps Catch!, the star drops
 * into her net and flies up to light a point of the picture. The bridge is the level's own
 * (0 to 10, 20, 100 or 1000) and the number is made up, so it shows how to play without
 * answering any real star. It plays once by itself and waits on the last picture; the button
 * plays it again or pauses it.
 */
@Component({
  selector: 'app-star-demo',
  template: `
    <div class="film" [attr.data-step]="step()" aria-hidden="true">
      <span class="picture-dot one"></span>
      <span class="picture-dot two"></span>
      <span class="picture-dot three"></span>
      <span class="picture-line"></span>
      <div class="bridge">
        <span class="post start"><span>0</span></span>
        <span class="post middle"
          ><span>{{ format(max() / 2) }}</span></span
        >
        <span class="post end"
          ><span>{{ format(max()) }}</span></span
        >
      </div>
      <div class="nova">
        <svg viewBox="0 0 80 120">
          <ellipse class="wing" cx="24" cy="50" rx="17" ry="24" transform="rotate(-24 24 50)" />
          <ellipse class="wing" cx="50" cy="50" rx="17" ry="24" transform="rotate(24 50 50)" />
          <path class="pole" d="M52 64 70 18" />
          <path class="net" d="M58 10q12-10 24 0l-6 18h-12z" />
          <circle class="lantern" cx="70" cy="16" r="6" />
          <path class="dress" d="M37 52 18 104h40z" />
          <path class="legs" d="M31 104v12M45 104v12" />
          <circle class="head" cx="37" cy="36" r="13" />
          <path class="hair" d="M24 36q0-17 14-16 13 1 13 15-7-8-15-7-6 1-12 8z" />
        </svg>
      </div>
      <div class="star">
        <svg viewBox="0 0 40 40">
          <path
            d="m20 2 5.3 11.6 12.7 1.4-9.4 8.6 2.6 12.4L20 29.7 8.8 36l2.6-12.4L2 15l12.7-1.4z"
          />
        </svg>
        <span class="label">{{ format(number()) }}</span>
      </div>
      <span class="gain">+20</span>
      <span class="catch">{{ t('catch') }}</span>
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
  styleUrl: './star-demo.css',
})
export class StarDemo {
  private readonly i = inject(LocaleService);
  /** The far end of the level's bridge, so the film shows the bridge the child will see. */
  readonly max = input(10);

  protected readonly step = signal<DemoStep>(0);
  protected readonly playing = signal(false);
  protected readonly caption = computed(() => CAPTIONS[this.step()]);
  /** Which numbered step the caption is on: slide, catch, then the picture. */
  protected readonly stepNumber = computed(() => {
    const step = this.step();
    return step <= 2 ? 1 : step === 3 ? 2 : 3;
  });
  /** A made-up number four fifths of the way along: 8, 16, 80 or 800. */
  protected readonly number = computed(() => (this.max() * 4) / 5);
  private timer?: ReturnType<typeof setTimeout>;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
    afterNextRender(() => this.play());
  }

  protected t(key: StarMessageKey) {
    return starText(this.i.locale(), key);
  }
  protected format(value: number) {
    return this.i.format(value);
  }

  protected toggle() {
    if (this.playing()) {
      clearTimeout(this.timer);
      this.playing.set(false);
    } else this.play();
  }

  /** Plays from the start, or from where a pause left it, and stops on the lit picture. */
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
