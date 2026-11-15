/**
 * Where the heron circles while it races Kiki, in the pond's own pixels.
 *
 * It flies a wide loop round the whole pond instead of over Kiki: the left and right ends of
 * the loop lie off the screen, so the heron leaves the view, comes back across the open water
 * above the number pads, leaves again and comes back below them. The loop tightens as time runs
 * out, so early on the heron is mostly away and near the end it is hardly ever gone; its last
 * lap brings it over the middle of the top pass (`heronLapAngle`), where it swoops from.
 */
export interface FlightLayout {
  /** The pond's size in pixels. */
  readonly width: number;
  readonly height: number;
  /** The top of the highest of Kiki and the two pads. */
  readonly padsTop: number;
  /** The bottom of the lowest of Kiki and the two pads. */
  readonly padsBottom: number;
  /** Where the instruction bubble starts, or the bottom of the pond. */
  readonly floor: number;
  /** Half the heron's wingspan on screen. */
  readonly reach: number;
}

export interface FlightPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * How far round its loop the heron is, in radians, at `progress` through a flight of
 * `duration` milliseconds. Its laps get quicker (the last lap takes half as long as the first),
 * and every flight ends at the middle of the top pass, in view and behind Kiki, so the heron
 * always swoops from a spot the child can see and that does not point at either side.
 */
export function heronLapAngle(progress: number, duration: number): number {
  const p = clamp01(progress);
  const laps = Math.max(1, Math.round(duration / 6000));
  const end = Math.PI * 2 * laps + Math.PI / 2;
  // Speeds up evenly from 1 to 2: the integral of (1 + p), scaled so that p = 1 lands on `end`.
  return (end * (p + (p * p) / 2)) / 1.5;
}

/**
 * The heron's screen position at `progress` (0 when it shows up, 1 when it swoops) and at
 * `angle` round its loop. Angle 0 is off the right edge; the loop runs over the top first.
 */
export function heronLoop(progress: number, angle: number, layout: FlightLayout): FlightPoint {
  const { width, height, padsTop, padsBottom, floor, reach } = layout;
  const p = clamp01(progress);
  // Past the side edges far enough for the wings to clear the pads, and further at first.
  const halfWidth = width / 2 + reach * 1.5 + width * 0.45 * (1 - p);
  // The top of the loop runs high through the open water above the pads (Kiki's crest pokes
  // above her button), or along the top edge when that strip is too thin for the heron.
  const top = padsTop >= reach * 1.2 ? padsTop * 0.4 : padsTop - reach * 0.7;
  // The bottom runs between the pads and the instruction when it fits, or out of sight below.
  const gap = floor - padsBottom;
  const bottom = gap > reach * 1.4 ? padsBottom + gap / 2 : height + reach * 1.5;
  // A flattened loop: it turns at the far left and right, out of sight, and runs level across.
  const sin = Math.sin(angle);
  const level = Math.sign(sin) * Math.abs(sin) ** 0.25;
  return {
    x: width / 2 + Math.cos(angle) * halfWidth,
    y: (top + bottom) / 2 - level * ((bottom - top) / 2),
  };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
