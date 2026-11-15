import { Component, computed, input } from '@angular/core';

/** When the first key pops into the card, and the gap to the next one, in seconds. */
export const KEY_START = 0.35;
export const KEY_STEP = 0.25;
/** The coins line rises once the last key has landed. */
export const coinsAt = (keys: number) => KEY_START + Math.max(keys, 1) * KEY_STEP + 0.1;

export type RewardKind = 'opened' | 'perfect' | 'fever' | 'big';

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
 * The burst over the dial when a chest opens: a golden glow, sparkles, and a card with the
 * cheer, the golden keys popping in one by one and the coins won. It only shows; the game
 * decides. Screen readers hear the same news from the status line, so it stays hidden from them.
 */
@Component({
  selector: 'app-lock-reward',
  host: { 'aria-hidden': 'true', '[class.is-big]': "kind() === 'big'" },
  styleUrl: './lock-reward.css',
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
      <span class="keys">
        @for (slot of slots; track slot) {
          <svg
            class="key"
            [class.won]="slot <= keys()"
            [style.--at]="keyAt(slot) + 's'"
            viewBox="0 0 12 24"
          >
            <circle cx="6" cy="5" r="4" />
            <path d="M6 9v13m0-4h4m-4 3h3" />
          </svg>
        }
      </span>
      <span class="gain" [style.--at]="gainAt() + 's'">{{ coins() }}</span>
    </div>
  `,
})
export class LockReward {
  readonly kind = input.required<RewardKind>();
  /** Golden keys won on this chest, 1 to 3. */
  readonly keys = input.required<number>();
  readonly cheer = input.required<string>();
  /** The coins line, already worded, like "+30 coins". */
  readonly coins = input.required<string>();

  protected readonly slots = [1, 2, 3];
  protected readonly sparkles = SPARKLES;
  protected readonly gainAt = computed(() => coinsAt(this.keys()));
  protected keyAt(slot: number) {
    return KEY_START + (slot - 1) * KEY_STEP;
  }
}
