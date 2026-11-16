import type { Level } from '../../core/catalog';
import type { MessageKey } from '../../core/messages';

/**
 * The Mountain Gondola: every cabin holds exactly ten. A sum is solved by filling the cabin to
 * ten first (bridging through ten), going back down to ten first, taking from a full ten, or
 * sending a full express cabin and letting a bunny hop off (compensation).
 *
 * Everything here is pure: levels, the item generator (every item crosses a ten), the split
 * check, answer feedback, scoring and stars. The page and the scenes only draw what it says.
 */

export type Random = () => number;
/** Up the mountain adds; down the mountain takes away. */
export type GondolaKind = 'add' | 'sub';
/** How concrete the cabins look: bunnies, full tens as "10" cabins, or numbers only. */
export type Representation = 'bunnies' | 'tens' | 'numbers';
/** The trick a level is about; it also picks the level's help card. */
export type GondolaTrick =
  | 'fill9'
  | 'fill8'
  | 'fill76'
  | 'fillAny'
  | 'down'
  | 'downTake'
  | 'bigUp'
  | 'bigDown'
  | 'bigBig'
  | 'express'
  | 'expressBig'
  | 'master';

export interface GondolaItem {
  readonly kind: GondolaKind;
  readonly a: number;
  readonly b: number;
}

export interface GondolaStage {
  readonly stage: number;
  readonly group: MessageKey;
  readonly trick: GondolaTrick;
  /** The worked example on the level card: "8 + 5 → 10 + 3". */
  readonly example: string;
  readonly representation: Representation;
  /** Turns in a round, the big summit cabin included. */
  readonly turns: number;
  /** Four answer buttons (true) or the number pad. */
  readonly choices: boolean;
  /** The child may swap which group sits in the cabin (either order). */
  readonly swap?: boolean;
  /** Taking everything from a full ten is accepted (13 − 9 = 1 + 3). */
  readonly takeTen?: boolean;
  /** Gusti offers the express: a full cabin, then bunnies hop off or back on. */
  readonly express?: boolean;
  /** Three stars are needed to master the level. */
  readonly strict?: boolean;
  /** Every item the level may ask, before shuffling. */
  readonly pool: () => GondolaItem[];
  /** The harder items the big summit cabin picks from. */
  readonly bigPool: () => GondolaItem[];
}

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, index) => from + index);
const add = (a: number, b: number): GondolaItem => ({ kind: 'add', a, b });
const sub = (a: number, b: number): GondolaItem => ({ kind: 'sub', a, b });

/** a + b where the ones of b fill the cabin past ten, leaving at least one bunny over. */
export function crossesUp(a: number, b: number) {
  const ones = a % 10;
  return ones >= 1 && b % 10 >= 1 && ones + (b % 10) >= 11 && a + b <= 99;
}
/** a − b where the ones of b are more than the loose ones of a, and a full ten is there to open. */
export function crossesDown(a: number, b: number) {
  const ones = a % 10;
  return ones >= 1 && b % 10 > ones && Math.floor(a / 10) > Math.floor(b / 10) && a - b >= 1;
}
export function crosses(item: GondolaItem) {
  return item.kind === 'add' ? crossesUp(item.a, item.b) : crossesDown(item.a, item.b);
}

const singleAdds = () =>
  range(2, 9).flatMap((a) =>
    range(2, 9)
      .filter((b) => a + b >= 11)
      .map((b) => add(a, b)),
  );
const teenSubs = (subtrahends: readonly number[]) =>
  range(11, 18).flatMap((a) => subtrahends.filter((b) => crossesDown(a, b)).map((b) => sub(a, b)));
const bigUps = () =>
  range(12, 89).flatMap((a) =>
    range(2, 9)
      .filter((b) => crossesUp(a, b))
      .map((b) => add(a, b)),
  );
const bigDowns = () =>
  range(21, 98).flatMap((a) =>
    range(2, 9)
      .filter((b) => crossesDown(a, b))
      .map((b) => sub(a, b)),
  );
const bigBigs = (min = 12) =>
  range(min, 79).flatMap((a) =>
    range(12, 69)
      .filter((b) => crossesUp(a, b))
      .map((b) => add(a, b)),
  );
const nines = (ones: readonly number[]) =>
  range(12, 89).flatMap((a) => ones.filter((b) => crossesUp(a, b)).map((b) => add(a, b)));
