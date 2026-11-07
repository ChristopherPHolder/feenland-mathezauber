import type { RaceLevel, RaceMode, RaceStage } from './race-questions';
/** How quickly the other racers run. Everyone is always moving; this sets the rivals' pace. */
export type Pace = 'relaxed' | 'normal' | 'fast';
export const paces: readonly Pace[] = ['relaxed', 'normal', 'fast'];
/** Lumi, her three friends, Storm the key thief and Lumi's own shadow. */
export type RacerId = 'player' | 'cloud' | 'mint' | 'peach' | 'storm' | 'shadow';
export const friends: readonly RacerId[] = ['cloud', 'mint', 'peach'];
export const racerIds: readonly RacerId[] = ['player', ...friends, 'storm', 'shadow'];
/** Who lines up for each kind of race, in lane order. */
export const LINEUP: Readonly<Record<RaceMode, readonly RacerId[]>> = {
  race: ['player', 'cloud', 'mint', 'peach'],
  chase: ['player', 'storm'],
  shadow: ['player', 'shadow'],
};
export const RAINBOW_STREAK = 3;
/**
 * Lumi never stands still: she trots at a cruising speed from the start. Every right answer
 * raises her cruising speed (so a streak snowballs into a gallop) and gives a short sprint; a
 * wrong one makes her stumble, which cuts her speed and holds it down for a moment. The gains
 * are small on purpose: a race is won by answering steadily for a minute, not by a quick burst.
 */
