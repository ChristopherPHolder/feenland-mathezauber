import type { Pattern } from './firework-levels';
import type { BookShape } from './firework-shapes';

/**
 * Where one firework is:
 * - `launch`: the rocket rises (skipped under calm motion)
 * - `look`: the burst glows for the look time
 * - `fade`: it dims away smoothly
 * - `gone`: the sky is dark again and the pad waits; there is no time limit
 * - `bloom`: right! The pattern re-blooms bigger with its groups outlined
 * - `fizzle`: not quite; a soft fizzle before the same pattern bursts again
 * - `show`: the round is over and every firework of the round goes up together
 */
export type FireworkPhase =
  | 'idle'
  | 'launch'
  | 'look'
  | 'fade'
  | 'gone'
  | 'bloom'
  | 'fizzle'
  | 'show';

/** What the lakeside scene draws: plain state from the game, never decisions. */
export interface FireworkFrame {
  /** Which firework of the round this is, from 0; the grand finale is the last. */
  readonly firework: number;
  readonly pattern: Pattern;
  readonly phase: FireworkPhase;
  /** How long the current burst holds, in seconds. */
  readonly look: number;
  /** Draw the group outlines on the burst (after a second miss, and on the re-bloom). */
  readonly outlines: boolean;
  readonly bigShow: boolean;
  readonly finale: boolean;
  /** The level's shape for the book: it blooms with the finale and in the show. */
  readonly shape: BookShape;
  /** The colours of the fireworks launched so far this round, for the show at the end. */
  readonly launched: readonly number[];
  /** Counters that go up once per event, so the scene can play it once. */
  readonly launches: number;
  readonly bursts: number;
  readonly blooms: number;
  readonly fizzles: number;
  readonly peeks: number;
  readonly shows: number;
}

/** Seconds a rocket takes to rise. */
export const RISE = 0.9;
/** Seconds a burst takes to glow up, and to dim away after its look. */
export const FADE_IN = 0.3;
export const FADE_OUT = 0.7;
/** Seconds the fizzle plays before the same pattern bursts again. */
export const FIZZLE = 1.4;
/** Seconds the re-bloom plays before "how did you see it?" settles. */
export const BLOOM = 1.6;
/** Seconds the show at the end of a round lasts. */
export const SHOW = 5;

const smooth = (t: number) => {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
};

/**
 * How bright a burst is `age` seconds after it starts, from 0 to 1: it glows up, holds for the
 * look, then dims along a smooth curve. Nothing cuts in or out, so nothing strobes.
 */
export function sparkGlow(age: number, look: number): number {
  if (age < 0) return 0;
  if (age < FADE_IN) return smooth(age / FADE_IN);
  if (age < look) return 1;
  return 1 - smooth((age - look) / FADE_OUT);
}

/**
 * Counts flashes in a brightness trace sampled every `step` seconds, the WCAG way: a flash is a
 * pair of opposing changes in brightness, each at least `threshold` of the full range. Returns the
 * most flashes (rounded up, to be strict) that start inside any one second.
 */
export function flashesPerSecond(trace: readonly number[], step: number, threshold = 0.1): number {
  // The turning points: where the trace stops rising and starts falling, or the other way.
  const turns: { at: number; value: number }[] = [{ at: 0, value: trace[0] ?? 0 }];
  let dir = 0;
  for (let i = 1; i < trace.length; i++) {
    const now = Math.sign(trace[i] - trace[i - 1]);
    if (now === 0) continue;
    if (dir !== 0 && now !== dir) turns.push({ at: (i - 1) * step, value: trace[i - 1] });
    dir = now;
  }
  turns.push({ at: (trace.length - 1) * step, value: trace.at(-1) ?? 0 });
  // The changes between turning points that are big enough to count.
  const changes = turns
    .slice(1)
    .filter((turn, i) => Math.abs(turn.value - turns[i].value) >= threshold)
    .map((turn) => turn.at);
  let most = 0;
  for (let i = 0; i < changes.length; i++) {
    let count = 0;
    for (let j = i; j < changes.length && changes[j] - changes[i] < 1; j++) count++;
    most = Math.max(most, Math.ceil(count / 2));
  }
  return most;
}
