import type { Level } from '../../core/catalog';
import type { MessageKey } from '../../core/messages';
import { CONSTELLATIONS, ConstellationId } from './star-constellations';

export type Random = () => number;

/** A post on the bridge: where it stands and whether its number is written on it. */
export interface Landmark {
  readonly value: number;
  readonly labelled: boolean;
}

/** One bridge: a number line from 0 to `max` with its posts. */
export interface StarLine {
  readonly max: number;
  /** Posts along the bridge, ends included. */
  readonly ticks: readonly Landmark[];
  /** The far post is hidden: the child is told where one step (10 or 100) sits instead. */
  readonly mystery: boolean;
  /** The size of one step on a mystery bridge, written on its second post. */
  readonly unit: number;
  /** Faded posts a landmark card brings back for one star, without numbers. */
  readonly hintTicks: readonly number[];
}

/** The mental maths trick a level practises; it also picks the trick card and the help. */
export type StarTrick =
  | 'count'
  | 'middle'
  | 'teens'
  | 'tens'
  | 'squash'
  | 'nearTen'
  | 'head'
  | 'sums20'
  | 'tensSums'
  | 'estimate'
  | 'thousand'
  | 'mystery';

export interface StarStage {
  readonly stage: number;
  /** The topic the level sits in on the games hub. */
  readonly group: MessageKey;
  readonly trick: StarTrick;
  /** The worked example on the level card. */
  readonly example: string;
  /** The bridge's far end; a mystery bridge picks its own per star. */
  readonly max: number;
  /** Gap between posts; 0 for posts only where there are labels. */
  readonly tickStep: number;
  /** Which posts carry their number: every post, or these values. */
  readonly labels: 'all' | readonly number[];
  /** Gap between the faded posts a landmark card brings back; 0 for none. */
  readonly hintStep: number;
  /** Half the catch window, as a share of the bridge. */
  readonly window: number;
  /** Half the golden window, as a share of the bridge. */
  readonly golden: number;
  /** Stars carry sums and differences instead of plain numbers. */
  readonly sums: boolean;
  /** Mix in the other item types (where did it land, which is further, middle star). */
  readonly mixed: boolean;
  /** Middle stars are one of the mixed types. */
  readonly middle: boolean;
  readonly constellation: ConstellationId;
}

