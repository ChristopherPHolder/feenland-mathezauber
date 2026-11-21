import { Component, computed, input } from '@angular/core';
import { PicnicFace } from './picnic-face';
import type { FriendKind } from './picnic-friends';

/** Berries on a plate sit in rows of five, so a plate is easy to count by fives. */
const ROW = 5;

/**
 * The berry basket and the plates. Berries leave the basket and land on every plate at once, in
 * rows of five. The last `later` plates are kept for later and wear a little lid. It only shows;
 * the game deals.
 */
@Component({
  selector: 'app-picnic-deal',
  imports: [PicnicFace],
  host: { '[style.--plates]': 'plates().length' },
  template: `
    <div class="basket" role="img" [attr.aria-label]="basketLabel()">
      <svg viewBox="0 0 120 54" aria-hidden="true">
        <path class="handle" d="M22 24q38-34 76 0" />
        <path class="weave" d="M8 22h104l-10 30H18z" />
        @for (berry of basketBerries(); track $index) {
          <circle class="berry" [attr.cx]="berry.x" [attr.cy]="berry.y" r="3.4" />
        }
      </svg>
    </div>
    <ul class="plates">
      @for (plate of plates(); track $index) {
        <li
          class="plate"
          [class.later]="$index >= plates().length - later()"
          [attr.aria-label]="plateLabels()[$index]"
        >
          @if ($index >= plates().length - later()) {
            <svg class="lid" viewBox="0 0 32 32" aria-hidden="true">
              <path d="M4 22q12-16 24 0z" />
              <circle cx="16" cy="9" r="2.5" />
            </svg>
          } @else {
            <app-picnic-face [kind]="guests()[$index]" />
          }
          <svg class="dish" viewBox="0 0 60 60" aria-hidden="true">
            <circle class="rim" cx="30" cy="30" r="28" />
            @for (berry of plateBerries(); track $index) {
              <circle
                class="berry"
                [class.new]="$index >= before()"
                [attr.cx]="berry.x"
                [attr.cy]="berry.y"
                r="3.6"
              />
            }
          </svg>
        </li>
      }
    </ul>
  `,
  styleUrl: './picnic-deal.css',
})
export class PicnicDeal {
  readonly total = input.required<number>();
  /** Berries on each plate now, and before the last handful (for the drop-in). */
  readonly dealt = input.required<number>();
  readonly before = input(0);
  readonly guests = input.required<readonly FriendKind[]>();
  readonly later = input(0);
  readonly basketLabel = input.required<string>();
  readonly plateLabels = input.required<readonly string[]>();

  protected readonly plates = computed(() => this.guests().map(() => this.dealt()));
  protected readonly basketBerries = computed(() => {
    const left = this.total() - this.dealt() * this.guests().length;
    // A heap: rows that get shorter toward the top of the basket.
    return Array.from({ length: Math.max(0, left) }, (_, index) => {
      const perRow = 14;
      const row = Math.floor(index / perRow);
      const col = index % perRow;
      return { x: 17 + col * 6.6 + (row % 2) * 3.3, y: 46 - row * 5.4 };
    });
  });
  protected readonly plateBerries = computed(() => {
    const count = this.dealt();
    const rows = Math.ceil(count / ROW);
    const pitch = rows > 5 ? 6.2 : 8;
    const top = 30 - ((rows - 1) * pitch) / 2;
    return Array.from({ length: count }, (_, index) => ({
      x: 30 - 2 * pitch + (index % ROW) * pitch,
      y: top + Math.floor(index / ROW) * pitch,
    }));
  });
}