export const CRUISE = 1.5;
export const MIN_SPEED = 0.8;
const GAIN = 0.5;
const RAINBOW_GAIN = 0.9;
export const MAX_SPEED = 6;
const SPRINT = 2;
const RAINBOW_SPRINT = 3.5;
/** Units per second a sprint plays out at, so a boost reads as a run, not a jump. */
const DASH_RATE = 14;
/** Speed eases toward its target so a gallop builds up visibly and a stumble bites at once. */
const ACCEL = 4.5;
const BRAKE = 9;
/** Without an answer for a while, Lumi eases back toward her cruising trot. */
const IDLE_MS = 4000;
const IDLE_DECAY_PER_S = 0.6;
export const STUMBLE_MS = 1000;
export const SPARKLES_PER_ANSWER = 10;
export const SPARKLES_RAINBOW = 20;
export const PLACE_BONUS: Readonly<Record<1 | 2 | 3 | 4, number>> = { 1: 50, 2: 30, 3: 15, 4: 5 };
/** Finishing this close behind Storm or the shadow still earns two stars. */
const CLOSE_MS = 5000;
const SHADOW_CLOSE = 1.25;
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
  readonly mode: RaceMode;
  readonly length: number;
  /** A cup final must be won outright. */
  readonly final: boolean;
  /** Shadow races: the time the shadow needs for the whole track. */
  readonly shadowMs?: number;
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
const BASE_SPEED: Readonly<Record<Pace, number>> = { relaxed: 2.0, normal: 3.3, fast: 4.9 };
/** Each rival runs with its own character: one keen, one steady, one dreamy, one sneaky. */
const CHARACTER: Readonly<Record<RacerId, number>> = {
  player: 1,
  cloud: 1.0,
  mint: 0.88,
  peach: 0.76,
  storm: 0.86,
  shadow: 1,
};
/** Rivals surge and ease in their own slow rhythm, so the field keeps shuffling. */
const RHYTHM: Readonly<Record<RacerId, { hz: number; phase: number }>> = {
  player: { hz: 0, phase: 0 },
  cloud: { hz: 0.09, phase: 0 },
  mint: { hz: 0.13, phase: 2.1 },
  peach: { hz: 0.11, phase: 4.2 },
  storm: { hz: 0.1, phase: 1.3 },
  shadow: { hz: 0, phase: 0 },
};
/** Later cups mean slower sums, so the rivals ease off a touch to keep races close. */
const CUP_EASE: Readonly<Record<RaceStage['cup'], number>> = {
  meadow: 1,
  sky: 0.86,
  star: 0.78,
  castle: 0.74,
  rainbow: 0.8,
};
/** Past this fraction of the track the final stretch begins. */
export const FINAL_STRETCH = 0.8;
export function createRace(pace: Pace, stage: RaceStage, bestMs?: number): RaceState {
  const shadowMs =
    stage.mode === 'shadow' ? Math.min(stage.parMs ?? Infinity, bestMs ?? Infinity) : undefined;
  return {
    pace,
    level: stage.stage,
    mode: stage.mode,
    length: stage.length,
    final: stage.final ?? false,
    ...(shadowMs !== undefined ? { shadowMs } : {}),
    racers: LINEUP[stage.mode].map((id) => {
      const speed =
        id === 'player'
          ? CRUISE
          : id === 'shadow'
            ? stage.length / (shadowMs! / 1000)
            : BASE_SPEED[pace] * CHARACTER[id] * CUP_EASE[stage.cup] * stage.rivals;
      const position = id === 'storm' ? Math.round(stage.length * stage.headStart) : 0;
      return { id, position, dash: 0, speed, target: speed };
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
/** Friends never run away or wait up by much; Storm only ever slows a little when far ahead. */
function rubberBand(state: RaceState, rival: RacerState): number {
  const gap = rival.position - racer(state, 'player').position;
  if (rival.id === 'storm') return gap > 45 ? 0.8 : 1;
  if (gap > 40) return 0.85;
  if (gap < -40) return 1.15;
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
    } else if (current.id === 'shadow') {
      // The shadow is a recording: it runs the same time every race, no matter what.
      steady = speed;
    } else {
      const { hz, phase } = RHYTHM[current.id];
      const wave = 1 + 0.14 * Math.sin(phase + (elapsedMs / 1000) * hz * Math.PI * 2);
      const jitter = 0.96 + random() * 0.08;
      steady = speed * wave * jitter * rubberBand(state, current);
    }
    // The shadow is a recording, so it crosses the line exactly on its time, not a hair late.
    const snapped =
      current.id === 'shadow' && state.shadowMs !== undefined && elapsedMs >= state.shadowMs;
    const position = snapped
      ? state.length
      : Math.min(state.length, current.position + steady * dt + sprint);
    return {
      ...current,
      position,
      speed,
      target,
      dash: current.dash - sprint,
      ...(position >= state.length ? { finishedAt: elapsedMs } : {}),
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
/** How far the player is behind (positive) or ahead (negative) of the rival, in track units. */
export function gapTo(state: RaceState, id: RacerId): number {
  return Math.round(racer(state, id).position - racer(state, 'player').position);
}
/**
 * Three stars for a win, two for a close second, one always rewards crossing the line. In a
 * chase, close means within a few seconds of Storm; against the shadow, within a quarter of
 * its time.
 */
export function raceStars(state: RaceState): 1 | 2 | 3 {
  const finish = playerPlace(state);
  if (finish === 1) return 3;
  const me = racer(state, 'player');
  if (state.mode === 'chase') {
    const storm = racer(state, 'storm');
    return me.finishedAt !== undefined &&
      storm.finishedAt !== undefined &&
      me.finishedAt - storm.finishedAt <= CLOSE_MS
      ? 2
      : 1;
  }
  if (state.mode === 'shadow')
    return me.finishedAt !== undefined && me.finishedAt <= state.shadowMs! * SHADOW_CLOSE ? 2 : 1;
  return finish === 2 ? 2 : 1;
}
/**
 * A podium masters an ordinary race; a chase needs the key back and a shadow race a beaten
 * shadow. The castle cup final must be won outright.
 */
export function isMastered(state: RaceState): boolean {
  const finish = playerPlace(state);
  if (state.mode !== 'race' || state.final) return finish === 1;
  return finish <= 2;
}
/** True once Lumi is in the last fifth of the track. */
export function inFinalStretch(state: RaceState): boolean {
  return racer(state, 'player').position >= state.length * FINAL_STRETCH;
}
/** Sparkles at the finish, including the place bonus. */
export function finalSparkles(state: RaceState): number {
  return state.sparkles + PLACE_BONUS[playerPlace(state)];
}
