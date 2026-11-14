import type { Level } from '../../core/catalog';
import type { MessageKey } from '../../core/messages';

/** A hop spell: Lumi jumps along the dial by adding, taking away or doubling. */
export interface Spell {
  readonly op: '+' | '−' | '×';
  readonly n: number;
}

/** One level of the treasure lock: the dial, the spells, and how many hops a lock should take. */
export interface LockStage {
  readonly stage: number;
  /** The topic the level sits in on the games hub. */
  readonly group: MessageKey;
  /** The mental maths trick the level practises; also picks its hint. */
  readonly trick: LockTrick;
  /** The worked example on the level card, in hops: "+5 +5 −1 → 9". */
  readonly example: string;
  readonly max: number;
  readonly start: number;
  readonly spells: readonly Spell[];
  /** Fewest and most hops the best way to a lock may take. */
  readonly par: readonly [number, number];
  /** Thorny numbers on the dial: landing there bounces Lumi back. */
  readonly thorns: number;
  /** Targets the trick is about; others are skipped when picking locks. */
  readonly fits?: (target: number) => boolean;
}

export type LockTrick = 'fives' | 'partitions' | 'tens' | 'nines' | 'back' | 'doubles' | 'mixed';

export const ROUND_LENGTH = 6;

const plus = (n: number): Spell => ({ op: '+', n });
const minus = (n: number): Spell => ({ op: '−', n });
const times = (n: number): Spell => ({ op: '×', n });
const ones = (target: number) => target % 10;

export const lockStages: readonly LockStage[] = [
  {
    stage: 1,
    group: 'lockTwenty',
    trick: 'fives',
    example: '+5 +5 −1 → 9',
    max: 20,
    start: 0,
    spells: [plus(5), plus(1), minus(1)],
    par: [2, 4],
    thorns: 0,
  },
  {
    stage: 2,
    group: 'lockTwenty',
    trick: 'partitions',
    example: '+3 +3 +2 → 8',
    max: 20,
    start: 0,
    spells: [plus(2), plus(3)],
    par: [3, 5],
    thorns: 0,
  },
  {
    stage: 3,
    group: 'lockTens',
    trick: 'tens',
    example: '+10 +10 +1 → 21',
    max: 50,
    start: 0,
    spells: [plus(10), plus(1)],
    par: [3, 6],
    thorns: 0,
    fits: (target) => ones(target) >= 1 && ones(target) <= 4,
  },
  {
    stage: 4,
    group: 'lockTens',
    trick: 'nines',
    example: '+10 +10 −1 → 19',
    max: 50,
    start: 0,
    spells: [plus(10), plus(1), minus(1)],
    par: [3, 6],
    thorns: 1,
    fits: (target) => ones(target) >= 7,
  },
  {
    stage: 5,
    group: 'lockTens',
    trick: 'back',
    example: '50 −10 −1 → 39',
    max: 50,
    start: 50,
    spells: [minus(10), minus(1), plus(1)],
    par: [3, 6],
    thorns: 1,
  },
  {
    stage: 6,
    group: 'lockDoubles',
    trick: 'doubles',
    example: '1 +1 ×2 ×2 → 8',
    max: 40,
    start: 1,
    spells: [times(2), plus(1), minus(1)],
    par: [3, 5],
    thorns: 0,
    fits: (target) => target >= 6,
  },
  {
    stage: 7,
    group: 'lockDoubles',
    trick: 'mixed',
    example: '+10 ×2 ×2 −1 → 39',
    max: 100,
    start: 0,
    spells: [plus(10), times(2), plus(1), minus(1)],
    par: [4, 6],
    thorns: 2,
  },
];

export const TOTAL_STAGES = lockStages.length;

export const lockLevels: readonly Level[] = lockStages.map((stage) => ({
  id: `treasure-lock-${stage.stage}`,
  title: `lock${stage.stage}` as MessageKey,
  description: `lock${stage.stage}Help` as MessageKey,
  skills: ['mental-strategies', stage.trick],
  format: 'treasure-lock',
  group: stage.group,
}));

export function lockStage(id: string | null | undefined): LockStage | undefined {
  const match = /^treasure-lock-(\d)$/.exec(id ?? '');
  return match ? lockStages.find((stage) => stage.stage === Number(match[1])) : undefined;
}

export function spellText(spell: Spell): string {
  return `${spell.op}${spell.n}`;
}

/** Where a hop lands, or null when it would leave the dial. */
export function cast(value: number, spell: Spell, max: number): number | null {
  const next =
    spell.op === '+' ? value + spell.n : spell.op === '−' ? value - spell.n : value * spell.n;
  return next < 0 || next > max ? null : next;
}

/** One lock to open: Lumi starts on `start` and must land exactly on `target`. */
export interface LockPuzzle {
  readonly start: number;
  readonly target: number;
  readonly max: number;
  readonly spells: readonly Spell[];
  readonly thorns: readonly number[];
  /** A gem lies on one number along a best way to the lock, or nowhere. */
  readonly gem: number | null;
  /** The fewest hops that open the lock. */
  readonly par: number;
}

/** Fewest hops from `start` to every number on the dial (-1 where Lumi cannot get to). */
export function hopDistances(
  start: number,
  max: number,
  spells: readonly Spell[],
  thorns: readonly number[] = [],
): number[] {
  const distance = Array<number>(max + 1).fill(-1);
  distance[start] = 0;
  const queue = [start];
  for (let head = 0; head < queue.length; head++) {
    const value = queue[head];
    for (const spell of spells) {
      const next = cast(value, spell, max);
      if (next === null || distance[next] !== -1 || thorns.includes(next)) continue;
      distance[next] = distance[value] + 1;
      queue.push(next);
    }
  }
  return distance;
}

