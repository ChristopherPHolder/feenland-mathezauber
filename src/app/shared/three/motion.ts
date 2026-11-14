/** Small easing and motion helpers for the 3D worlds. All take and return plain numbers. */

export const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

/** Smooth start and stop. */
export const smooth = (t: number) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};

/** Fast start, gentle landing. */
export const easeOut = (t: number) => 1 - (1 - clamp01(t)) ** 3;

/** Overshoots a little and settles: good for things popping into place. */
export const easeOutBack = (t: number) => {
  const x = clamp01(t);
  const c = 1.70158;
  return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2;
};

/** A drop that bounces twice before resting, from 0 (start) to 1 (resting). */
export const bounce = (t: number) => {
  const x = clamp01(t);
  if (x < 1 / 2.75) return 7.5625 * x * x;
  if (x < 2 / 2.75) return 7.5625 * (x - 1.5 / 2.75) ** 2 + 0.75;
  if (x < 2.5 / 2.75) return 7.5625 * (x - 2.25 / 2.75) ** 2 + 0.9375;
  return 7.5625 * (x - 2.625 / 2.75) ** 2 + 0.984375;
};

/** Moves `current` toward `target` by a frame-rate independent fraction (`rate` per second). */
export const approach = (current: number, target: number, rate: number, dt: number) =>
  current + (target - current) * (1 - Math.exp(-rate * dt));

/** A shake that dies away over `duration` seconds after `start`; 0 outside it. */
export const shake = (t: number, start: number, duration: number, strength: number) => {
  const age = t - start;
  if (age < 0 || age > duration) return 0;
  const fade = 1 - age / duration;
  return Math.sin(age * 55) * strength * fade * fade;
};

/**
 * Watches a counter (right answers, mistakes, placed bricks) and reports when it goes up, so a
 * world can play a burst once per event. The first value only syncs, so a rebuilt world does
 * not replay old events.
 */
export class EventCounter {
  private seen: number | undefined;
  /** Returns how many new events happened since the last call. */
  take(value: number): number {
    if (this.seen === undefined || value < this.seen) {
      this.seen = value;
      return 0;
    }
    const fresh = value - this.seen;
    this.seen = value;
    return fresh;
  }
}
