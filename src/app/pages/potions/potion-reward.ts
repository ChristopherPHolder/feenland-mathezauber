import { Component, computed, input } from '@angular/core';
import { Icon } from '../../shared/icon';

/** When the first star pops into the card, and the gap to the next one, in seconds. */
const STAR_START = 0.35;
const STAR_STEP = 0.25;

export type PotionRewardKind = 'brewed' | 'perfect' | 'fever' | 'big';

/** Where the sparkles burst on the board, in percent, with their own little delay. */
const SPARKLES = [
  [18, 22, 0],
  [80, 18, 0.12],
  [12, 58, 0.24],
  [88, 52, 0.06],
  [30, 10, 0.3],
  [68, 8, 0.18],
  [50, 34, 0.42],
  [24, 40, 0.36],
  [76, 36, 0.48],
] as const;

/**
 * The burst over the cauldron when a potion brews: a golden glow, sparkles, and a card with
 * the cheer, the stars popping in one by one and the coins won. In 3D it waits for the last
 * bottle to pour in (`waitForPour`). It only shows; the game decides. Screen readers hear the
 * same news from the status line, so it stays hidden from them.
 */
@Component({
  selector: 'app-potion-reward',
  imports: [Icon],
  host: {
    'aria-hidden': 'true',
    '[class.is-big]': "kind() === 'big'",
    '[class.is-3d]': 'waitForPour()',
  },
  styleUrl: './potion-reward.css',
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
      <span class="stars">
        @for (slot of slots; track slot) {
          <app-icon
            kind="star"
            class="star"
            [class.won]="slot <= stars()"
            [style.--at]="starAt(slot) + 's'"
          />
        }
      </span>
      <span class="gain" [style.--at]="gainAt() + 's'">{{ coins() }}</span>
    </div>
  `,
})
export class PotionReward {
  readonly kind = input.required<PotionRewardKind>();
  /** Stars won on this potion, 1 to 3. */
  readonly stars = input.required<number>();
  readonly cheer = input.required<string>();
  /** The coins line, already worded, like "+30 coins". */
  readonly coins = input.required<string>();
  /** True while the 3D cauldron shows the last bottle pouring in before the card. */
  readonly waitForPour = input(false);

  protected readonly slots = [1, 2, 3];
  protected readonly sparkles = SPARKLES;
  protected readonly gainAt = computed(() => STAR_START + this.stars() * STAR_STEP + 0.1);
  protected starAt(slot: number) {
    return STAR_START + (slot - 1) * STAR_STEP;
  }
}
