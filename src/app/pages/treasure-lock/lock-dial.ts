import { Component, computed, input } from '@angular/core';
import { dialDegrees, dialNumbers, LockFrame, labelStep } from './lock-frame';

const CENTER = 200;
const RING = 150;

/**
 * The flat dial: a ring of numbers, the keyhole, gems and thorns, Pip the firefly and the chest.
 * Decorative only (the game states everything in text); also the fallback for the 3D world.
 */
@Component({
  selector: 'app-lock-dial',
  templateUrl: './lock-dial.html',
  styleUrl: './lock-dial.css',
  host: {
    'aria-hidden': 'true',
    '[class.is-opened]': 'frame().opened',
    '[class.is-big]': 'frame().big',
    '[class.is-fever]': 'frame().fever',
  },
})
export class LockDial {
  readonly frame = input.required<LockFrame>();
  protected readonly center = CENTER;
  protected readonly ticks = computed(() => {
    const { max } = this.frame();
    const step = labelStep(max);
    return dialNumbers(max).map((value) => {
      const major = value % step === 0;
      return {
        value,
        major,
        line: this.radial(value, major ? RING - 16 : RING - 9, RING + 6),
        label: major ? this.at(value, RING + 26) : null,
      };
    });
  });
  protected readonly ringPath = computed(() => {
    const from = this.at(0, RING);
    const to = this.at(this.frame().max, RING);
    return `M${from.x} ${from.y}A${RING} ${RING} 0 1 1 ${to.x} ${to.y}`;
  });
  protected readonly keyhole = computed(() => this.at(this.frame().target, RING));
  protected readonly gem = computed(() => {
    const gem = this.frame().gem;
    return gem === null ? null : this.at(gem, RING);
  });
  protected readonly thorns = computed(() =>
    this.frame().thorns.map((thorn) => ({ value: thorn, ...this.at(thorn, RING) })),
  );
  protected readonly pipAngle = computed(() => dialDegrees(this.frame().value, this.frame().max));
  /** Alternates each hop so the bounce animation restarts. */
  protected readonly hopPhase = computed(() => (this.frame().hops % 2 ? 'a' : 'b'));
  protected readonly coins = [0, 1, 2, 3, 4, 5, 6, 7];

  private at(value: number, radius: number) {
    const angle = (dialDegrees(value, this.frame().max) * Math.PI) / 180;
    return {
      x: +(CENTER + radius * Math.sin(angle)).toFixed(1),
      y: +(CENTER - radius * Math.cos(angle)).toFixed(1),
    };
  }

  private radial(value: number, inner: number, outer: number) {
    const a = this.at(value, inner);
    const b = this.at(value, outer);
    return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
  }
}
