/**
 * The firework night as plain numbers over time, so the 3D lake only has to apply them: how a
 * rocket climbs, how a shell opens, how long the sky stays lit, and the running order of the
 * finale. Everything is a function of seconds, testable without a renderer.
 */
import { clamp01, smooth } from '../../shared/three/motion';

export interface RocketPoint {
  x: number;
  y: number;
  /** Lean in radians, following the path. */
  lean: number;
  /** How bright the rocket's head burns: it swells just before the burst. */
  glow: number;
}

/**
 * How far up the climb a rocket is at `k` (0 launch, 1 burst): it leaves the tube fast and slows
 * to a near stop at the top, the breath before the burst.
 */
export function climb(k: number): number {
  const x = clamp01(k);
  return 1 - (1 - x) ** 3.2;
}

/**
 * Where the rocket is at `k` of its rise from (fromX, fromY) to (toX, toY). It wobbles a little
 * as it climbs (less near the top, where it slows) and its head swells in the last fifth.
 * Writes into `out`, so the frame loop allocates nothing.
 */
export function rocketAt(
  k: number,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  wobble: number,
  out: RocketPoint,
): RocketPoint {
  const x = clamp01(k);
  const up = climb(x);
  // The rocket flies a straight line to the burst and wobbles across it, less as it slows.
  const sway = (at: number) => Math.sin(at * Math.PI * 4.2 + 0.6) * 0.11 * wobble * (1 - at) ** 2;
  out.x = fromX + (toX - fromX) * up + sway(x);
  out.y = fromY + (toY - fromY) * up;
  // The lean follows the sideways speed against the upward speed, a little behind the wobble.
  const ahead = clamp01(x + 0.02);
  const rise = Math.max(0.02, (toY - fromY) * (climb(ahead) - up));
  const drift = (toX - fromX) * (climb(ahead) - up) + sway(ahead) - sway(x);
  out.lean = Math.max(-0.5, Math.min(0.5, -Math.atan2(drift, rise)));
  out.glow = 0.75 + 0.55 * smooth((x - 0.78) / 0.22);
  return out;
}

/** Seconds the sky and the lake stay lit after a burst. */
export const SKY_LIGHT = 1.4;

/**
 * How brightly a burst lights the sky and the water `age` seconds after it opens: up in a tenth
 * of a second, then a long soft fade. Never a cut, so overlapping bursts do not strobe.
 */
export function skyLight(age: number): number {
  if (age < 0 || age >= SKY_LIGHT) return 0;
  if (age < 0.1) return smooth(age / 0.1);
  return 1 - smooth((age - 0.1) / (SKY_LIGHT - 0.1));
}

/** Seconds the pattern takes to open from its centre to its places. */
export const OPEN = 0.6;

/**
 * How far the pattern's sparks have flown from the centre to their places, `age` seconds after
 * the burst: an eased bloom that overshoots a touch and settles, never a snap. Calm motion fades
 * the pattern in where it stands instead.
 */
export function openSpread(age: number, calm: boolean): number {
  if (calm) return 1;
  const x = clamp01(age / OPEN);
  const c = 1.1;
  return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2;
}

/**
 * Where the `index`-th of `count` shape sparks is along its flight out to the outline, `age`
 * seconds after the shape bursts: each leaves a moment after the one before, so the outline draws
 * itself round, and settles with a small overshoot.
 */
export function shapeSpread(age: number, index: number, count: number): number {
  const delay = (index / count) * 0.35;
  const x = clamp01((age - delay) / 0.75);
  const c = 0.9;
  return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2;
}

/** How bright the book shape is `age` seconds after it bursts; it holds long enough to read. */
export function shapeGlow(age: number): number {
  if (age < 0 || age > SHAPE_LIFE) return 0;
  if (age < 0.25) return smooth(age / 0.25);
  if (age < SHAPE_LIFE - 0.9) return 1;
  return 1 - smooth((age - (SHAPE_LIFE - 0.9)) / 0.9);
}

/** Seconds the book shape glows in the sky. */
export const SHAPE_LIFE = 3.2;

export type ShellKind = 'peony' | 'ring' | 'crackle' | 'willow' | 'shape';

