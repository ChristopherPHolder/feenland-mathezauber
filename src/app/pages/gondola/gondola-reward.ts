import { Component, input } from '@angular/core';

export type GondolaRewardKind = 'ride' | 'first' | 'golden' | 'big';

/** Where the snow sparkles burst on the board, in percent, with their own little delay. */
const SPARKLES = [
  [16, 20, 0],
  [82, 16, 0.12],
  [10, 56, 0.24],
  [90, 50, 0.06],
  [30, 10, 0.3],
  [68, 8, 0.18],
  [50, 30, 0.42],
  [22, 38, 0.36],
  [78, 34, 0.48],
] as const;

/**
 * The burst over the station when a cabin is delivered: a glow, sparkles, and a card with the
 * cheer, the points won and a badge for each bonus. In 3D it waits a moment for the cabin to
 * leave (`waitForRide`). It only shows; the game decides. Screen readers hear the same news
 * from the status line, so it stays hidden from them.
 */
@Component({
  selector: 'app-gondola-reward',
  host: {
    'aria-hidden': 'true',
    '[class.is-golden]': "kind() === 'golden'",
    '[class.is-big]': "kind() === 'big'",
    '[class.is-3d]': 'waitForRide()',
  },
  styleUrl: './gondola-reward.css',
  template: `
    <span class="glow"></span>
    @for (sparkle of sparkles; track $index) {
      <span
        class="sparkle"
        [style.left.%]="sparkle[0]"
        [style.top.%]="sparkle[1]"
        [style.--at]="sparkle[2] + 's'"
      ></span>
    }
    <div class="card">
      <span class="rays"></span>
      <strong class="cheer">{{ cheer() }}</strong>
      <span class="gain">{{ points() }}</span>
      @if (badges().length) {
        <span class="badges">
          @for (badge of badges(); track badge) {
            <span class="badge" [style.--at]="0.5 + $index * 0.15 + 's'">{{ badge }}</span>
          }
        </span>
      }
    </div>
  `,
})
export class GondolaReward {
  readonly kind = input.required<GondolaRewardKind>();
  readonly cheer = input.required<string>();
  /** The points line, already worded, like "+35 points". */
  readonly points = input.required<string>();
  /** Short bonus lines: first try, warm cocoa, VIP, clever trick. */
  readonly badges = input<readonly string[]>([]);
  /** True while the 3D cabin rides off before the card. */
  readonly waitForRide = input(false);
  protected readonly sparkles = SPARKLES;
}