export const starStages: readonly StarStage[] = [
  {
    stage: 1,
    group: 'starSmall',
    trick: 'count',
    example: '0 ··· 7 ··· 10',
    max: 10,
    tickStep: 1,
    labels: 'all',
    hintStep: 0,
    window: 0.1,
    golden: 0.03,
    sums: false,
    mixed: false,
    middle: false,
    constellation: 'heart',
  },
  {
    stage: 2,
    group: 'starSmall',
    trick: 'middle',
    example: '0 ··· 5 ··· 10',
    max: 10,
    tickStep: 1,
    labels: [0, 5, 10],
    hintStep: 0,
    window: 0.1,
    golden: 0.03,
    sums: false,
    mixed: false,
    middle: false,
    constellation: 'castle',
  },
  {
    stage: 3,
    group: 'starSmall',
    trick: 'teens',
    example: '0 ··· 10 ·· 14 ··· 20',
    max: 20,
    tickStep: 5,
    labels: [0, 10, 20],
    hintStep: 0,
    window: 0.08,
    golden: 0.03,
    sums: false,
    mixed: false,
    middle: false,
    constellation: 'fish',
  },
  {
    stage: 4,
    group: 'starHundred',
    trick: 'tens',
    example: '0 ··· 50 · 70 ··· 100',
    max: 100,
    tickStep: 10,
    labels: [0, 50, 100],
    hintStep: 0,
    window: 0.08,
    golden: 0.02,
    sums: false,
    mixed: false,
    middle: false,
    constellation: 'crown',
  },
  {
    stage: 5,
    group: 'starHundred',
    trick: 'squash',
    example: '0 · 10 · 20 · 30 ··· 100',
    max: 100,
    tickStep: 10,
    labels: 'all',
    hintStep: 0,
    window: 0.08,
    golden: 0.02,
    sums: false,
    mixed: true,
    middle: false,
    constellation: 'cat',
  },
  {
    stage: 6,
    group: 'starHundred',
    trick: 'nearTen',
    example: '59 · 60 · 61',
    max: 100,
    tickStep: 10,
    labels: [0, 50, 100],
    hintStep: 0,
    window: 0.07,
    golden: 0.02,
    sums: false,
    mixed: true,
    middle: true,
    constellation: 'rocket',
  },
  {
    stage: 7,
    group: 'starHundred',
    trick: 'head',
    example: '0 ········ 100',
    max: 100,
    tickStep: 0,
    labels: [0, 100],
    hintStep: 10,
    window: 0.07,
    golden: 0.02,
    sums: false,
    mixed: true,
    middle: true,
    constellation: 'unicorn',
  },
  {
    stage: 8,
    group: 'starSums',
    trick: 'sums20',
    example: '8 + 5 → 13',
    max: 20,
    tickStep: 0,
    labels: [0, 10, 20],
    hintStep: 5,
    window: 0.08,
    golden: 0.03,
    sums: true,
    mixed: true,
    middle: false,
    constellation: 'butterfly',
  },
  {
    stage: 9,
    group: 'starSums',
    trick: 'tensSums',
    example: '30 + 40 → 70',
    max: 100,
    tickStep: 0,
    labels: [0, 50, 100],
    hintStep: 10,
    window: 0.07,
    golden: 0.02,
    sums: true,
    mixed: true,
    middle: false,
    constellation: 'dragon',
  },
  {
    stage: 10,
    group: 'starSums',
    trick: 'estimate',
    example: '38 + 25 → about 60',
    max: 100,
    tickStep: 0,
    labels: [0, 50, 100],
    hintStep: 10,
    window: 0.08,
    golden: 0.02,
    sums: true,
    mixed: true,
    middle: false,
    constellation: 'boat',
  },
  {
    stage: 11,
    group: 'starBig',
    trick: 'thousand',
    example: '0 ··· 500 ··· 1000',
    max: 1000,
    tickStep: 100,
    labels: [0, 500, 1000],
    hintStep: 0,
    window: 0.08,
    golden: 0.02,
    sums: false,
    mixed: true,
    middle: false,
    constellation: 'moon',
  },
  {
    stage: 12,
    group: 'starBig',
    trick: 'mystery',
    example: '0 · 10 ··· ?',
    max: 0,
    tickStep: 0,
    labels: [0],
    hintStep: 0,
    window: 0.08,
    golden: 0.02,
    sums: false,
    mixed: true,
    middle: false,
    constellation: 'tree',
  },
];

export const starLevels: readonly Level[] = starStages.map((stage) => ({
  id: `star-catcher-${stage.stage}`,
  title: `starCatcher${stage.stage}` as MessageKey,
  description: `starCatcher${stage.stage}Help` as MessageKey,
  skills: ['number-line', stage.trick],
  format: 'star-catcher',
  group: stage.group,
}));

export function starStage(id: string | null | undefined): StarStage | undefined {
  const match = /^star-catcher-([1-9]\d*)$/.exec(id ?? '');
  return match ? starStages.find((stage) => stage.stage === Number(match[1])) : undefined;
}

/** Where a level sits in the list, counting from 1: the number a child sees. */
export function starPosition(stage: StarStage): number {
  return starStages.indexOf(stage) + 1;
}

/* ------------------------------------------------------------------------------------------ */
/* Items                                                                                        */
/* ------------------------------------------------------------------------------------------ */

/** Stars in a round before the finale: fewer when every star is a sum to work out. */
export function roundLength(stage: StarStage): number {
  return stage.sums ? 8 : 10;
}

/** The shooting-star finale: three stars, one after another, worth double. */
export const FINALE_LENGTH = 3;

/**
 * One star of a round.
 * - `place`: the star carries a number (or a sum, or "halfway between"): slide Nova there.
 * - `landed`: a star lies on the bridge without a label: pick its number.
 * - `compare`: two stars carry numbers: pick the one that lands further along.
 */