/** One shell of the finale: when it bursts, where (as shares of the burst area) and its colour. */
export interface Cue {
  readonly at: number;
  readonly kind: ShellKind;
  /** -1 (left edge of the burst area) to 1 (right edge). */
  readonly x: number;
  /** 0 (bottom of the burst area) to 1 (top). */
  readonly y: number;
  /** Index into the firework colours; -1 for gold. */
  readonly hue: number;
  /** How strongly it lights the sky, 0–1. */
  readonly light: number;
  /** Seconds its rocket climbs before it bursts; 0 under calm motion (it glows in place). */
  readonly rise: number;
}

const FINALE_KINDS: readonly ShellKind[] = ['peony', 'ring', 'crackle', 'peony', 'ring'];

/**
 * The running order of the show at the end of a round, `length` seconds long: one rocket for
 * every firework the child launched, in its own colour, climbing in pairs from both sides; the
 * level's book shape in the middle; a quick salvo; and a golden willow canopy with crackle to
 * close. Under calm motion fewer shells bloom in place, slower, with no salvo.
 */
export function finaleCues(hues: readonly number[], length: number, calm: boolean): Cue[] {
  const cues: Cue[] = [];
  const colours = hues.length ? hues : [0, 1, 2, 3];
  const rise = calm ? 0 : 0.7;
  if (calm) {
    const shown = colours.slice(0, 4);
    shown.forEach((hue, index) =>
      cues.push({
        at: 0.2 + index * 0.5,
        kind: index % 2 ? 'ring' : 'peony',
        x: index % 2 ? 0.55 : -0.55,
        y: 0.35 + (index % 3) * 0.2,
        hue,
        light: 0.35,
        rise,
      }),
    );
    cues.push({ at: 0.6, kind: 'shape', x: 0, y: 0.5, hue: -1, light: 0.3, rise });
    return cues;
  }
  // The child's own fireworks, two by two from both sides.
  const launches = Math.min(colours.length, 12);
  const gap = Math.min(0.26, 1.7 / launches);
  for (let index = 0; index < launches; index++) {
    const side = index % 2 ? 1 : -1;
    const spread = 0.35 + ((index * 0.618) % 1) * 0.6;
    cues.push({
      at: rise + index * gap,
      kind: FINALE_KINDS[index % FINALE_KINDS.length],
      x: side * spread,
      y: 0.3 + ((index * 0.37) % 1) * 0.55,
      hue: colours[index],
      light: 0.45,
      rise,
    });
  }
  const shapeAt = rise + launches * gap + 0.15;
  cues.push({ at: shapeAt, kind: 'shape', x: 0, y: 0.52, hue: -1, light: 0.55, rise: 0 });
  // A quick salvo while the shape hangs, then the willow canopy to close.
  const willowAt = Math.min(length - 1.6, shapeAt + 1.5);
  for (let index = 0; index < 4; index++)
    cues.push({
      at: shapeAt + 0.5 + index * 0.18,
      kind: 'crackle',
      x: [-0.85, 0.85, -0.6, 0.6][index],
      y: 0.75 + (index % 2) * 0.12,
      hue: colours[(index + 1) % colours.length],
      light: 0.25,
      rise: 0.55,
    });
  for (let index = 0; index < 3; index++)
    cues.push({
      at: willowAt + index * 0.12,
      kind: 'willow',
      x: (index - 1) * 0.62,
      y: 0.88 - (index % 2) * 0.06,
      hue: -1,
      light: 0.8,
      rise: 0.6,
    });
  return cues.sort((a, b) => a.at - b.at);
}

/**
 * How brightly the whole sky is lit at `t` seconds by a list of bursts (`at`, `light`): the
 * strongest burst wins and the rest add a little, capped at 1, so a salvo glows rather than
 * flickers.
 */
export function skyLevel(
  t: number,
  bursts: readonly { readonly at: number; readonly light: number }[],
) {
  let most = 0;
  let sum = 0;
  for (const burst of bursts) {
    const level = skyLight(t - burst.at) * burst.light;
    most = Math.max(most, level);
    sum += level;
  }
  return Math.min(1, most + (sum - most) * 0.25);
}
