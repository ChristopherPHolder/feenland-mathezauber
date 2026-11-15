import type { Level } from '../../core/catalog';
import type { MessageKey } from '../../core/messages';

export type Random = () => number;

/** An order: a tray of `rows` rows with `cols` cookies in each row. */
export interface Fact {
  readonly rows: number;
  readonly cols: number;
}

/**
 * The derived-fact trick a level teaches. Every trick comes down to "cut the tray into trays
 * you know", so the level only decides which cut glows and which cut earns the trick bonus.
 */
export type BakeryTrick = 'read' | 'turn' | 'oneMore' | 'double' | 'ghost' | 'fiveSplit' | 'free';

/** How the tray is drawn: real cookies, cookies with labelled sides, or a bare area model. */
export type TrayLook = 'cookies' | 'blocks' | 'area';

export type CutDir = 'rows' | 'cols';

export interface BakeryStage {
  readonly stage: number;
  /** The topic the level sits in on the games hub. */
  readonly group: MessageKey;
  readonly trick: BakeryTrick;
  /** The times table the trick is about (3 for "×3 = ×2 + a row"); 0 when it is any. */
  readonly table: number;
  /** The worked example on the level card. */
  readonly example: string;
  readonly look: TrayLook;
  /** False on the first two levels: the child reads the tray and answers the total. */
  readonly cut: boolean;
  /** How many cuts a tray may take; doubling twice needs more than one. */
  readonly maxCuts: number;
  /** Whether Bruno offers a ghost row on trays of 4 or 9 rows. */
  readonly ghost: boolean;
  /** "Can you cut it another way?" after a baked tray. */
  readonly anotherWay: boolean;
  /** Stars the round needs to count as mastered. */
  readonly masteryStars: 2 | 3;
  /** Every order the level may ask for, as it lands on the counter. */
  readonly pool: () => readonly Fact[];
}

/** Six orders, then the party cake. */
export const ORDERS = 6;
export const ROUND_LENGTH = ORDERS + 1;
/** Three first-try orders in a row light the golden oven: points double until a slip. */
export const GOLDEN_STREAK = 3;

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, index) => from + index);
const table = (rows: number, cols: readonly number[]): Fact[] =>
  cols.map((value) => ({ rows, cols: value }));

/** The hardest facts, for the master baker. */
export const HARD_FACTS: readonly Fact[] = [
  { rows: 6, cols: 7 },
  { rows: 7, cols: 8 },
  { rows: 8, cols: 6 },
  { rows: 7, cols: 7 },
  { rows: 9, cols: 7 },
  { rows: 8, cols: 8 },
  { rows: 6, cols: 9 },
  { rows: 8, cols: 4 },
  { rows: 7, cols: 6 },
  { rows: 9, cols: 8 },
  { rows: 6, cols: 6 },
  { rows: 8, cols: 9 },
  { rows: 7, cols: 4 },
  { rows: 9, cols: 6 },
];

