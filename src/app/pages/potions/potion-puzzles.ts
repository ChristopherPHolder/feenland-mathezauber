import type { Level } from '../../core/catalog';
import type { MessageKey } from '../../core/messages';

/** A mixing spell: two bottles poured together with +, −, × or ÷ make one new bottle. */
export type PotionOp = '+' | '−' | '×' | '÷';

export const ALL_OPS: readonly PotionOp[] = ['+', '−', '×', '÷'];

export type PotionTrick = 'addTake' | 'threeMix' | 'tens' | 'times' | 'four' | 'share' | 'master';

/** One level of the potion cauldron: how many bottles, which spells and how big a potion. */
export interface PotionStage {
  readonly stage: number;
  /** The topic the level sits in on the games hub. */
  readonly group: MessageKey;
  /** The mental maths trick the level practises; also picks its hint. */
  readonly trick: PotionTrick;
  /** The worked example on the level card: "9 − 4 → 5". */
  readonly example: string;
  readonly bottles: number;
  /** Bottles in the big cauldron that ends a round. */
  readonly bigBottles: number;
  readonly ops: readonly PotionOp[];
  /** Smallest and largest potion the cauldron asks for. */
  readonly targets: readonly [number, number];
  /** Potions for the big cauldron, when they differ. */
  readonly bigTargets?: readonly [number, number];
  /** The most a bottle may hold while mixing. */
  readonly max: number;
  /** Spells the level is about: no recipe without them may brew the potion. */
  readonly needs?: readonly PotionOp[];
  /** Picks the numbers on the bottles. */
  readonly draw: (random: Random, count: number) => number[];
  /** Potions the trick is about; others are skipped. */
  readonly fits?: (values: readonly number[], target: number) => boolean;
}

export type Random = () => number;

export const ROUND_LENGTH = 6;

const int = (random: Random, min: number, max: number) =>
  min + Math.floor(random() * (max - min + 1));
const pick = <T>(random: Random, items: readonly T[]): T => items[int(random, 0, items.length - 1)];
const numbers = (min: number, max: number) => (random: Random, count: number) =>
  Array.from({ length: count }, () => int(random, min, max));
const shuffle = <T>(random: Random, items: readonly T[]): T[] => {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index--) {
    const other = int(random, 0, index);
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
};

/** Two bottles that make ten, and tens bottles to add them to. */
function friendsOfTen(random: Random, count: number) {
  const ones = int(random, 1, 9);
  const values = [ones, 10 - ones];
  while (values.length < count) values.push(10 * int(random, 1, 4));
  return shuffle(random, values);
}

/** A number and one it shares into exactly, plus small bottles to mix with. */
function sharing(random: Random, count: number) {
  const parts = int(random, 2, 5);
  const values = [parts * int(random, 2, 6), parts];
  while (values.length < count) values.push(int(random, 1, 9));
  return shuffle(random, values);
}

export const potionStages: readonly PotionStage[] = [
  {
    stage: 1,
    group: 'potionPlusMinus',
    trick: 'addTake',
    example: '9 − 4 → 5',
    bottles: 2,
    bigBottles: 3,
    ops: ['+', '−'],
    targets: [3, 20],
    max: 20,
    draw: numbers(2, 12),
  },
  {
    stage: 2,
    group: 'potionPlusMinus',
    trick: 'threeMix',
    example: '8 + 5 − 3 → 10',
    bottles: 3,
    bigBottles: 4,
    ops: ['+', '−'],
    targets: [4, 20],
    max: 20,
    needs: ['−'],
    draw: numbers(1, 10),
  },
  {
    stage: 3,
    group: 'potionPlusMinus',
    trick: 'tens',
    example: '7 + 3 + 20 → 30',
    bottles: 3,
    bigBottles: 4,
    ops: ['+', '−'],
    targets: [10, 60],
    max: 60,
    draw: friendsOfTen,
    fits: (_, target) => target % 10 === 0,
  },
  {
    stage: 4,
    group: 'potionTimes',
    trick: 'times',
    example: '2 × 5 + 3 → 13',
    bottles: 3,
    bigBottles: 4,
    ops: ['+', '−', '×'],
    targets: [10, 60],
    bigTargets: [20, 80],
    max: 100,
    needs: ['×'],
    draw: numbers(2, 10),
  },
  {
    stage: 5,
    group: 'potionTimes',
    trick: 'four',
    example: '3 × 4 + 2 − 1 → 13',
    bottles: 4,
    bigBottles: 4,
    ops: ['+', '−', '×'],
    targets: [12, 40],
    bigTargets: [40, 90],
    max: 100,
    needs: ['×'],
    draw: numbers(1, 9),
  },
  {
    stage: 6,
    group: 'potionSharing',
    trick: 'share',
    example: '12 ÷ 3 + 2 → 6',
    bottles: 3,
    bigBottles: 4,
    ops: ALL_OPS,
    targets: [2, 30],
    max: 100,
    needs: ['÷'],
    draw: sharing,
  },
  {
    stage: 7,
    group: 'potionSharing',
    trick: 'master',
    example: '8 ÷ 2 × 3 + 1 → 13',
    bottles: 4,
    bigBottles: 4,
    ops: ALL_OPS,
    targets: [10, 50],
    bigTargets: [30, 90],
    max: 100,
    needs: ['×', '÷'],
    draw: numbers(1, 10),
  },
];

