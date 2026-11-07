import type { RaceLevel } from './race-questions';
/** How quickly the other racers run. `off` is turn-based: they only move when you answer. */
export type Pace = 'off' | 'relaxed' | 'normal' | 'fast';
export const paces: readonly Pace[] = ['off', 'relaxed', 'normal', 'fast'];
export type RacerId = 'player' | 'cloud' | 'mint' | 'peach';
export const opponents: readonly Exclude<RacerId, 'player'>[] = ['cloud', 'mint', 'peach'];
export const racerIds: readonly RacerId[] = ['player', ...opponents];
export const TRACK_LENGTH = 100;
export const RAINBOW_STREAK = 3;
/**
 * Timed races: every right answer adds to Lumi's cruising speed (so a streak snowballs into a
 * gallop) and gives a short sprint; a wrong one halves the speed and stops her for a moment.
 */
const GAIN = 1.0;
const RAINBOW_GAIN = 1.5;
const MAX_SPEED = 9;
const SPRINT = 3;
/** Turn-based races move in steps: a correct answer is one unicorn leap. */
export const DASH = 8;
export const RAINBOW_DASH = 12;
/** Units per second a sprint or leap plays out at, so a boost reads as a run, not a jump. */
const DASH_RATE = 18;
/** Speed eases toward its target so a gallop builds up visibly. */
const ACCEL = 7;
/** Without an answer for a while, Lumi slows down again. */
const IDLE_MS = 9000;
const IDLE_DECAY_PER_S = 0.35;
export const STUMBLE_MS = 1100;
export const SPARKLES_PER_ANSWER = 10;
export const SPARKLES_RAINBOW = 20;
export const PLACE_BONUS: Readonly<Record<1 | 2 | 3 | 4, number>> = { 1: 50, 2: 30, 3: 15, 4: 5 };
export interface RacerState {
  readonly id: RacerId;
  readonly position: number;
  /** Track units still to be run as a sprint. */
  readonly dash: number;
  /** Current steady units per second. */
  readonly speed: number;
  /** Steady speed this racer is working toward. */
  readonly target: number;
  readonly finishedAt?: number;
}
export interface RaceState {
  readonly pace: Pace;
  readonly level: RaceLevel;
  readonly racers: readonly RacerState[];
  readonly elapsedMs: number;
  readonly stumbleMs: number;
  readonly sinceAnswerMs: number;
  readonly streak: number;
  readonly correct: number;
  readonly mistakes: number;
  readonly sparkles: number;
  readonly done: boolean;
}
type Random = () => number;
/** Base rival speeds (units per second) per pace, before each rival's character. */
const BASE_SPEED: Readonly<Record<Pace, number>> = { off: 0, relaxed: 2.0, normal: 2.8, fast: 3.8 };
/** Turn-based step the rivals take when the child answers, right or wrong. */
const BASE_STEP = 7.5;
/** Each rival runs with its own character: one keen, one steady, one dreamy. */
const CHARACTER: Readonly<Record<Exclude<RacerId, 'player'>, number>> = {
  cloud: 1.0,
  mint: 0.86,
  peach: 0.72,
};
/** Higher levels mean slower sums, so the rivals ease off a touch to keep races close. */
const LEVEL_EASE: Readonly<Record<RaceLevel, number>> = { 1: 1, 2: 0.95, 3: 0.86, 4: 0.9, 5: 0.9 };
export function createRace(pace: Pace, level: RaceLevel): RaceState {
  return {
    pace,
    level,
    racers: racerIds.map((id) => {
      const speed = id === 'player' ? 0 : BASE_SPEED[pace] * CHARACTER[id] * LEVEL_EASE[level];
      return { id, position: 0, dash: 0, speed: id === 'player' ? 0 : speed, target: speed };
    }),
    elapsedMs: 0,
    stumbleMs: 0,
    sinceAnswerMs: 0,
    streak: 0,
    correct: 0,
    mistakes: 0,
    sparkles: 0,
    done: false,
  };
}
export function racer(state: RaceState, id: RacerId): RacerState {
  return state.racers.find((racer) => racer.id === id)!;
}
/** Rivals never run away or wait up by much: a gentle band keeps the race in reach. */
function rubberBand(state: RaceState, rival: RacerState): number {
  const gap = rival.position - racer(state, 'player').position;
  if (gap > 18) return 0.75;
  if (gap < -18) return 1.2;
  return 1;
}
function approach(value: number, target: number, step: number): number {
  return value < target ? Math.min(target, value + step) : Math.max(target, value - step);
}
/** Advances every racer by `dtMs`; sprints play out at a steady rate on top of the gallop. */
export function tick(state: RaceState, dtMs: number, random: Random = Math.random): RaceState {
  if (state.done || dtMs <= 0) return state;
  const dt = dtMs / 1000;
  const elapsedMs = state.elapsedMs + dtMs;
  const stumbleMs = Math.max(0, state.stumbleMs - dtMs);
  const sinceAnswerMs = state.sinceAnswerMs + dtMs;
  const racers = state.racers.map((current) => {
    if (current.finishedAt !== undefined) return current;
    let target = current.target;
    let speed = current.speed;
    if (current.id === 'player') {
      if (sinceAnswerMs > IDLE_MS) target = Math.max(0, target - target * IDLE_DECAY_PER_S * dt);
      speed = state.stumbleMs > 0 ? 0 : approach(speed, target, ACCEL * dt);
    }
    const jitter = current.id === 'player' ? 1 : 0.85 + random() * 0.3;
    const steady = current.id === 'player' ? speed : speed * jitter * rubberBand(state, current);
    const sprint =
      state.stumbleMs > 0 && current.id === 'player' ? 0 : Math.min(current.dash, DASH_RATE * dt);
    const position = Math.min(TRACK_LENGTH, current.position + steady * dt + sprint);
    return {
      ...current,
      position,
      speed,
      target,
      dash: current.dash - sprint,
      ...(position >= TRACK_LENGTH ? { finishedAt: elapsedMs } : {}),
    };
  });
  const player = racers.find((current) => current.id === 'player')!;
  return {
    ...state,
    racers,
    elapsedMs,
    stumbleMs,
    sinceAnswerMs,
    done: player.finishedAt !== undefined,
  };
}
/** A correct answer speeds the unicorn up; a wrong one makes her stumble and lose pace. */
export function answer(
  state: RaceState,
  correct: boolean,
  random: Random = Math.random,
): RaceState {
  if (state.done) return state;
  const streak = correct ? state.streak + 1 : 0;
  const rainbow = correct && streak >= RAINBOW_STREAK;
  const turnBased = state.pace === 'off';
  const racers = state.racers.map((current) => {
    if (current.finishedAt !== undefined) return current;
    if (current.id === 'player') {
      if (!correct) return { ...current, dash: 0, target: current.target * 0.5, speed: 0 };
      if (turnBased) return { ...current, dash: current.dash + (rainbow ? RAINBOW_DASH : DASH) };
      return {
        ...current,
        dash: current.dash + SPRINT,
        target: Math.min(MAX_SPEED, current.target + (rainbow ? RAINBOW_GAIN : GAIN)),
      };
    }
    if (!turnBased) return current;
    // A hard sum costs no time in a turn-based race, so the level does not ease the step.
    const step = BASE_STEP * CHARACTER[current.id] * (0.8 + random() * 0.4);
    return { ...current, dash: current.dash + step * rubberBand(state, current) };
  });
  return {
    ...state,
    racers,
    streak,
    sinceAnswerMs: 0,
    correct: state.correct + (correct ? 1 : 0),
    mistakes: state.mistakes + (correct ? 0 : 1),
    sparkles: state.sparkles + (correct ? (rainbow ? SPARKLES_RAINBOW : SPARKLES_PER_ANSWER) : 0),
    stumbleMs: correct ? state.stumbleMs : STUMBLE_MS,
  };
}
export function isRainbow(state: RaceState): boolean {
  return state.streak >= RAINBOW_STREAK;
}
/** 1 for the leader; ties go to whoever finished first, then to the player. */
export function place(state: RaceState, id: RacerId): 1 | 2 | 3 | 4 {
  const me = racer(state, id);
  const ahead = state.racers.filter((other) => {
    if (other.id === id) return false;
    if (me.finishedAt !== undefined && other.finishedAt !== undefined)
      return other.finishedAt < me.finishedAt;
    if (other.finishedAt !== undefined) return true;
    if (me.finishedAt !== undefined) return false;
    return other.position > me.position + 0.001;
  }).length;
  return (ahead + 1) as 1 | 2 | 3 | 4;
}
export function playerPlace(state: RaceState): 1 | 2 | 3 | 4 {
  return place(state, 'player');
}
/** Three stars for a win, two for second, one always rewards crossing the line. */
export function raceStars(finish: 1 | 2 | 3 | 4): 1 | 2 | 3 {
  return finish === 1 ? 3 : finish === 2 ? 2 : 1;
}
/** The castle cup (race 5) must be won outright; the other races count a podium as mastered. */
export function isMastered(finish: 1 | 2 | 3 | 4, level: RaceLevel): boolean {
  return level === 5 ? finish === 1 : finish <= 2;
}
/** Sparkles at the finish, including the place bonus. */
export function finalSparkles(state: RaceState): number {
  return state.sparkles + PLACE_BONUS[playerPlace(state)];
}