export const bakeryStages: readonly BakeryStage[] = [
  {
    stage: 1,
    group: 'bakeryFriendly',
    trick: 'read',
    table: 0,
    example: '3 × 5 = 15',
    look: 'cookies',
    cut: false,
    maxCuts: 0,
    ghost: false,
    anotherWay: false,
    masteryStars: 2,
    pool: () => range(2, 5).flatMap((rows) => table(rows, [2, 5, 10])),
  },
  {
    stage: 2,
    group: 'bakeryFriendly',
    trick: 'turn',
    table: 0,
    example: '5 × 7 = 7 × 5',
    look: 'cookies',
    cut: false,
    maxCuts: 0,
    ghost: false,
    anotherWay: false,
    masteryStars: 2,
    // Rows of the hard number: turned round, every row is a friendly 2, 5 or 10.
    pool: () =>
      [2, 5, 10].flatMap((rows) =>
        table(
          rows,
          range(3, 9).filter((n) => n !== rows),
        ),
      ),
  },
  {
    stage: 3,
    group: 'bakeryOneMore',
    trick: 'oneMore',
    table: 3,
    example: '3 × 6 = 2 × 6 + 6',
    look: 'cookies',
    cut: true,
    maxCuts: 1,
    ghost: false,
    anotherWay: false,
    masteryStars: 2,
    pool: () => table(3, range(2, 10)),
  },
  {
    stage: 4,
    group: 'bakeryOneMore',
    trick: 'oneMore',
    table: 6,
    example: '6 × 7 = 5 × 7 + 7',
    look: 'cookies',
    cut: true,
    maxCuts: 1,
    ghost: false,
    anotherWay: false,
    masteryStars: 2,
    pool: () => table(6, range(2, 10)),
  },
  {
    stage: 5,
    group: 'bakeryDoubling',
    trick: 'double',
    table: 4,
    example: '4 × 7 = 2 × 7 + 2 × 7',
    look: 'cookies',
    cut: true,
    maxCuts: 1,
    ghost: false,
    anotherWay: false,
    masteryStars: 2,
    pool: () => table(4, range(2, 10)),
  },
  {
    stage: 6,
    group: 'bakeryDoubling',
    trick: 'double',
    table: 8,
    example: '8 × 6 = 4 × 6 + 4 × 6',
    look: 'cookies',
    cut: true,
    maxCuts: 3,
    ghost: false,
    anotherWay: false,
    masteryStars: 2,
    pool: () => table(8, range(2, 10)),
  },
  {
    stage: 7,
    group: 'bakeryDoubling',
    trick: 'double',
    table: 6,
    example: '6 × 7 = 3 × 7 + 3 × 7',
    look: 'blocks',
    cut: true,
    maxCuts: 1,
    ghost: false,
    anotherWay: false,
    masteryStars: 2,
    pool: () => table(6, range(3, 10)),
  },
  {
    stage: 8,
    group: 'bakeryOneLess',
    trick: 'ghost',
    table: 9,
    example: '9 × 6 = 10 × 6 − 6',
    look: 'blocks',
    cut: true,
    maxCuts: 1,
    ghost: true,
    anotherWay: false,
    masteryStars: 2,
    pool: () => table(9, range(2, 10)),
  },
  {
    stage: 9,
    group: 'bakeryBig',
    trick: 'fiveSplit',
    table: 7,
    example: '7 × 8 = 5 × 8 + 2 × 8',
    look: 'blocks',
    cut: true,
    maxCuts: 1,
    ghost: false,
    anotherWay: true,
    masteryStars: 2,
    pool: () => table(7, range(3, 9)),
  },
  {
    stage: 10,
    group: 'bakeryBig',
    trick: 'free',
    table: 0,
    example: '8 × 4 = 5 × 4 + 3 × 4',
    look: 'blocks',
    cut: true,
    maxCuts: 1,
    ghost: true,
    anotherWay: true,
    masteryStars: 2,
    pool: () =>
      [3, 4, 6, 7, 8, 9].flatMap((rows) =>
        table(
          rows,
          range(2, 10).filter((cols) => rows * cols <= 60),
        ),
      ),
  },
  {
    stage: 11,
    group: 'bakeryChallenge',
    trick: 'free',
    table: 0,
    example: '7 × 9 = 7 × 5 + 7 × 4',
    look: 'area',
    cut: true,
    maxCuts: 1,
    ghost: true,
    anotherWay: true,
    masteryStars: 2,
    pool: () => range(3, 10).flatMap((rows) => table(rows, range(3, 10))),
  },
  {
    stage: 12,
    group: 'bakeryChallenge',
    trick: 'free',
    table: 0,
    example: '8 × 7 = 5 × 7 + 3 × 7',
    look: 'area',
    cut: true,
    maxCuts: 1,
    ghost: true,
    anotherWay: true,
    masteryStars: 3,
    pool: () => HARD_FACTS,
  },
];

export const TOTAL_STAGES = bakeryStages.length;

export const bakeryLevels: readonly Level[] = bakeryStages.map((stage) => ({
  id: `bakery-${stage.stage}`,
  title: `bakery${stage.stage}` as MessageKey,
  description: `bakery${stage.stage}Help` as MessageKey,
  skills: ['times-tables', 'derived-facts', stage.trick],
  format: 'bakery',
  group: stage.group,
}));

export function bakeryStage(id: string | null | undefined): BakeryStage | undefined {
  const match = /^bakery-([1-9]\d*)$/.exec(id ?? '');
  return match ? bakeryStages.find((stage) => stage.stage === Number(match[1])) : undefined;
}

export function bakeryPosition(stage: BakeryStage): number {
  return bakeryStages.indexOf(stage) + 1;
}

export const factKey = (fact: Fact) => `${fact.rows}x${fact.cols}`;
export const sameFact = (a: Fact, b: Fact) =>
  (a.rows === b.rows && a.cols === b.cols) || (a.rows === b.cols && a.cols === b.rows);
export const product = (fact: Fact) => fact.rows * fact.cols;

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

/**
 * Six orders and the party cake. Facts the child missed before come back first if they fit the
 * level ("incremental rehearsal": a missed fact between known ones), no fact comes twice, and
 * the cake is the biggest tray left. On the "one row less" level one order is a ×4 tray, which
 * the ghost row turns into a friendly ×5.
 */