export type StarItem =
  | {
      readonly kind: 'place';
      readonly line: StarLine;
      readonly target: number;
      /** What the star carries: "63", "38 + 25", or the two ends of a middle star. */
      readonly label: string;
      /** For a middle star, the two numbers it sits halfway between. */
      readonly between?: readonly [number, number];
      readonly finale: boolean;
    }
  | {
      readonly kind: 'landed';
      readonly line: StarLine;
      readonly target: number;
      readonly options: readonly number[];
      readonly finale: false;
    }
  | {
      readonly kind: 'compare';
      readonly line: StarLine;
      readonly pair: readonly [number, number];
      readonly finale: false;
    };

const int = (random: Random, min: number, max: number) =>
  min + Math.floor(random() * (max - min + 1));
const pick = <T>(random: Random, items: readonly T[]): T => items[int(random, 0, items.length - 1)];
const shuffle = <T>(random: Random, items: readonly T[]): T[] => {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index--) {
    const other = int(random, 0, index);
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
};

/** The bridge for one star. Only a mystery bridge changes from star to star. */
export function lineFor(stage: StarStage, random: Random = Math.random): StarLine {
  if (stage.trick === 'mystery') {
    const unit = random() < 0.5 ? 10 : 100;
    const steps = int(random, 4, 8);
    return {
      max: unit * steps,
      ticks: [
        { value: 0, labelled: true },
        { value: unit, labelled: true },
      ],
      mystery: true,
      unit,
      hintTicks: Array.from({ length: steps - 2 }, (_, index) => unit * (index + 2)),
    };
  }
  const values = new Set<number>([0, stage.max]);
  if (stage.tickStep)
    for (let value = stage.tickStep; value < stage.max; value += stage.tickStep) values.add(value);
  if (stage.labels !== 'all') for (const value of stage.labels) values.add(value);
  const ticks = [...values]
    .sort((a, b) => a - b)
    .map((value) => ({
      value,
      labelled: stage.labels === 'all' || stage.labels.includes(value),
    }));
  const hintTicks: number[] = [];
  if (stage.hintStep)
    for (let value = stage.hintStep; value < stage.max; value += stage.hintStep)
      if (!values.has(value)) hintTicks.push(value);
  return { max: stage.max, ticks, mystery: false, unit: 0, hintTicks };
}

/** The numbers a level's stars may carry, before spreading them out. */
function range(stage: StarStage, line: StarLine): readonly [number, number] {
  if (stage.stage <= 2) return [1, line.max - 1];
  // The very ends are too easy: keep 3% away from them.
  const margin = Math.max(1, Math.ceil(line.max * 0.03));
  return [margin, line.max - margin];
}

/**
 * `count` numbers spread across [low, high] in steps of `step`: one from each equal slice of the
 * range, so the stars land all over the bridge instead of bunching up. Numbers already in
 * `used` are skipped while others are left; a small pool repeats only once it runs out, and
 * never twice in a row.
 */
export function spread(
  random: Random,
  count: number,
  low: number,
  high: number,
  step = 1,
  used: readonly number[] = [],
): number[] {
  const pool: number[] = [];
  for (let value = Math.ceil(low / step) * step; value <= high; value += step) pool.push(value);
  const picked: number[] = [];
  const taken = new Set(used);
  for (let slice = 0; slice < count; slice++) {
    const from = Math.floor((slice * pool.length) / count);
    const to = Math.max(from + 1, Math.floor(((slice + 1) * pool.length) / count));
    const fresh = pool.slice(from, to).filter((value) => !taken.has(value));
    const anywhere = pool.filter((value) => !taken.has(value));
    const last = picked.at(-1);
    const value = fresh.length
      ? pick(random, fresh)
      : anywhere.length
        ? pick(random, anywhere)
        : pick(
            random,
            pool.filter((v) => v !== last),
          );
    picked.push(value);
    taken.add(value);
    if (taken.size >= pool.length) {
      // A small pool (1 to 9) has run out: let numbers come back, but not the one just shown.
      taken.clear();
      taken.add(value);
    }
  }
  return picked;
}

