import { Component, computed, input } from '@angular/core';
import { boardX, BRIDGE, StarFrame } from './star-frame';
import { StarPicture } from './star-picture';

/** Where the falling star's top edge is, as a share of the board: high up, then above Nova. */
const SKY_TOP = 0.08;
const SKY_LOW = 0.5;
const HOVER = 0.35;

/**
 * The night bridge drawn flat: the sky with this level's constellation, the bridge with its
 * posts, Nova with her lantern net and the falling star. It is the picture on the intro and
 * the scene wherever 3D is missing. It lines the bridge up with the slider laid over the
 * board (`BRIDGE`), so it plays the same. Decorative only: the game's slider, buttons and
 * live text carry the same information.
 */
@Component({
  selector: 'app-star-bridge',
  imports: [StarPicture],
  templateUrl: './star-bridge.html',
  styleUrl: './star-bridge.css',
  host: {
    'aria-hidden': 'true',
    '[style.--bridge-left.%]': 'bridge.left * 100',
    '[style.--bridge-right.%]': '(1 - bridge.right) * 100',
    '[style.--bridge-y.%]': 'bridge.y * 100',
    '[class.is-comet]': 'frame().comet',
    '[class.is-finale]': 'frame().finale',
  },
})
export class StarBridge {
  readonly frame = input.required<StarFrame>();
  protected readonly bridge = BRIDGE;
  protected readonly dots = [
    [6, 10],
    [14, 30],
    [22, 6],
    [33, 22],
    [64, 8],
    [72, 28],
    [81, 12],
    [90, 34],
    [95, 6],
    [44, 4],
    [8, 52],
    [92, 56],
  ] as const;
  protected readonly netX = computed(() => boardX(this.frame().net) * 100);
  /** The falling star hangs above Nova's lantern, high up at first and lower as it falls. */
  protected readonly starTop = computed(() => {
    const frame = this.frame();
    const fall = frame.hover ? HOVER : frame.fall;
    return (SKY_TOP + (SKY_LOW - SKY_TOP) * fall) * 100;
  });
  protected readonly trail = computed(() => Math.max(0.12, this.frame().stardust));
  protected readonly pairSpots = computed(() => {
    const frame = this.frame();
    return frame.landed.length === 2 ? frame.landed.map((at) => boardX(at) * 100) : [36, 64];
  });
  protected readonly queue = computed(() =>
    Array.from({ length: this.frame().queued }, (_, index) => index),
  );
  protected readonly landedX = computed(() => boardX(this.frame().landed[0] ?? 0.5) * 100);
}