const expressBigs = () => [
  ...range(12, 79).flatMap((a) => [19, 29].filter((b) => crossesUp(a, b)).map((b) => add(a, b))),
  ...range(21, 98).flatMap((a) => [9, 19].filter((b) => crossesDown(a, b)).map((b) => sub(a, b))),
];

export const gondolaStages: readonly GondolaStage[] = [
  {
    stage: 1,
    group: 'gondolaFill',
    trick: 'fill9',
    example: '9 + 4 → 10 + 3',
    representation: 'bunnies',
    turns: 8,
    choices: true,
    pool: () => range(2, 9).map((b) => add(9, b)),
    bigPool: () => range(4, 9).map((b) => add(8, b)),
  },
  {
    stage: 2,
    group: 'gondolaFill',
    trick: 'fill8',
    example: '8 + 5 → 10 + 3',
    representation: 'bunnies',
    turns: 8,
    choices: true,
    pool: () => range(3, 9).map((b) => add(8, b)),
    bigPool: () => range(5, 9).map((b) => add(7, b)),
  },
  {
    stage: 3,
    group: 'gondolaFill',
    trick: 'fill76',
    example: '7 + 6 → 10 + 3',
    representation: 'bunnies',
    turns: 10,
    choices: true,
    pool: () => [...range(5, 9).map((b) => add(7, b)), ...range(5, 9).map((b) => add(6, b))],
    bigPool: () => range(6, 9).map((b) => add(5, b)),
  },
  {
    stage: 4,
    group: 'gondolaFill',
    trick: 'fillAny',
    example: '5 + 8 → 8 + 5',
    representation: 'bunnies',
    turns: 10,
    choices: true,
    swap: true,
    pool: singleAdds,
    bigPool: () => singleAdds().filter((item) => item.a < item.b && item.a <= 5),
  },
  {
    stage: 5,
    group: 'gondolaDown',
    trick: 'down',
    example: '13 − 5 → 10 − 2',
    representation: 'bunnies',
    turns: 10,
    choices: true,
    pool: () => teenSubs(range(2, 8)),
    bigPool: () => teenSubs([7, 8]).filter((item) => item.a % 10 >= 4),
  },
  {
    stage: 6,
    group: 'gondolaDown',
    trick: 'downTake',
    example: '13 − 9 → 1 + 3',
    representation: 'bunnies',
    turns: 10,
    choices: true,
    takeTen: true,
    pool: () => teenSubs([7, 8, 9]),
    bigPool: () => teenSubs([9]),
  },
  {
    stage: 7,
    group: 'gondolaBig',
    trick: 'bigUp',
    example: '47 + 6 → 50 + 3',
    representation: 'tens',
    turns: 8,
    choices: false,
    pool: bigUps,
    bigPool: () => bigUps().filter((item) => item.a >= 60 && item.b >= 7),
  },
  {
    stage: 8,
    group: 'gondolaBig',
    trick: 'bigDown',
    example: '43 − 6 → 40 − 3',
    representation: 'tens',
    turns: 8,
    choices: false,
    takeTen: true,
    pool: bigDowns,
    bigPool: () => bigDowns().filter((item) => item.a >= 60 && item.b >= 7),
  },
  {
    stage: 9,
    group: 'gondolaBig',
    trick: 'bigBig',
    example: '38 + 25 → 40 + 23',
    representation: 'tens',
    turns: 8,
    choices: false,
    pool: () => bigBigs(),
    bigPool: () => bigBigs(40),
  },
  {
    stage: 10,
    group: 'gondolaClever',
    trick: 'express',
    example: '34 + 9 → 44 − 1',
    representation: 'numbers',
    turns: 8,
    choices: false,
    express: true,
    pool: () => nines([9, 8]),
    bigPool: () => nines([19]),
  },
  {
    stage: 11,
    group: 'gondolaClever',
    trick: 'expressBig',
    example: '63 − 9 → 53 + 1',
    representation: 'numbers',
    turns: 8,
    choices: false,
    express: true,
    takeTen: true,
    pool: expressBigs,
    bigPool: () => expressBigs().filter((item) => item.b === 29 || item.b === 19),
  },
  {
    stage: 12,
    group: 'gondolaClever',
    trick: 'master',
    example: '38 + 25 · 43 − 6',
    representation: 'numbers',
    turns: 8,
    choices: false,
    swap: true,
    takeTen: true,
    express: true,
    strict: true,
    pool: () => [
      ...singleAdds(),
      ...teenSubs(range(2, 9)),
      ...bigUps(),
      ...bigDowns(),
      ...bigBigs(),
      ...expressBigs(),
    ],
    bigPool: () => bigBigs(40),
  },
];