/** "a + b" or "a − b" whose answer is `result`, within `max`. */
export function sumFor(stage: StarStage, result: number, random: Random): string {
  if (stage.trick === 'sums20') {
    if (random() < 0.5 && result >= 4) {
      const a = int(random, 2, result - 2);
      return `${a} + ${result - a}`;
    }
    const b = int(random, 2, Math.min(9, 20 - result));
    return `${result + b} − ${b}`;
  }
  if (stage.trick === 'tensSums') {
    if (result % 10 === 0) {
      if (random() < 0.5 && result >= 20) {
        const a = 10 * int(random, 1, result / 10 - 1);
        return `${a} + ${result - a}`;
      }
      const b = 10 * int(random, 1, Math.min(5, (100 - result) / 10));
      return `${result + b} − ${b}`;
    }
    // A two-digit number plus a single digit, usually stepping over a ten: 47 + 5.
    const b = int(random, 2, Math.min(9, result - 10));
    return `${result - b} + ${b}`;
  }
  // Two two-digit numbers: 38 + 25 or 72 − 29.
  if ((random() < 0.5 && result >= 30) || result > 88) {
    const a = int(random, 11, result - 11);
    return `${a} + ${result - a}`;
  }
  const b = int(random, 11, Math.min(49, 99 - result));
  return `${result + b} − ${b}`;
}

/** The answer to a sum label like "38 + 25" or "72 − 29". */
export function sumValue(label: string): number {
  const match = /^(\d+) ([+−]) (\d+)$/.exec(label);
  if (!match) return Number(label);
  const a = Number(match[1]);
  const b = Number(match[3]);
  return match[2] === '+' ? a + b : a - b;
}

/** Results for a sum level: tens results and "47 + 5" results mixed on the tens-sums level. */
function sumTargets(stage: StarStage, count: number, random: Random, used: number[]) {
  if (stage.trick === 'sums20') return spread(random, count, 3, 18, 1, used);
  if (stage.trick === 'tensSums') {
    const tens = Math.ceil(count / 2);
    const picked = spread(random, tens, 20, 90, 10, used);
    const rest = spread(random, count - tens, 14, 95, 1, [...used, ...picked]).map((value) =>
      value % 10 === 0 ? value + 3 : value,
    );
    return shuffle(random, [...picked, ...rest]);
  }
  return spread(random, count, 22, 95, 1, used);
}

/** The plain numbers for a round, with the level's special shares built in. */
function placeTargets(stage: StarStage, line: StarLine, count: number, random: Random) {
  const [low, high] = range(stage, line);
  if (stage.trick === 'tens') return spread(random, count, 10, 90, 10);
  if (stage.trick === 'squash' || stage.trick === 'thousand') {
    // The squash zone, where children squeeze big numbers toward 0: at least 30% of stars.
    const zone: readonly [number, number] = stage.trick === 'squash' ? [11, 30] : [100, 250];
    const step = stage.trick === 'thousand' ? 10 : 1;
    const inZone = Math.ceil(count * 0.3);
    const zoned = spread(random, inZone, zone[0], zone[1], step);
    if (stage.trick === 'thousand') {
      // Hundreds first, to build the skeleton, then any number.
      const hundreds = spread(random, 3, 100, 900, 100, zoned);
      const rest = spread(random, count - inZone - 3, low, high, 1, [...zoned, ...hundreds]);
      return [...hundreds, ...shuffle(random, [...zoned, ...rest])];
    }
    const rest = spread(random, count - inZone, low, high, 1, zoned);
    return shuffle(random, [...zoned, ...rest]);
  }
  if (stage.trick === 'nearTen') {
    // Two pairs either side of a ten, one straight after the other: 59 then 61.
    const tens = shuffle(random, [2, 3, 4, 5, 6, 7, 8, 9]).slice(0, 2);
    const pairs = tens.map((ten) =>
      random() < 0.5 ? [ten * 10 - 1, ten * 10 + 1] : [ten * 10 + 1, ten * 10 - 1],
    );
    const rest = spread(random, count - 4, low, high, 1, pairs.flat());
    const order = shuffle(random, [...rest.map((value) => [value]), ...pairs]);
    return order.flat();
  }
  return spread(random, count, low, high);
}

