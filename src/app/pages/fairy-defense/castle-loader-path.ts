/** One lap of the fairy, in seconds. Every motion repeats a whole number of times per lap. */
export const LAP = 4.8;
const ORBIT = { radius: 2.55, depth: 0.8, height: 2.2, rise: 0.45 };

/**
 * Where the fairy is `phase` laps into her flight (0..1 loops): a wide oval around the gate,
 * dipping and rising twice a lap, passing in front and then behind the towers.
 */
export function fairyPath(phase: number): { x: number; y: number; z: number; lean: number } {
  const a = phase * Math.PI * 2;
  const x = Math.cos(a) * ORBIT.radius;
  const z = Math.sin(a) * ORBIT.radius * ORBIT.depth;
  const y = ORBIT.height + Math.sin(a * 2) * ORBIT.rise;
  // She keeps her wings to the camera and leans into the way she is flying.
  const lean = Math.sin(a) * 0.22;
  return { x, y, z, lean };
}

/** A gem's twinkle from 0 (dim) to 1 (bright): a quick flash once per whole `phase`, offset per gem. */
export function twinkle(phase: number, offset: number): number {
  const p = (((phase + offset) % 1) + 1) % 1;
  const flash = Math.max(0, 1 - Math.abs(p - 0.5) * 6);
  return flash * flash * (3 - 2 * flash);
}
