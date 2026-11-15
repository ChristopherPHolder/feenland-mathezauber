import { Component, input } from '@angular/core';

/** When the first tag pops into the card, and the gap to the next one, in seconds. */
const TAG_START = 0.35;
const TAG_STEP = 0.22;

export type BakeryRewardKind = 'baked' | 'perfect' | 'golden' | 'cake' | 'second';

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
 * The burst over the counter when a tray is baked: a warm glow, sparkles, and a card with the
 * cheer, a tag for each bonus and the points won. It only shows; the game decides. Screen
 * readers hear the same news from the status line, so it stays hidden from them.
 */
@Component({
  selector: 'app-bakery-reward',
  host: {
    'aria-hidden': 'true',
    '[class.is-big]': "kind() === 'cake'",
    '[class.is-golden]': "kind() === 'golden'",
    '[class.is-3d]': 'waitForOven()',
  },
  styleUrl: './bakery-reward.css',
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
      @if (tags().length) {
        <ul class="tags">
          @for (tag of tags(); track tag) {
            <li class="tag" [style.--at]="tagAt($index) + 's'">{{ tag }}</li>
          }
        </ul>
      }
      <span class="gain" [style.--at]="tagAt(tags().length) + 's'">{{ points() }}</span>
    </div>
  `,
})
export class BakeryReward {
  readonly kind = input.required<BakeryRewardKind>();
  readonly cheer = input.required<string>();
  /** Bonus names, already worded: "First try", "Clever trick", "Perfect bake". */
  readonly tags = input<readonly string[]>([]);
  /** The points line, already worded, like "+30 points". */
  readonly points = input.required<string>();
  /** True while the 3D tray is still sliding into the oven before the card. */
  readonly waitForOven = input(false);

  protected readonly sparkles = SPARKLES;
  protected tagAt(index: number) {
    return TAG_START + index * TAG_STEP;
  }
}