/** Three or four number buttons for a landed star: far enough apart to tell by position. */
export function landedOptions(line: StarLine, target: number, random: Random): number[] {
  const gap = line.max * 0.18;
  const step = line.max >= 1000 ? 10 : line.mystery ? line.unit / 2 : 1;
  const options = [target];
  for (let attempt = 0; attempt < 200 && options.length < 3; attempt++) {
    const value = Math.round(int(random, step, line.max - step) / step) * step;
    if (options.every((option) => Math.abs(option - value) >= gap)) options.push(value);
  }
  return shuffle(random, options);
}

/** Two numbers either side of a landmark, close enough that the tens digit matters. */
export function comparePair(line: StarLine, random: Random): [number, number] {
  const unit = line.mystery ? line.unit : line.max >= 1000 ? 100 : line.max >= 100 ? 10 : 5;
  const small = line.max >= 1000 ? 10 : line.mystery ? line.unit / 10 : 1;
  const steps = Math.max(2, Math.floor(line.max / unit));
  const landmark = unit * int(random, 1, steps - 1);
  const below = landmark - small * int(random, 1, 3);
  const above = landmark + small * int(random, 1, 3);
  return random() < 0.5 ? [below, above] : [above, below];
}

function middleItem(stage: StarStage, line: StarLine, random: Random): StarItem {
  const gap = pick(random, [20, 40, 60]);
  const from = 10 * int(random, 0, (100 - gap) / 10);
  const to = from + gap;
  return {
    kind: 'place',
    line,
    target: (from + to) / 2,
    label: `${from} ↔ ${to}`,
    between: [from, to],
    finale: false,
  };
}

/**
 * Which stars of a round are one of the other item types: about one in five, never in the
 * finale, and never between two neighbours of a ten that belong one straight after the other.
 */
function mixedSlots(stage: StarStage, count: number, places: readonly number[], random: Random) {
  if (!stage.mixed) return new Set<number>();
  const splits = (slot: number, before: number) => {
    const at = slot - before;
    const a = places[at - 1];
    const b = places[at];
    return a !== undefined && b !== undefined && Math.abs(a - b) === 2 && (a + b) % 20 === 0;
  };
  const slots: number[] = [];
  for (const [from, to] of [
    [2, Math.floor(count / 2) - 1],
    [Math.floor(count / 2) + 1, count - 1],
  ]) {
    let slot = int(random, from, to);
    while (splits(slot, slots.length) && slot < to) slot++;
    while (splits(slot, slots.length) && slot > from) slot--;
    slots.push(slot);
  }
  return new Set(slots);
}

/** A whole round: the level's stars, then the three shooting stars of the finale. */
export function createRound(stage: StarStage, random: Random = Math.random): StarItem[] {
  const count = roundLength(stage);
  const total = count + FINALE_LENGTH;
  const line = lineFor(stage, random);
  const mixed = stage.mixed ? 2 : 0;
  const places = stage.sums
    ? sumTargets(stage, total - mixed, random, [])
    : line.mystery
      ? []
      : placeTargets(stage, line, total - mixed, random);
  const slots = mixedSlots(stage, count, places, random);
  const kinds: ('landed' | 'compare' | 'middle')[] = ['landed', 'compare'];
  if (stage.middle) kinds.push('middle');
  const order = shuffle(random, kinds);
  const items: StarItem[] = [];
  let cursor = 0;
  for (let index = 0; index < total; index++) {
    const finale = index >= count;
    // A mystery bridge changes length from star to star, so its numbers are picked per star.
    const own = line.mystery ? lineFor(stage, random) : line;
    const fresh = () => spread(random, 1, own.unit / 2, own.max - own.unit / 2, own.unit / 2)[0];
    if (slots.has(index)) {
      const kind = order[[...slots].indexOf(index) % order.length];
      if (kind === 'middle') items.push(middleItem(stage, own, random));
      else if (kind === 'compare')
        items.push({ kind, line: own, pair: comparePair(own, random), finale: false });
      else {
        // Landed stars are plain numbers spread over the bridge, even on sum levels.
        const step = own.mystery ? own.unit / 2 : own.max >= 1000 ? 10 : 1;
        const [low, high] = range(stage, own);
        const used = items.flatMap((item) => (item.kind === 'compare' ? [] : [item.target]));
        const target = own.mystery ? fresh() : spread(random, 1, low, high, step, used)[0];
        items.push({
          kind,
          line: own,
          target,
          options: landedOptions(own, target, random),
          finale: false,
        });
      }
      continue;
    }
    const target = line.mystery ? fresh() : places[cursor++];
    const label = stage.sums ? sumFor(stage, target, random) : String(target);
    items.push({ kind: 'place', line: own, target, label, finale });
  }
  return items;
}