export const TOTAL_STAGES = potionStages.length;

export const potionLevels: readonly Level[] = potionStages.map((stage) => ({
  id: `potion-${stage.stage}`,
  title: `potion${stage.stage}` as MessageKey,
  description: `potion${stage.stage}Help` as MessageKey,
  skills: ['mental-strategies', stage.trick],
  format: 'potions',
  group: stage.group,
}));

export function potionStage(id: string | null | undefined): PotionStage | undefined {
  const match = /^potion-([1-9]\d*)$/.exec(id ?? '');
  return match ? potionStages.find((stage) => stage.stage === Number(match[1])) : undefined;
}

/** Where a level sits in the list, counting from 1: the number a child sees. */
export function potionPosition(stage: PotionStage): number {
  return potionStages.indexOf(stage) + 1;
}

/** The division sign as the child's school writes it: ÷ or a colon. */
export function localOps(text: string, divide: string): string {
  return text.replaceAll('÷', divide);
}

/**
 * What two bottles make together, or null when the spell cannot work: a bottle never goes
 * empty or below zero, sharing must come out even, and no bottle holds more than `max`.
 */
export function mix(a: number, op: PotionOp, b: number, max: number): number | null {
  const result =
    op === '+' ? a + b : op === '−' ? a - b : op === '×' ? a * b : b > 0 && a % b === 0 ? a / b : 0;
  return result >= 1 && result <= max ? result : null;
}

/** Why a spell cannot pour `b` into `a`: the message key a greyed-out bottle explains. */
export function blockReason(
  a: number,
  op: PotionOp,
  b: number,
  max: number,
): 'tooMuch' | 'notEnough' | 'cannotShare' | null {
  if (mix(a, op, b, max) !== null) return null;
  if (op === '−') return 'notEnough';
  if (op === '÷') return 'cannotShare';
  return 'tooMuch';
}

/** One mixing step of a recipe: `a op b = result`. */
export interface MixStep {
  readonly a: number;
  readonly op: PotionOp;
  readonly b: number;
  readonly result: number;
}

/**
 * A recipe that mixes every bottle into exactly `target`, or null when there is none.
 * Tries every pair of bottles with every spell, so it also proves a potion can be brewed.
 */
export function solve(
  values: readonly number[],
  target: number,
  ops: readonly PotionOp[],
  max: number,
): MixStep[] | null {
  const dead = new Set<string>();
  const search = (bottles: readonly number[]): MixStep[] | null => {
    if (bottles.length === 1) return bottles[0] === target ? [] : null;
    const key = [...bottles].sort((x, y) => x - y).join(',');
    if (dead.has(key)) return null;
    for (let i = 0; i < bottles.length; i++)
      for (let j = 0; j < bottles.length; j++) {
        if (i === j) continue;
        for (const op of ops) {
          const result = mix(bottles[i], op, bottles[j], max);
          if (result === null) continue;
          const rest = bottles.filter((_, index) => index !== i && index !== j);
          const recipe = search([...rest, result]);
          if (recipe) return [{ a: bottles[i], op, b: bottles[j], result }, ...recipe];
        }
      }
    dead.add(key);
    return null;
  };
  return search(values);
}

/**
 * Times and sharing steps a child knows from the tables: 7 × 5 and 35 ÷ 5, never 6 × 12 or ×1.
 * Potions are built from these, though a child may brew them any way that works.
 */
function tableFact(a: number, op: PotionOp, b: number): boolean {
  if (op === '×') return a > 1 && b > 1 && a <= 10 && b <= 10;
  if (op === '÷') return b > 1 && b <= 10 && a / b <= 10;
  return true;
}

