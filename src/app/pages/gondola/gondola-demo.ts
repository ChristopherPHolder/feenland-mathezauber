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
import { gondolaText, GondolaMessageKey } from './gondola-messages';

/** The film's steps: look, the handle slides, the group hops in, the ten rides off, the rest board. */
type DemoStep = 0 | 1 | 2 | 3 | 4;
const STEP_MS = [1300, 1500, 1200, 1500, 2800] as const;
const CAPTIONS: Record<DemoStep, GondolaMessageKey> = {
  0: 'demoLook',
  1: 'demoSlide',
  2: 'demoHop',
  3: 'demoTen',
  4: 'demoRest',
};
/** Where things stand in the film's picture (SVG units). */
const CABIN = { x: 24, y: 58 };
const QUEUE = { x: 176, y: 176, step: 30 };
const seatAt = (seat: number) => ({
  x: CABIN.x + 16 + (seat % 5) * 21,
  y: CABIN.y + 26 + Math.floor(seat / 5) * 28,
});

/**
 * A tiny "how to ride" film in the game's own pieces: a cabin with a few empty seats, a group
 * waiting, the split handle sliding so the right number hop in, the full cabin riding off as a
 * "10" and the rest taking the next cabin. The numbers are made up (9 + 4, or 8 + 5 when the
 * turn on screen is 9 + 4), so it shows how to play without giving an answer away. It plays
 * once by itself and then waits on the last picture; the button plays it again or pauses it.
 */