/* ------------------------------------------------------------------------------------------ */
/* Catching                                                                                     */
/* ------------------------------------------------------------------------------------------ */

/** Where a number sits on the bridge, from 0 (left post) to 1 (right post). */
export function share(line: StarLine, value: number): number {
  return Math.max(0, Math.min(1, value / line.max));
}

/**
 * Half the catch window after `misses` misses on this star. From the third miss on it widens a
 * little each time, so a child is never stuck; it never covers more than a quarter each way.
 */
export function catchWindow(stage: StarStage, misses: number): number {
  return Math.min(0.25, stage.window * (1 + 0.5 * Math.max(0, misses - 2)));
}

export type CatchResult =
  | { readonly caught: true; readonly golden: boolean; readonly closeness: number }
  | { readonly caught: false; readonly direction: 'further' | 'back' };

/** Whether Nova's net at `net` (0 to 1) catches a star that belongs at `target`. */
export function tryCatch(
  stage: StarStage,
  line: StarLine,
  target: number,
  net: number,
  misses: number,
): CatchResult {
  const off = net - share(line, target);
  const window = catchWindow(stage, misses);
  if (Math.abs(off) <= window + 1e-9) {
    return {
      caught: true,
      golden: Math.abs(off) <= stage.golden + 1e-9,
      closeness: 1 - Math.abs(off) / window,
    };
  }
  return { caught: false, direction: off < 0 ? 'further' : 'back' };
}

/* ------------------------------------------------------------------------------------------ */
/* Points, streak, stars                                                                        */
/* ------------------------------------------------------------------------------------------ */

/** Three first-try catches in a row light the comet trail: points double until a miss. */
export const COMET_STREAK = 3;
/** The most stardust a star carries while it falls. */
export const STARDUST = 15;

export interface Catch {
  readonly firstTry: boolean;
  readonly golden: boolean;
  /** How close inside the window, from 0 (at the edge) to 1 (dead on). */
  readonly closeness: number;
  /** The comet trail was already lit before this catch. */
  readonly comet: boolean;
  readonly finale: boolean;
  /** Stardust left on the star when it was caught. */
  readonly stardust: number;
}

/** Points for one caught star. */
export function catchPoints(caught: Catch): number {
  const base = caught.firstTry ? 10 + Math.round(10 * caught.closeness) : 5;
  const multiplier = (caught.golden ? 2 : 1) * (caught.comet ? 2 : 1) * (caught.finale ? 2 : 1);
  return base * multiplier + caught.stardust;
}

/** Round stars from first-try catches: 8 of 10 earns three, 5 earns two, finishing earns one. */
export function roundStars(firstTries: number, total: number): 1 | 2 | 3 {
  const part = total ? firstTries / total : 0;
  return part >= 0.8 ? 3 : part >= 0.5 ? 2 : 1;
}

export function isMastered(stars: number): boolean {
  return stars >= 2;
}

/* ------------------------------------------------------------------------------------------ */
/* Pace                                                                                         */
/* ------------------------------------------------------------------------------------------ */

/** How long a star takes to fall to the bridge, plain number and sum. */
export const STAR_PACES = [
  { id: 'off', label: 'paceOff', plain: 0, sums: 0 },
  { id: 'relaxed', label: 'paceRelaxed', plain: 20, sums: 30 },
  { id: 'normal', label: 'paceNormal', plain: 12, sums: 20 },
  { id: 'fast', label: 'paceFast', plain: 7, sums: 12 },
] as const;