/** Mixes the bottles in a random order with random spells: the result is a potion that brews. */
function brewAtRandom(
  values: readonly number[],
  ops: readonly PotionOp[],
  max: number,
  random: Random,
): number | null {
  let bottles = [...values];
  while (bottles.length > 1) {
    const i = int(random, 0, bottles.length - 1);
    const j = (i + int(random, 1, bottles.length - 1)) % bottles.length;
    const op = pick(random, ops);
    const result = mix(bottles[i], op, bottles[j], max);
    if (result === null || !tableFact(bottles[i], op, bottles[j])) return null;
    bottles = [...bottles.filter((_, index) => index !== i && index !== j), result];
  }
  return bottles[0];
}

/** One potion to brew: every bottle must be mixed in, and the last one must be `target`. */
export interface PotionPuzzle {
  readonly values: readonly number[];
  readonly target: number;
  readonly ops: readonly PotionOp[];
  readonly max: number;
}

/**
 * One potion for a stage. The last potion of a round is the big cauldron, with more bottles
 * or a bigger potion. A potion always brews, never equals one of its bottles, and needs the
 * spells the level is about.
 */
export function createPotion(
  stage: PotionStage,
  options: { big?: boolean; avoid?: readonly number[] } = {},
  random: Random = Math.random,
): PotionPuzzle {
  const count = options.big ? stage.bigBottles : stage.bottles;
  const [low, high] = (options.big && stage.bigTargets) || stage.targets;
  const without = stage.ops.filter((op) => !stage.needs?.includes(op));
  for (let attempt = 0; attempt < 2000; attempt++) {
    const values = stage.draw(random, count);
    const target = brewAtRandom(values, stage.ops, stage.max, random);
    if (
      target === null ||
      target < low ||
      target > high ||
      values.includes(target) ||
      // Late on, a target may come back with other bottles rather than fail.
      (attempt < 1500 && options.avoid?.includes(target)) ||
      !(stage.fits?.(values, target) ?? true) ||
      (stage.needs && solve(values, target, without, stage.max))
    )
      continue;
    return { values, target, ops: stage.ops, max: stage.max };
  }
  throw new Error(`No potion fits stage ${stage.stage}`);
}

/** Six potions with the big cauldron last and no potion twice. */
export function createRound(stage: PotionStage, random: Random = Math.random): PotionPuzzle[] {
  const potions: PotionPuzzle[] = [];
  for (let index = 0; index < ROUND_LENGTH; index++)
    potions.push(
      createPotion(
        stage,
        { big: index === ROUND_LENGTH - 1, avoid: potions.map((potion) => potion.target) },
        random,
      ),
    );
  return potions;
}

/** Three stars for a potion brewed without a fizz, two after one fizz, one after more. */
export function potionStars(fizzles: number): 1 | 2 | 3 {
  return fizzles === 0 ? 3 : fizzles === 1 ? 2 : 1;
}

/** The round's stars from every potion's stars: one slip still earns three. */
export function roundStars(stars: readonly number[]): 1 | 2 | 3 {
  const total = stars.reduce((sum, value) => sum + value, 0);
  return total >= ROUND_LENGTH * 3 - 1 ? 3 : total >= ROUND_LENGTH * 2 ? 2 : 1;
}

export function isMastered(stars: readonly number[]): boolean {
  return roundStars(stars) >= 2;
}

/** Three perfect potions in a row start the rainbow fever: potions pay double coins. */
export const FEVER_STREAK = 3;

export interface Brew {
  readonly stars: number;
  /** Brewed without undoing a step: Olli adds a moon drop. */
  readonly moon: boolean;
  /** Brewed before the hourglass ran out. */
  readonly sparkle: boolean;
  readonly streak: number;
  readonly big: boolean;
}

/** Coins for one brewed potion. */
export function potionCoins(brew: Brew): number {
  const potion = brew.stars * 10 * (brew.big ? 2 : 1) * (brew.streak >= FEVER_STREAK ? 2 : 1);
  return potion + (brew.moon ? 10 : 0) + (brew.sparkle ? 15 : 0);
}

/** How long the hourglass runs for one potion: longer for more bottles. */
export const POTION_PACES = [
  { id: 'off', label: 'paceOff', base: 0, perBottle: 0 },
  { id: 'relaxed', label: 'paceRelaxed', base: 20, perBottle: 12 },
  { id: 'normal', label: 'paceNormal', base: 10, perBottle: 8 },
  { id: 'fast', label: 'paceFast', base: 6, perBottle: 5 },
] as const;

export type PotionPace = (typeof POTION_PACES)[number]['id'];

export function hourglassSeconds(pace: PotionPace, bottles: number): number {
  const option = POTION_PACES.find((item) => item.id === pace)!;
  return option.base ? option.base + option.perBottle * bottles : 0;
}

export function parsePotionPace(value: unknown): PotionPace {
  return POTION_PACES.find((pace) => pace.id === value)?.id ?? 'off';
}
