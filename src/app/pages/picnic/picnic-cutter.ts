import { Component, computed, input, output } from '@angular/core';
import { pieceSizes, TICKS } from './fractions';
import { PicnicFood } from './picnic-food';
import { Food, roundFood } from './picnic-levels';

/** How far outside the rim the round marks sit, in drawing units of a 100-wide pie. */
const RING = 54;

/**
 * The food to cut, with a tap target at every cut mark: around the rim of a pie or cake, and as
 * a tall band at every mark along a bar or ribbon. Tapping a mark cuts there; tapping a cut
 * takes it away. Given cuts (and a pie's top cut) are drawn but not offered. It only shows and
 * reports taps; the game keeps the cuts.
 */
@Component({
  selector: 'app-picnic-cutter',
  imports: [PicnicFood],
  host: {
    '[class.round]': 'round()',
    '[class.wobble-a]': 'wobble() > 0 && wobble() % 2 === 1',
    '[class.wobble-b]': 'wobble() > 0 && wobble() % 2 === 0',
    '[attr.data-food]': 'food()',
  },
  template: `<div
    class="board"
    role="group"
    [attr.aria-label]="groupLabel()"
    [attr.aria-describedby]="describedBy()"
  >
    <app-picnic-food class="food" [food]="food()" [sizes]="sizes()" />
    @if (round()) {
      <svg class="marks" viewBox="-12 -12 124 124" aria-hidden="true">
        <line class="given" x1="50" y1="50" x2="50" y2="6" />
        @for (mark of given(); track mark) {
          <line class="given" x1="50" y1="50" [attr.x2]="spot(mark).x" [attr.y2]="spot(mark).y" />
        }
      </svg>
    }
    @for (mark of marks(); track mark) {
      <button
        type="button"
        class="mark"
        [class.cut]="cuts().includes(mark)"
        [attr.aria-pressed]="cuts().includes(mark)"
        [attr.aria-label]="labels()[mark - 1]"
        [style.left.%]="place(mark).left"
        [style.top.%]="place(mark).top"
        [style.--turn]="mark / ticks + 'turn'"
        [disabled]="disabled()"
        (click)="toggle.emit(mark)"
      >
        <span class="notch"></span>
      </button>
    }
  </div>`,
  styleUrl: './picnic-cutter.css',
})
export class PicnicCutter {
  readonly food = input.required<Food>();
  readonly cuts = input.required<readonly number[]>();
  readonly preset = input<readonly number[]>([]);
  /** One label per mark, 1 … 11: "Cut at mark 3". */
  readonly labels = input.required<readonly string[]>();
  readonly groupLabel = input('');
  readonly describedBy = input<string | null>(null);
  readonly disabled = input(false);
  /** Goes up after each uneven share, to shake the pieces. */
  readonly wobble = input(0);
  readonly toggle = output<number>();

  protected readonly ticks = TICKS;
  protected readonly round = computed(() => roundFood(this.food()));
  protected readonly sizes = computed(() =>
    pieceSizes(this.round() ? 'round' : 'strip', this.cuts()).map((size) => size / TICKS),
  );
  protected readonly marks = computed(() =>
    Array.from({ length: TICKS - 1 }, (_, index) => index + 1).filter(
      (mark) => !this.preset().includes(mark),
    ),
  );
  protected readonly given = computed(() => this.preset().filter((mark) => mark > 0));

  protected spot(mark: number) {
    const angle = (mark / TICKS) * Math.PI * 2 - Math.PI / 2;
    return { x: 50 + Math.cos(angle) * 44, y: 50 + Math.sin(angle) * 44 };
  }

  /** Where a mark's tap target sits, in percent of the board. */
  protected place(mark: number) {
    if (this.round()) {
      const angle = (mark / TICKS) * Math.PI * 2 - Math.PI / 2;
      // The board is the pie's box widened by 12 units each side (124 wide).
      return {
        left: ((50 + Math.cos(angle) * RING + 12) / 124) * 100,
        top: ((50 + Math.sin(angle) * RING + 12) / 124) * 100,
      };
    }
    return { left: (4 + (112 * mark) / TICKS) / 1.2, top: 50 };
  }
}