export type StarPace = (typeof STAR_PACES)[number]['id'];

export function fallSeconds(pace: StarPace, sums: boolean): number {
  const option = STAR_PACES.find((item) => item.id === pace)!;
  return sums ? option.sums : option.plain;
}

export function parseStarPace(value: unknown): StarPace {
  return STAR_PACES.find((pace) => pace.id === value)?.id ?? 'off';
}

/** Stardust left on a star that has fallen `fall` of the way (0 at the top, 1 at the bridge). */
export function stardust(fall: number): number {
  return Math.round(STARDUST * Math.max(0, 1 - fall));
}

/* ------------------------------------------------------------------------------------------ */
/* Telling where Nova is without giving the answer                                              */
/* ------------------------------------------------------------------------------------------ */

export type Whereabouts =
  | { readonly kind: 'about'; readonly value: number }
  | {
      readonly kind: 'zone';
      readonly zone: 'start' | 'nearStart' | 'beforeHalf' | 'half' | 'pastHalf' | 'nearEnd' | 'end';
    };

/**
 * Where Nova stands, as a screen reader hears it. On a bridge whose posts are numbered close
 * together (every number, every ten) it is "about" the nearest numbered post, which a seeing
 * child reads off the bridge anyway. Elsewhere it is only a coarse zone, never a number,
 * because the number would be the answer.
 */
export function whereabouts(line: StarLine, net: number): Whereabouts {
  const labelled = line.ticks.filter((tick) => tick.labelled).map((tick) => tick.value);
  const gaps = labelled.slice(1).map((value, index) => value - labelled[index]);
  if (!line.mystery && gaps.length && Math.max(...gaps) <= line.max * 0.1) {
    const at = net * line.max;
    const value = labelled.reduce((best, v) => (Math.abs(v - at) < Math.abs(best - at) ? v : best));
    return { kind: 'about', value };
  }
  const zone =
    net < 0.04
      ? 'start'
      : net < 0.3
        ? 'nearStart'
        : net < 0.45
          ? 'beforeHalf'
          : net <= 0.55
            ? 'half'
            : net < 0.7
              ? 'pastHalf'
              : net < 0.96
                ? 'nearEnd'
                : 'end';
  return { kind: 'zone', zone };
}

/* ------------------------------------------------------------------------------------------ */
/* Help after a miss: the rule, never the spot                                                  */
/* ------------------------------------------------------------------------------------------ */

export type LandmarkHint =
  | 'hintMiddleQuestion'
  | 'hintFindMiddle'
  | 'hintNearTen'
  | 'hintNearHundred'
  | 'hintCountSteps'
  | 'hintWorkOut'
  | 'hintTeens'
  | 'hintCountPosts';

/**
 * The landmark question on the help card, picked by the level and how many tries this star
 * has had, never by the answer.
 */
export function landmarkHint(stage: StarStage, line: StarLine, misses: number): LandmarkHint {
  const turn = Math.max(0, misses - 2);
  const options: LandmarkHint[] = line.mystery
    ? ['hintCountSteps']
    : stage.trick === 'count'
      ? ['hintCountPosts', 'hintFindMiddle']
      : stage.trick === 'teens'
        ? ['hintTeens', 'hintMiddleQuestion']
        : stage.sums
          ? ['hintWorkOut', 'hintMiddleQuestion']
          : line.max >= 1000
            ? ['hintMiddleQuestion', 'hintNearHundred']
            : line.max >= 100
              ? ['hintMiddleQuestion', 'hintFindMiddle', 'hintNearTen']
              : ['hintMiddleQuestion', 'hintFindMiddle'];
  return options[turn % options.length];
}

/** The middle of the bridge, for "Is 63 more or less than 50, the middle?". */
export function middleOf(line: StarLine): number {
  return line.max / 2;
}

export const ALL_CONSTELLATIONS = CONSTELLATIONS.map((item) => item.id);