@Component({
  selector: 'app-gondola-demo',
  template: `
    <svg class="film" viewBox="0 0 320 210" [attr.data-step]="step()" aria-hidden="true">
      <rect class="sky" width="320" height="210" rx="16" />
      <path class="hill" d="M0 150 120 92l90-58 110 40v136H0z" />
      <path class="cable" d="M8 74 312 8" />
      <rect class="deck" x="0" y="186" width="320" height="24" />
      <g class="next-cabin">
        <rect class="body" [attr.x]="cabin.x" [attr.y]="cabin.y" width="122" height="80" rx="18" />
        <rect
          class="glass"
          [attr.x]="cabin.x + 6"
          [attr.y]="cabin.y + 10"
          width="110"
          height="62"
          rx="12"
        />
        @for (seat of seats; track seat.i) {
          <circle
            class="seat"
            [class.is-second]="seat.i >= 5"
            [attr.cx]="seat.x"
            [attr.cy]="seat.y"
            r="8"
          />
          @if (seat.i < rest()) {
            <g class="head" [attr.transform]="'translate(' + seat.x + ' ' + seat.y + ')'">
              <path d="M-4-4-5-15q1-2 3 0l1 10zM4-4l1-11q2-2 3 0l-2 11z" />
              <circle r="6" />
            </g>
          }
        }
      </g>
      <g class="ten-cabin">
        <line
          class="hanger"
          [attr.x1]="cabin.x + 61"
          [attr.y1]="cabin.y - 22"
          [attr.x2]="cabin.x + 61"
          [attr.y2]="cabin.y"
        />
        <rect class="body" [attr.x]="cabin.x" [attr.y]="cabin.y" width="122" height="80" rx="18" />
        <rect
          class="glass"
          [attr.x]="cabin.x + 6"
          [attr.y]="cabin.y + 10"
          width="110"
          height="62"
          rx="12"
        />
        @for (seat of seats; track seat.i) {
          <circle
            class="seat"
            [class.is-second]="seat.i >= 5"
            [class.is-empty]="seat.i >= cabinCount()"
            [attr.cx]="seat.x"
            [attr.cy]="seat.y"
            r="8"
          />
          <g
            class="head"
            [class.is-fresh]="seat.i >= cabinCount()"
            [attr.transform]="'translate(' + seat.x + ' ' + seat.y + ')'"
          >
            <path d="M-4-4-5-15q1-2 3 0l1 10zM4-4l1-11q2-2 3 0l-2 11z" />
            <circle r="6" />
          </g>
        }
        <g class="tag">
          <rect [attr.x]="cabin.x + 40" [attr.y]="cabin.y - 34" width="42" height="26" rx="9" />
          <text [attr.x]="cabin.x + 61" [attr.y]="cabin.y - 20">10</text>
        </g>
      </g>
      @for (bunny of queue(); track bunny.i) {
        <g
          class="bunny"
          [class.is-first]="bunny.first"
          [style.--dx.px]="bunny.dx"
          [style.--dy.px]="bunny.dy"
          [style.--i]="bunny.i"
        >
          <g [attr.transform]="'translate(' + bunny.x + ' ' + queueY + ')'">
            <path class="ear" d="M-6-22-8-38q2-4 5 0l1 15zM6-22l2-16q3-4 5 0l-3 16z" />
            <ellipse class="fur" cx="0" cy="-6" rx="9" ry="9" />
            <circle class="fur" cx="0" cy="-20" r="7" />
            <path class="scarf" d="M-6-14q6 3 12 0v3q-6 3-12 0z" />
          </g>
        </g>
      }
      <g class="handle" [style.--slide.px]="fill() * step3">
        <rect [attr.x]="queueX - 19" [attr.y]="queueY - 48" width="6" height="54" rx="3" />
        <circle [attr.cx]="queueX - 16" [attr.cy]="queueY - 21" r="9" />
      </g>
      <path
        class="finger"
        [style.--slide.px]="fill() * step3"
        [attr.transform]="'translate(' + (queueX - 26) + ' ' + (queueY - 18) + ')'"
        d="M10 18V4a3.5 3.5 0 0 1 7 0v10l7 1.6a4 4 0 0 1 2.8 4.5L25.4 30a7 7 0 0 1-7 5.8H12a7 7 0 0 1-5.6-3L1 26a3 3 0 0 1 4.6-3.9L10 26z"
      />
      <g class="sentence">
        <rect x="162" y="136" width="148" height="34" rx="12" />
        <text x="236" y="154">{{ cabinCount() }} + {{ group() }} → 10 + {{ rest() }}</text>
      </g>
    </svg>
    <div class="controls">
      <p class="caption" aria-hidden="true">{{ t(caption(), { n: fill() }) }}</p>
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
    <p class="sr-only">
      {{ t('demoSummary', { a: cabinCount(), b: group(), n: fill(), r: rest() }) }}
    </p>
  `,
  styleUrl: './gondola-demo.css',
})
export class GondolaDemo {
  private readonly i = inject(LocaleService);
  /** Use the other made-up sum, because the turn on screen is the usual one. */
  readonly alternate = input(false);
  protected readonly step = signal<DemoStep>(0);
  protected readonly playing = signal(false);
  protected readonly caption = computed(() => CAPTIONS[this.step()]);
  protected readonly cabinCount = computed(() => (this.alternate() ? 8 : 9));
  protected readonly group = computed(() => (this.alternate() ? 5 : 4));
  protected readonly fill = computed(() => 10 - this.cabinCount());
  protected readonly rest = computed(() => this.group() - this.fill());
  protected readonly cabin = CABIN;
  protected readonly queueX = QUEUE.x;
  protected readonly queueY = QUEUE.y;
  protected readonly step3 = QUEUE.step;
  protected readonly seats = Array.from({ length: 10 }, (_, i) => ({ i, ...seatAt(i) }));
  /** The waiting group; the first ones carry how far they hop to their empty seats. */
  protected readonly queue = computed(() =>
    Array.from({ length: this.group() }, (_, i) => {
      const x = QUEUE.x + i * QUEUE.step + (i >= this.fill() ? 10 : 0);
      const seat = seatAt(this.cabinCount() + i);
      const first = i < this.fill();
      return { i, x, first, dx: first ? seat.x - x : 0, dy: first ? seat.y + 14 - QUEUE.y : 0 };
    }),
  );
  private timer?: ReturnType<typeof setTimeout>;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
    afterNextRender(() => this.play());
  }

  protected t(key: GondolaMessageKey, values: Record<string, string | number> = {}) {
    return gondolaText(this.i.locale(), key, values);
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
    if (this.step() === 4) this.step.set(0);
    this.playing.set(true);
    const next = () => {
      const step = this.step();
      if (step === 4) {
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