type Random = () => number;
const int = (random: Random, min: number, max: number) =>
  min + Math.floor(random() * (max - min + 1));
const pick = <T>(random: Random, items: readonly T[]): T => items[int(random, 0, items.length - 1)];

/** A random best way from `start` to `target`, as the numbers Lumi lands on (target included). */
export function bestPath(
  puzzle: Pick<LockPuzzle, 'start' | 'target' | 'max' | 'spells' | 'thorns'>,
  random: Random = Math.random,
): number[] {
  const distance = hopDistances(puzzle.start, puzzle.max, puzzle.spells, puzzle.thorns);
  if (distance[puzzle.target] < 0) return [];
  const path = [puzzle.target];
  let value = puzzle.target;
  while (value !== puzzle.start) {
    const here = value;
    const before = distance
      .map((hops, from) => ({ hops, from }))
      .filter(
        ({ hops, from }) =>
          hops === distance[here] - 1 &&
          puzzle.spells.some((spell) => cast(from, spell, puzzle.max) === here),
      )
      .map(({ from }) => from);
    value = pick(random, before);
    if (value !== puzzle.start) path.unshift(value);
  }
  return path;
}

/**
 * One lock for a stage. The last lock of a round is the big chest: it asks for the most hops.
 * Thorns never sit on the start or the target, and a lock always has a way through.
 */
export function createLock(
  stage: LockStage,
  options: { big?: boolean; avoid?: readonly number[] } = {},
  random: Random = Math.random,
): LockPuzzle {
  const [low, high] = stage.par;
  for (let attempt = 0; attempt < 60; attempt++) {
    const thornCount = attempt < 40 ? stage.thorns : 0;
    const thorns: number[] = [];
    while (thorns.length < thornCount) {
      const thorn = int(random, 1, stage.max - 1);
      if (thorn !== stage.start && !thorns.includes(thorn)) thorns.push(thorn);
    }
    const distance = hopDistances(stage.start, stage.max, stage.spells, thorns);
    const candidates = distance
      .map((hops, target) => ({ hops, target }))
      .filter(
        ({ hops, target }) =>
          target !== stage.start &&
          !thorns.includes(target) &&
          !options.avoid?.includes(target) &&
          hops >= low &&
          hops <= high &&
          (stage.fits?.(target) ?? true),
      );
    if (!candidates.length) continue;
    const longest = Math.max(...candidates.map(({ hops }) => hops));
    const pool = options.big
      ? candidates.filter(({ hops }) => hops === longest)
      : candidates.filter(({ hops }) => hops < longest || longest === low);
    const { target, hops } = pick(random, pool.length ? pool : candidates);
    const base = { start: stage.start, target, max: stage.max, spells: stage.spells, thorns };
    const path = bestPath(base, random).slice(0, -1);
    return { ...base, par: hops, gem: path.length ? pick(random, path) : null };
  }
  throw new Error(`No lock fits stage ${stage.stage}`);
}

/** Six locks, easier first, with the big chest last and no target twice. */
export function createRound(stage: LockStage, random: Random = Math.random): LockPuzzle[] {
  const locks: LockPuzzle[] = [];
  for (let index = 0; index < ROUND_LENGTH; index++)
    locks.push(
      createLock(
        stage,
        { big: index === ROUND_LENGTH - 1, avoid: locks.map((lock) => lock.target) },
        random,
      ),
    );
  const [last] = locks.splice(ROUND_LENGTH - 1, 1);
  return [...locks.sort((a, b) => a.par - b.par), last];
}

/** Three keys at par, two for a couple of extra hops, one for any opened lock. */
export function lockStars(hops: number, par: number): 1 | 2 | 3 {
  return hops <= par ? 3 : hops <= par + 2 ? 2 : 1;
}

/** The round's stars from every lock's keys: one slip still earns three. */
export function roundStars(keys: readonly number[]): 1 | 2 | 3 {
  const total = keys.reduce((sum, value) => sum + value, 0);
  return total >= ROUND_LENGTH * 3 - 1 ? 3 : total >= ROUND_LENGTH * 2 ? 2 : 1;
}

export function isMastered(keys: readonly number[]): boolean {
  return roundStars(keys) >= 2;
}

/** Three perfect locks in a row start the treasure fever: chest coins count double. */
export const FEVER_STREAK = 3;

export interface ChestHaul {
  readonly stars: number;
  readonly gem: boolean;
  readonly crystal: boolean;
  readonly streak: number;
  readonly big: boolean;
}

/** Coins for one opened chest. */
export function chestCoins(haul: ChestHaul): number {
  const chest = haul.stars * 10 * (haul.big ? 2 : 1) * (haul.streak >= FEVER_STREAK ? 2 : 1);
  return chest + (haul.gem ? 10 : 0) + (haul.crystal ? 15 : 0);
}

/** How long the hourglass runs for one lock: longer for locks that need more hops. */
export const LOCK_PACES = [
  { id: 'off', label: 'paceOff', base: 0, perHop: 0 },
  { id: 'relaxed', label: 'paceRelaxed', base: 20, perHop: 8 },
  { id: 'normal', label: 'paceNormal', base: 10, perHop: 5 },
  { id: 'fast', label: 'paceFast', base: 6, perHop: 3 },
] as const;

export type LockPace = (typeof LOCK_PACES)[number]['id'];

export function hourglassSeconds(pace: LockPace, par: number): number {
  const option = LOCK_PACES.find((item) => item.id === pace)!;
  return option.base ? option.base + option.perHop * par : 0;
}

export function parseLockPace(value: unknown): LockPace {
  return LOCK_PACES.find((pace) => pace.id === value)?.id ?? 'off';
}
