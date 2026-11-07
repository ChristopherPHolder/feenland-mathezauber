import type { RaceLevel } from './race-questions';
/** How quickly the other racers run. Everyone is always moving; this sets the rivals' pace. */
export type Pace = 'relaxed' | 'normal' | 'fast';
export const paces: readonly Pace[] = ['relaxed', 'normal', 'fast'];
export type RacerId = 'player' | 'cloud' | 'mint' | 'peach';
export const opponents: readonly Exclude<RacerId, 'player'>[] = ['cloud', 'mint', 'peach'];
export const racerIds: readonly RacerId[] = ['player', ...opponents];
export const TRACK_LENGTH = 100;
export const RAINBOW_STREAK = 3;
/**
 * Lumi never stands still: she trots at a cruising speed from the start. Every right answer
 * raises her cruising speed (so a streak snowballs into a gallop) and gives a short sprint; a
 * wrong one makes her stumble, which cuts her speed and holds it down for a moment.
 */
export const CRUISE = 1.5;
export const MIN_SPEED = 0.8;
const GAIN = 0.9;
const RAINBOW_GAIN = 1.4;
export const MAX_SPEED = 7.5;
const SPRINT = 2.5;
const RAINBOW_SPRINT = 4;
/** Units per second a sprint plays out at, so a boost reads as a run, not a jump. */
const DASH_RATE = 14;
/** Speed eases toward its target so a gallop builds up visibly and a stumble bites at once. */
const ACCEL = 4.5;
const BRAKE = 9;
/** Without an answer for a while, Lumi eases back toward her cruising trot. */
const IDLE_MS = 6000;
const IDLE_DECAY_PER_S = 0.3;
export const STUMBLE_MS = 1000;
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
const BASE_SPEED: Readonly<Record<Pace, number>> = { relaxed: 1.8, normal: 2.5, fast: 3.3 };
/** Each rival runs with its own character: one keen, one steady, one dreamy. */
const CHARACTER: Readonly<Record<Exclude<RacerId, 'player'>, number>> = {
  cloud: 1.0,
  mint: 0.88,
  peach: 0.76,
};
/** Rivals surge and ease in their own slow rhythm, so the field keeps shuffling. */
const RHYTHM: Readonly<Record<Exclude<RacerId, 'player'>, { hz: number; phase: number }>> = {
  cloud: { hz: 0.09, phase: 0 },
  mint: { hz: 0.13, phase: 2.1 },
  peach: { hz: 0.11, phase: 4.2 },
};
/** Higher levels mean slower sums, so the rivals ease off a touch to keep races close. */
const LEVEL_EASE: Readonly<Record<RaceLevel, number>> = { 1: 1, 2: 0.95, 3: 0.86, 4: 0.9, 5: 0.9 };
export function createRace(pace: Pace, level: RaceLevel): RaceState {
  return {
    pace,
    level,
    racers: racerIds.map((id) => {
      const speed = id === 'player' ? CRUISE : BASE_SPEED[pace] * CHARACTER[id] * LEVEL_EASE[level];
      return { id, position: 0, dash: 0, speed, target: speed };
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
export function racer(state: Pick<RaceState, 'racers'>, id: RacerId): RacerState {
  return state.racers.find((racer) => racer.id === id)!;
}
/** Rivals never run away or wait up by much: a gentle band keeps the race in reach. */
function rubberBand(state: RaceState, rival: RacerState): number {
  const gap = rival.position - racer(state, 'player').position;
  if (gap > 30) return 0.85;
  if (gap < -30) return 1.15;
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
    let steady: number;
    let sprint = 0;
    if (current.id === 'player') {
      const stumbling = state.stumbleMs > 0;
      if (sinceAnswerMs > IDLE_MS && target > CRUISE)
        target = Math.max(CRUISE, target - (target - CRUISE) * IDLE_DECAY_PER_S * dt);
      if (!stumbling) speed = approach(speed, target, (speed < target ? ACCEL : BRAKE) * dt);
      steady = speed;
      sprint = stumbling ? 0 : Math.min(current.dash, DASH_RATE * dt);
    } else {
      const { hz, phase } = RHYTHM[current.id];
      const wave = 1 + 0.14 * Math.sin(phase + (elapsedMs / 1000) * hz * Math.PI * 2);
      const jitter = 0.96 + random() * 0.08;
      steady = speed * wave * jitter * rubberBand(state, current);
    }
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
export function answer(state: RaceState, correct: boolean): RaceState {
  if (state.done) return state;
  const streak = correct ? state.streak + 1 : 0;
  const rainbow = correct && streak >= RAINBOW_STREAK;
  const racers = state.racers.map((current) => {
    if (current.id !== 'player' || current.finishedAt !== undefined) return current;
    if (!correct)
      return {
        ...current,
        dash: 0,
        target: Math.max(MIN_SPEED, current.target * 0.55),
        speed: Math.max(MIN_SPEED * 0.5, current.speed * 0.3),
      };
    return {
      ...current,
      dash: current.dash + (rainbow ? RAINBOW_SPRINT : SPRINT),
      target: Math.min(MAX_SPEED, current.target + (rainbow ? RAINBOW_GAIN : GAIN)),
    };
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
export function place(state: Pick<RaceState, 'racers'>, id: RacerId): 1 | 2 | 3 | 4 {
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
/** Every racer with its place, leader first; ties keep the lane order. */
export function standings(
  state: Pick<RaceState, 'racers'>,
): readonly { id: RacerId; place: 1 | 2 | 3 | 4 }[] {
  return state.racers
    .map((current) => ({ id: current.id, place: place(state, current.id) }))
    .sort((a, b) => a.place - b.place);
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
