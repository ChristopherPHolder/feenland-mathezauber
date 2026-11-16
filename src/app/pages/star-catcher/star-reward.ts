import { Component, input } from '@angular/core';
import { Icon } from '@feenland/ui';
import type { ConstellationId } from './star-constellations';
import { StarPicture } from './star-picture';

/** Where the sparkles burst around the card, in percent, with their own little delay. */
const SPARKLES = [
  [10, 16, 0],
  [88, 12, 0.15],
  [6, 62, 0.3],
  [92, 58, 0.08],
  [26, 6, 0.4],
  [72, 4, 0.22],
  [50, 2, 0.5],
] as const;

/**
 * The finish card's picture: the round's constellation drawing itself line by line in a night
 * sky, Nova cheering under it with her lantern up, and the round's stars popping in. It only
 * shows; the outcome copy beside it says the same in text, so it stays hidden from screen
 * readers.
 */
@Component({
  selector: 'app-star-reward',
  imports: [Icon, StarPicture],
  host: { 'aria-hidden': 'true' },
  template: `
    <div class="sky">
      @for (sparkle of sparkles; track $index) {
        <span
          class="sparkle"
          [style.left.%]="sparkle[0]"
          [style.top.%]="sparkle[1]"
          [style.--at]="sparkle[2] + 's'"
        ></span>
      }
      <app-star-picture class="picture" [id]="constellation()" [complete]="true" [drawing]="true" />
      <svg class="nova" viewBox="0 0 80 120">
        <ellipse class="wing" cx="22" cy="52" rx="17" ry="24" transform="rotate(-30 22 52)" />
        <ellipse class="wing" cx="52" cy="52" rx="17" ry="24" transform="rotate(30 52 52)" />
        <path class="pole" d="M48 60 62 8" />
        <circle class="glow" cx="63" cy="7" r="14" />
        <circle class="lantern" cx="63" cy="7" r="6" />
        <path class="arm" d="M30 58 18 40" />
        <path class="dress" d="M37 52 18 104h40z" />
        <path class="legs" d="M31 104v12M45 104v12" />
        <circle class="head" cx="37" cy="36" r="13" />
        <path class="hair" d="M24 36q0-17 14-16 13 1 13 15-7-8-15-7-6 1-12 8z" />
        <path class="eyes" d="M31 37q2-2 4 0M39 37q2-2 4 0" />
        <path class="smile" d="M33 42q4 5 8 0" />
      </svg>
    </div>
    <p class="drew">{{ drew() }}</p>
    <span class="stars">
      @for (slot of slots; track slot) {
        <ui-icon
          kind="star"
          class="star"
          [class.won]="slot <= stars()"
          [style.--at]="0.9 + slot * 0.25 + 's'"
        />
      }
    </span>
  `,
  styleUrl: './star-reward.css',
})
export class StarReward {
  readonly constellation = input.required<ConstellationId>();
  readonly stars = input.required<number>();
  /** "You drew the cat in the sky!" */
  readonly drew = input.required<string>();
  protected readonly slots = [1, 2, 3];
  protected readonly sparkles = SPARKLES;
}
