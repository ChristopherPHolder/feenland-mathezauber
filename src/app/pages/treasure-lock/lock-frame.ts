/** Everything the dial scenes (2D and 3D) draw. They only draw; the game decides. */
export interface LockFrame {
  readonly lock: number;
  readonly max: number;
  readonly start: number;
  readonly target: number;
  /** The number Pip sits on. */
  readonly value: number;
  readonly thorns: readonly number[];
  /** The gem still lying on the dial, or null. */
  readonly gem: number | null;
  readonly opened: boolean;
  readonly big: boolean;
  readonly fever: boolean;
  readonly crystal: 'none' | 'shining' | 'faded';
  /** Counters that go up once per event, so a scene can play a burst. */
  readonly hops: number;
  readonly pricks: number;
  readonly gems: number;
}

/** The dial runs clockwise from bottom left (0) to bottom right (max), leaving a gap for the chest. */
export const DIAL_SWEEP = 270;

/** Angle of a number on the dial in degrees, clockwise from straight up. */
export function dialDegrees(value: number, max: number): number {
  return -DIAL_SWEEP / 2 + (DIAL_SWEEP * value) / max;
}

/** Which numbers carry a printed label. */
export function labelStep(max: number): number {
  return max <= 20 ? 1 : max <= 50 ? 5 : 10;
}

export function dialNumbers(max: number): number[] {
  return Array.from({ length: max + 1 }, (_, value) => value);
}
