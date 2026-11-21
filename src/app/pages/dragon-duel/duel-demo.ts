import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { DragonFace } from '@feenland/ui';
import { LocaleService } from '../../core/locale';
import { DAY_DRAGONS } from '../hatchery/dragons';
import { SPRITE_LOOKS } from './duel-looks';
import { duelText, DuelMessageKey } from './duel-messages';

/**
 * The film's steps: rest, the finger finds the answer, the dragon attacks, the sprite charges,
 * it zaps a heart, one more attack, and the sprite pops.
 */
type DemoStep = 0 | 1 | 2 | 3 | 4 | 5 | 6;
const LAST: DemoStep = 6;
const STEP_MS = [700, 1300, 1500, 1900, 1400, 1300, 2200] as const;
const CAPTIONS: Record<DemoStep, DuelMessageKey> = {
  0: 'demoTap',
  1: 'demoTap',
  2: 'demoAttack',
  3: 'demoCharge',
  4: 'demoCharge',
  5: 'demoWin',
  6: 'demoWin',
};
/** Two made-up sums; the coach shows the other one when the duel on screen asks the first. */
const FILMS = [
  { text: '4 + 3', choices: [5, 7, 6, 8], right: 1 },
  { text: '6 + 2', choices: [9, 7, 8, 6], right: 2 },
] as const;

/**
 * A tiny "how to duel" film in the game's own pieces: a finger taps the right answer of a
 * made-up sum, a fire ball knocks the sprite's energy down, the sprite charges and zaps a
 * heart, and one more attack empties its energy. It plays once by itself and then waits on the
 * last picture; the button plays it again or pauses it.
 */
@Component({
  selector: 'app-duel-demo',
  imports: [DragonFace],
  template: `
    <div class="film" [attr.data-step]="step()" aria-hidden="true">
      <div class="arena">
        <div class="side dragon">
          <span class="hearts"
            ><i class="heart"></i><i class="heart"></i><i class="heart lost"></i
          ></span>
          <ui-dragon-face [colors]="ember" />
        </div>
        <span class="fireball"></span>
        <svg class="bolt" viewBox="0 0 100 30" preserveAspectRatio="none">
          <path d="M98 8 70 22 50 6 28 24 2 10" />
        </svg>
        <div class="side sprite">
          <span class="energy"><span class="fill"></span></span>
          <svg viewBox="0 0 100 100" class="sprite-body">
            <ellipse cx="50" cy="56" rx="40" ry="38" [attr.fill]="look.body" />
            <ellipse cx="50" cy="68" rx="24" ry="17" [attr.fill]="look.belly" />
            <circle cx="37" cy="48" r="9" fill="#fffefc" />
            <circle cx="63" cy="48" r="9" fill="#fffefc" />
            <circle cx="38" cy="50" r="5" fill="#2a2148" />
            <circle cx="62" cy="50" r="5" fill="#2a2148" />
            <path d="M28 34l16 5M72 34l-16 5" stroke="#2a2148" stroke-width="4" />
            <path d="M40 66q10 8 20 0" stroke="#2a2148" stroke-width="4" fill="none" />
          </svg>
          <span class="charge"><span class="fill"></span></span>
        </div>
      </div>
      <p class="sum">{{ film().text }} = ?</p>
      <div class="answers">
        @for (choice of film().choices; track $index) {
          <span class="answer" [class.right]="$index === film().right">{{ choice }}</span>
        }
      </div>
      <svg class="finger" viewBox="0 0 40 50" [style.--col]="film().right">
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
  styleUrl: './duel-demo.css',
})
export class DuelDemo {
  private readonly i = inject(LocaleService);
  /** The duel on screen asks the film's usual sum: show the other one. */
  readonly alternate = input(false);

  protected readonly ember = DAY_DRAGONS[0];
  protected readonly look = SPRITE_LOOKS.pebble;
  protected readonly film = computed(() => FILMS[this.alternate() ? 1 : 0]);
  protected readonly step = signal<DemoStep>(0);
  protected readonly playing = signal(false);
  protected readonly caption = computed(() => CAPTIONS[this.step()]);
  /** 1 while answering and attacking, 2 while the sprite charges and zaps, 3 for the win. */
  protected readonly stepNumber = computed(() => {
    const step = this.step();
    return step <= 2 ? 1 : step <= 4 ? 2 : 3;
  });
  private timer?: ReturnType<typeof setTimeout>;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
    afterNextRender(() => this.play());
  }

  protected t(key: DuelMessageKey) {
    return duelText(this.i.locale(), key);
  }

  protected toggle() {
    if (this.playing()) {
      clearTimeout(this.timer);
      this.playing.set(false);
    } else this.play();
  }

  /** Plays from the start, or from where a pause left it, and stops on the won duel. */
  private play() {
    clearTimeout(this.timer);
    if (this.step() === LAST) this.step.set(0);
    this.playing.set(true);
    const next = () => {
      const step = this.step();
      if (step === LAST) {
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