export function createRound(
  stage: BakeryStage,
  missed: readonly Fact[] = [],
  random: Random = Math.random,
): Fact[] {
  // A fact and its turnaround are the same cookies: keep one of them.
  const pool = stage
    .pool()
    .filter((fact, index, all) => all.findIndex((other) => sameFact(other, fact)) === index);
  const inPool = (fact: Fact) => pool.find((item) => sameFact(item, fact));
  const back = missed
    .map(inPool)
    .filter((fact): fact is Fact => !!fact)
    .filter((fact, index, all) => all.findIndex((other) => sameFact(other, fact)) === index)
    .slice(0, stage.stage === 12 ? ORDERS : 2);
  const rest = shuffle(
    random,
    pool.filter((fact) => !back.some((item) => sameFact(item, fact))),
  );
  // The cake: the biggest tray that is not a returning fact.
  const cake = [...rest].sort((a, b) => product(b) - product(a))[0] ?? back[back.length - 1];
  const fresh = rest.filter((fact) => fact !== cake);
  const orders: Fact[] = fresh.slice(0, ORDERS - back.length);
  // Returning facts sit second and fifth, between new ones (first on the master level).
  back.forEach((fact, index) =>
    orders.splice(stage.stage === 12 ? index : Math.min(orders.length, 1 + index * 3), 0, fact),
  );
  while (orders.length < ORDERS) orders.push(fresh[orders.length % Math.max(1, fresh.length)]);
  if (stage.trick === 'ghost') {
    const four = { rows: 4, cols: [3, 5, 6, 7, 8, 10][int(random, 0, 5)] };
    orders.splice(3, 1, four);
  }
  const turned = (fact: Fact) =>
    stage.trick === 'free' && stage.stage < 12 && random() < 0.5
      ? { rows: fact.cols, cols: fact.rows }
      : fact;
  return [...orders, cake].map(turned);
}

/** Puts a missed fact back later in the same round, if a slot before the cake is free to swap. */
export function rehearse(orders: readonly Fact[], index: number, fact: Fact): Fact[] {
  const slot = index + 2;
  if (slot >= ORDERS || orders.slice(index + 1, ORDERS).some((item) => sameFact(item, fact)))
    return [...orders];
  return orders.map((item, at) => (at === slot ? fact : item));
}

/** Seconds on the oven timer for one tray: more for a bigger tray, less without a cut. */
export const BAKERY_PACES = [
  { id: 'off', label: 'paceOff', base: 0 },
  { id: 'relaxed', label: 'paceRelaxed', base: 60 },
  { id: 'normal', label: 'paceNormal', base: 40 },
  { id: 'fast', label: 'paceFast', base: 25 },
] as const;

export type BakeryPace = (typeof BAKERY_PACES)[number]['id'];

export function ovenSeconds(pace: BakeryPace, fact: Fact, cut: boolean): number {
  const base = BAKERY_PACES.find((item) => item.id === pace)?.base ?? 0;
  if (!base) return 0;
  const size = 0.7 + 0.6 * Math.min(1, product(fact) / 60);
  return Math.round(base * size * (cut ? 1 : 0.6));
}

export function parseBakeryPace(value: unknown): BakeryPace {
  return BAKERY_PACES.find((pace) => pace.id === value)?.id ?? 'off';
}

/** What one baked tray earned. */
export interface Bake {
  readonly firstTry: boolean;
  readonly trick: boolean;
  /** Baked before the oven timer ran out. */
  readonly perfect: boolean;
  readonly golden: boolean;
  readonly cake: boolean;
}

export const POINTS = { order: 10, firstTry: 10, trick: 10, perfect: 15, secondWay: 15 } as const;

/** Points for a tray: the cake and the golden oven double the tray, not the timer bonus. */
export function bakePoints(bake: Bake): number {
  const tray =
    (POINTS.order + (bake.firstTry ? POINTS.firstTry : 0) + (bake.trick ? POINTS.trick : 0)) *
    (bake.cake ? 2 : 1) *
    (bake.golden ? 2 : 1);
  return tray + (bake.perfect ? POINTS.perfect : 0);
}

/** Three stars when every tray but one was right first time, two for four of seven. */
export function roundStars(firstTries: number): 1 | 2 | 3 {
  return firstTries >= ROUND_LENGTH - 1 ? 3 : firstTries >= 4 ? 2 : 1;
}

export function isMastered(stage: BakeryStage, stars: number): boolean {
  return stars >= stage.masteryStars;
}