export const TOTAL_STAGES = gondolaStages.length;

export const gondolaLevels: readonly Level[] = gondolaStages.map((stage) => ({
  id: `gondola-${stage.stage}`,
  title: `gondola${stage.stage}` as MessageKey,
  description: `gondola${stage.stage}Help` as MessageKey,
  skills: ['bridging-ten', stage.trick],
  format: 'gondola',
  group: stage.group,
}));

export function gondolaStage(id: string | null | undefined): GondolaStage | undefined {
  const match = /^gondola-([1-9]\d*)$/.exec(id ?? '');
  return match ? gondolaStages.find((stage) => stage.stage === Number(match[1])) : undefined;
}

/** Where a level sits in the list, counting from 1: the number a child sees. */
export function gondolaPosition(stage: GondolaStage): number {
  return gondolaStages.indexOf(stage) + 1;
}

const int = (random: Random, min: number, max: number) =>
  min + Math.floor(random() * (max - min + 1));
function shuffle<T>(random: Random, items: readonly T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index--) {
    const other = int(random, 0, index);
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}
const same = (x: GondolaItem, y: GondolaItem) => x.kind === y.kind && x.a === y.a && x.b === y.b;

/** A seeded random source for tests and replays (mulberry32). */
export function seeded(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A round of items, easiest-first order not needed: every item crosses a ten, none repeats,
 * and the last one is the big summit cabin from the harder pool. On the either-order level
 * about half the sums show the smaller group first, so the child decides who sits in the cabin.
 */
export function createRound(stage: GondolaStage, random: Random = Math.random): GondolaItem[] {
  const pool = shuffle(random, stage.pool().filter(crosses));
  const normal = spread(stage, pool, random).slice(0, stage.turns - 1);
  const bigs = shuffle(
    random,
    stage.bigPool().filter((item) => crosses(item) && !normal.some((used) => same(used, item))),
  );
  const big = bigs[0] ?? pool.find((item) => !normal.some((used) => same(used, item)))!;
  return [...normal, big];
}

/** Keeps a mixed level varied: no two neighbours of the same kind of sum when it can help. */
function spread(stage: GondolaStage, pool: GondolaItem[], random: Random): GondolaItem[] {
  if (stage.trick !== 'master') return pool;
  const buckets = [
    pool.filter((item) => item.a < 10 && item.kind === 'add'),
    pool.filter((item) => item.a < 20 && item.kind === 'sub'),
    pool.filter((item) => item.a >= 10 && item.b < 10 && item.kind === 'add'),
    pool.filter((item) => item.a >= 20 && item.b % 10 !== 9 && item.kind === 'sub'),
    pool.filter((item) => item.b >= 12 && item.b % 10 !== 9),
    pool.filter((item) => item.b % 10 === 9),
  ];
  const picked: GondolaItem[] = [];
  for (let index = 0; picked.length < stage.turns; index++) {
    const bucket = buckets[index % buckets.length];
    const item = bucket.find((candidate) => !picked.some((used) => same(used, candidate)));
    if (item) picked.push(item);
    if (index > 200) break;
  }
  return shuffle(random, picked);
}

/** What a turn looks like: full tens and loose ones on each side. */
export interface TurnShape {
  readonly kind: GondolaKind;
  readonly answer: number;
  /** Full tens of the first number: up the cable (adding) or parked full cabins (taking away). */
  readonly tens: number;
  /** Bunnies in the boarding cabin (adding) or the loose group (taking away). */
  readonly cabin: number;
  /** Full tens of the second number: they ride whole. */
  readonly groupTens: number;
  /** The group being split: waiting bunnies (adding) or bunnies needed below (taking away). */
  readonly group: number;
  /** How many of the group go first to make the ten. */
  readonly fill: number;
  /** The ten reached on the way: a child who stops there answers this. */
  readonly ten: number;
}

export function shapeOf(item: GondolaItem): TurnShape {
  const tens = Math.floor(item.a / 10);
  const cabin = item.a % 10;
  const groupTens = Math.floor(item.b / 10);
  const group = item.b % 10;
  if (item.kind === 'add') {
    return {
      kind: 'add',
      answer: item.a + item.b,
      tens,
      cabin,
      groupTens,
      group,
      fill: 10 - cabin,
      ten: 10 * (tens + groupTens + 1),
    };
  }
  return {
    kind: 'sub',
    answer: item.a - item.b,
    tens,
    cabin,
    groupTens,
    group,
    fill: cabin,
    ten: 10 * (tens - groupTens),
  };
}

/** The same sum with the two groups swapped: the other one sits in the cabin. */
export function swapped(item: GondolaItem): GondolaItem {
  return { ...item, a: item.b, b: item.a };
}
export function canSwap(stage: GondolaStage, item: GondolaItem) {
  return !!stage.swap && item.kind === 'add' && item.a < 10 && item.b < 10;
}
/** The express fits sums whose ones are close below a ten: +9, +8, +19, +29, −9, −19. */
export function canExpress(stage: GondolaStage, item: GondolaItem) {
  return !!stage.express && (item.b % 10 === 9 || (item.kind === 'add' && item.b % 10 === 8));
}
export function canTakeTen(stage: GondolaStage, item: GondolaItem) {
  return !!stage.takeTen && item.kind === 'sub';
}

/** The express: how many full cabins it sends, and how many bunnies hop off (−) or on (+). */
export function expressMove(item: GondolaItem) {
  const cabins = Math.ceil(item.b / 10);
  return { cabins, fix: item.kind === 'add' ? item.b - 10 * cabins : 10 * cabins - item.b };
}

export type SplitResult = 'fill' | 'tooMany' | 'tooFew';

/** Checks a split of the group: `first` bunnies go first. Only the ten-making split fits. */
export function checkSplit(shape: TurnShape, first: number): SplitResult {
  return first === shape.fill ? 'fill' : first > shape.fill ? 'tooMany' : 'tooFew';
}

/** Which of the usual mistakes a wrong answer looks like. */
export type AnswerSlip = 'stopAtTen' | 'wrongWay' | 'keptTens' | 'other';

export type Move = 'fill' | 'takeTen' | 'express';

export function classifyAnswer(item: GondolaItem, move: Move, value: number): AnswerSlip {
  const shape = shapeOf(item);
  if (value === shape.ten && move !== 'express') return 'stopAtTen';
  if (move === 'express' && value === shape.answer - 2 * expressMove(item).fix) return 'wrongWay';
  if (
    item.kind === 'sub' &&
    value === 10 * (shape.tens - shape.groupTens) + shape.group - shape.cabin
  )
    return 'keptTens';
  return 'other';
}

/**
 * Four answer buttons: the answer and three numbers that come from real slips (stopping at the
 * ten, one off, a ten off), in counting order so the position never gives it away.
 */
export function answerChoices(item: GondolaItem, random: Random = Math.random): number[] {
  const { answer, ten } = shapeOf(item);
  const slips = [ten, answer + 1, answer - 1, answer + 10, answer - 10, answer + 2, answer - 2];
  const options = [...new Set(slips)].filter((n) => n >= 1 && n <= 99 && n !== answer);
  const [first, ...rest] = options;
  const picked = [first, ...shuffle(random, rest).slice(0, 2)];
  return [answer, ...picked].sort((x, y) => x - y);
}

/** A worked example with other numbers than this turn, for the picture card after two slips. */
export interface RuleCard {
  readonly kind: 'fill' | 'down' | 'teen' | 'tens';
  readonly a: number;
  readonly b: number;
}

/** Sums and fills all differ, so at most two cards can clash with a turn and one is always left. */
const FILL_CARDS: readonly RuleCard[] = [
  { kind: 'fill', a: 8, b: 4 },
  { kind: 'fill', a: 7, b: 6 },
  { kind: 'fill', a: 9, b: 6 },
  { kind: 'fill', a: 6, b: 5 },
];
const DOWN_CARDS: readonly RuleCard[] = [
  { kind: 'down', a: 12, b: 5 },
  { kind: 'down', a: 14, b: 6 },
  { kind: 'down', a: 15, b: 9 },
  { kind: 'down', a: 13, b: 4 },
];
const TEEN_CARDS: readonly RuleCard[] = [
  { kind: 'teen', a: 10, b: 3 },
  { kind: 'teen', a: 10, b: 6 },
  { kind: 'teen', a: 10, b: 8 },
];
const TENS_CARDS: readonly RuleCard[] = [
  { kind: 'tens', a: 40, b: 7 },
  { kind: 'tens', a: 70, b: 2 },
  { kind: 'tens', a: 30, b: 5 },
];

/**
 * The picture card for this turn's step. It is chosen by the step and the turn's kind, never
 * by the answer, and skips any card whose numbers would show this turn's sum or result.
 */
export function ruleCard(item: GondolaItem, step: 'split' | 'answer'): RuleCard {
  const shape = shapeOf(item);
  const deck =
    step === 'split'
      ? item.kind === 'add'
        ? FILL_CARDS
        : DOWN_CARDS
      : item.a + item.b >= 20 || item.a >= 20
        ? TENS_CARDS
        : TEEN_CARDS;
  const shows = (card: RuleCard) => {
    const values =
      card.kind === 'fill'
        ? [card.a + card.b, 10 - card.a]
        : card.kind === 'down'
          ? [card.a - card.b, card.a % 10]
          : [card.a + card.b];
    return (
      values.includes(shape.answer) ||
      values.includes(shape.fill) ||
      (card.a === item.a && card.b === item.b)
    );
  };
  return deck.find((card) => !shows(card)) ?? deck[0];
}

/** Three first-try turns in a row turn the next cabin into the golden express. */
export const GOLDEN_STREAK = 3;
/** Three quick first-try turns in a row put the snow tarp over the cabins. */
export const TARP_STREAK = 3;
/** A first split slower than this (seconds) keeps the bunnies visible: it looks like counting. */
export function quickSplit(shape: TurnShape, seconds: number) {
  return seconds <= (shape.tens || shape.groupTens ? 14 : 9);
}

export interface TurnScore {
  /** The split was right on the first try. */
  readonly firstTry: boolean;
  /** The split took one drag or one tap. */
  readonly oneMove: boolean;
  /** The cocoa was still warm. */
  readonly cocoa: boolean;
  /** A clever trick: take from the ten, the express, or the bigger group in the cabin. */
  readonly clever: boolean;
  readonly vip: boolean;
  readonly golden: boolean;
  readonly big: boolean;
}

export const POINTS = {
  ride: 10,
  firstTry: 10,
  oneMove: 5,
  cocoa: 15,
  clever: 10,
  vip: 20,
} as const;

/** Points for a delivered turn: the ride and its bonuses, doubled by the golden express or the big cabin. */
export function turnPoints(score: TurnScore): number {
  const base =
    POINTS.ride +
    (score.firstTry ? POINTS.firstTry : 0) +
    (score.oneMove ? POINTS.oneMove : 0) +
    (score.clever ? POINTS.clever : 0) +
    (score.vip ? POINTS.vip : 0);
  const doubled = base * (score.golden ? 2 : 1) * (score.big ? 2 : 1);
  return doubled + (score.cocoa ? POINTS.cocoa : 0);
}

/** Round stars from first-try splits: 8 of 10 (or 6 of 8) earn three, half earn two. */
export function roundStars(firstTries: number, turns: number): 1 | 2 | 3 {
  const share = firstTries / turns;
  return share >= 0.75 ? 3 : share >= 0.5 ? 2 : 1;
}

export function isMastered(stage: GondolaStage, stars: number) {
  return stars >= (stage.strict ? 3 : 2);
}

/** How fast the snow cloud drifts in: seconds per turn, longer on two-digit levels. */
export const GONDOLA_PACES = [
  { id: 'off', label: 'paceOff', seconds: 0 },
  { id: 'relaxed', label: 'paceRelaxed', seconds: 30 },
  { id: 'normal', label: 'paceNormal', seconds: 18 },
  { id: 'fast', label: 'paceFast', seconds: 10 },
] as const;

export type GondolaPace = (typeof GONDOLA_PACES)[number]['id'];

export function cloudSeconds(pace: GondolaPace, stage: GondolaStage): number {
  const base = GONDOLA_PACES.find((item) => item.id === pace)!.seconds;
  return stage.representation === 'bunnies' ? base : Math.round(base * 1.6);
}

export function parseGondolaPace(value: unknown): GondolaPace {
  return GONDOLA_PACES.find((pace) => pace.id === value)?.id ?? 'off';
}

/** The sum as text, with the school's minus sign. */
export function sumText(item: GondolaItem) {
  return `${item.a} ${item.kind === 'add' ? '+' : '−'} ${item.b}`;
}
