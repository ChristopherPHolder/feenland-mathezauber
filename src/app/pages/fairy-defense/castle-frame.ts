import type { Battle, Phase } from './battle';

/**
 * Everything the 3D battlefield needs to draw one moment of a wave. The game decides; the world
 * only reads this plain state and reacts when `turn` or `phase` changes.
 */
export interface CastleFrame {
  readonly started: boolean;
  readonly paused: boolean;
  readonly phase: Phase;
  /** One attempt at one creature: a new value means a new cast, answer or creature. */
  readonly turn: string;
  readonly boss: boolean;
  readonly encounter: number;
  readonly encounters: number;
  /** Which painting the creature in front wears, e.g. `monster-red` or `boss`. */
  readonly appearance: string;
  /** The creature waiting behind it, or null when it is the last one. */
  readonly waiting: string | null;
  /** Steps the creature has taken toward the castle: 0, 1 or 2. */
  readonly approach: number;
  readonly hearts: number;
  /** The last mistake reached the gate and cost a heart. */
  readonly damaged: boolean;
  /** The gem being cast, which picks its colour; null before the first cast. */
  readonly spell: number | null;
  /** First-try answers in a row at the end of the wave so far. */
  readonly streak: number;
  /** What the creature's badge shows: "?" for a sum, or the creature's number. */
  readonly badge: string;
  /** From 0 (plenty of time, or no timer) to 1 (time is up). */
  readonly pressure: number;
}

/** First-try answers in a row, counted back from the latest one. */
export function streakOf(independent: readonly boolean[]): number {
  let streak = 0;
  for (let index = independent.length - 1; index >= 0 && independent[index]; index--) streak++;
  return streak;
}

export function castleFrame(
  battle: Battle,
  options: { started: boolean; paused: boolean; badge: string; pressure?: number },
): CastleFrame {
  const { wave, encounter } = battle;
  const active = wave.encounters[encounter];
  const next = wave.encounters[encounter + 1];
  return {
    started: options.started,
    paused: options.paused,
    phase: battle.phase,
    turn: `${wave.number}:${encounter}:${battle.attempts}`,
    boss: wave.boss,
    encounter,
    encounters: wave.encounters.length,
    appearance: active?.appearance ?? 'monster-red',
    waiting: !wave.boss && next && battle.phase !== 'complete' ? next.appearance : null,
    approach: battle.mistakes,
    hearts: battle.hearts,
    damaged: battle.damaged,
    spell: battle.spell,
    streak: streakOf(battle.independent),
    badge: options.badge,
    pressure: options.pressure ?? 0,
  };
}
