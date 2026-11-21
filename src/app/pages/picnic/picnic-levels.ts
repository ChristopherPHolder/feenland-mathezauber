import type { Level } from '../../core/catalog';
import type { MessageKey } from '../../core/messages';
import {
  compareFractions,
  equalSizes,
  equivalent,
  Fraction,
  frac,
  fractionOfSet,
  TICKS,
  unevenSizes,
} from './fractions';

export type Random = () => number;

/** What is shared: round foods are cut from the middle, strips from end to end. */
export type Food = 'pie' | 'bar' | 'ribbon' | 'cake';

export const roundFood = (food: Food) => food === 'pie' || food === 'cake';

/** A food drawn already cut: the size of each piece (shares of the whole) and which have jam. */
export interface Drawing {
  readonly food: Food;
  readonly sizes: readonly number[];
  readonly shaded: readonly boolean[];
}

/** Cut the food fairly for everyone on the blanket. */
export interface CutTask {
  readonly kind: 'cut';
  readonly food: Food;
  readonly parts: number;
  /** Cuts already made ("halve the halves"); they stay. */
  readonly preset: readonly number[];
}
/** Is this cut fair? */
export interface FairTask {
  readonly kind: 'fair';
  readonly food: Food;
  readonly sizes: readonly number[];
  readonly fair: boolean;
}
/** Which fraction is the friend's share? */
export interface NameTask {
  readonly kind: 'name';
  readonly food: Food;
  readonly share: Fraction;
  readonly choices: readonly Fraction[];
}
/** Which plate shows the fraction? */
export interface PickTask {
  readonly kind: 'pick';
  readonly share: Fraction;
  readonly plates: readonly Drawing[];
  readonly answer: number;
}
/** Who gets more? Two blankets, the same food on each. */
export interface CompareTask {
  readonly kind: 'compare';
  readonly food: Food;
  readonly left: Fraction;
  readonly right: Fraction;
  /** The food sits under a cloth: only the friends and the fraction show. */
  readonly covered: boolean;
  /** Offer "the same" as an answer. */
  readonly same: boolean;
}
/** Deal a basket of berries onto plates, then say how many `share` of them is. */
export interface DealTask {
  readonly kind: 'deal';
  readonly share: Fraction;
  readonly total: number;
  /** The handfuls a child may deal to every plate at once. */
  readonly handfuls: readonly number[];
  readonly choices: readonly number[];
}

export type Task = CutTask | FairTask | NameTask | PickTask | CompareTask | DealTask;
export type TaskKind = Task['kind'];

export interface PicnicStage {
  readonly stage: number;
  /** The topic on the games hub. */
  readonly group: MessageKey;
  /** What the level is about, for the hub's skill list. */
  readonly skill: string;
  /** Stars the round needs to count as mastered. */
  readonly masteryStars: 2 | 3;
  /** A worked example for the hub card; "{of}" becomes the local word for "of". */
  readonly example: string;
  /** Six shares, then the big cake. */
  readonly make: (random: Random) => Task[];
}

/** Six shares, then the big cake. */
export const SHARES = 6;
export const ROUND_LENGTH = SHARES + 1;
/** Three first-try shares in a row bring out the golden spoon: points double until a slip. */
export const GOLDEN_STREAK = 3;

const int = (random: Random, min: number, max: number) =>
  min + Math.floor(random() * (max - min + 1));
const pick = <T>(random: Random, items: readonly T[]): T => items[int(random, 0, items.length - 1)];
export function shuffle<T>(random: Random, items: readonly T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index--) {
    const other = int(random, 0, index);
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

// ---- Task makers ------------------------------------------------------------------------------

const cutTask = (food: Food, parts: number, halved = false): CutTask => ({
  kind: 'cut',
  food,
  parts,
  // "Halve the halves": a round food comes cut top to bottom, a strip across the middle.
  preset: halved ? (roundFood(food) ? [0, TICKS / 2] : [TICKS / 2]) : [],
});

function fairTask(random: Random, food: Food, parts: number, fair: boolean): FairTask {
  return {
    kind: 'fair',
    food,
    fair,
    sizes: fair
      ? equalSizes(parts)
      : unevenSizes(parts, int(random, 0, parts - 1), 0.4 + random() * 0.2),
  };
}

/** Wrong answers a child might really give for `share`, never the same amount as it. */
export function nameChoices(random: Random, share: Fraction): Fraction[] {
  const { n, d } = share;
  const units = [2, 3, 4, 5, 6, 8, 10].filter((x) => x !== d);
  const candidates: Fraction[] = isUnitShare(share)
    ? [
        ...units.sort((a, b) => Math.abs(a - d) - Math.abs(b - d)).map((x) => frac(1, x)),
        frac(d - 1, d),
      ]
    : [
        frac(d - n, d),
        frac(n, d + 1),
        frac(n + 1, d),
        frac(n - 1, d),
        frac(1, d),
        frac(n, d - 1),
        frac(n, d + 2),
        frac(1, d + 1),
      ];
  const wrong = candidates
    .filter((f) => f.n > 0 && f.d > 1 && f.n < f.d && !equivalent(f, share))
    .filter(
      (f, index, all) => all.findIndex((other) => other.n === f.n && other.d === f.d) === index,
    )
    .slice(0, 4);
  return shuffle(random, [share, ...shuffle(random, wrong).slice(0, 3)]);
}
const isUnitShare = (f: Fraction) => f.n === 1;

function nameTask(random: Random, food: Food, share: Fraction): NameTask {
  return { kind: 'name', food, share, choices: nameChoices(random, share) };
}

const drawing = (food: Food, sizes: readonly number[], jam: number): Drawing => ({
  food,
  sizes,
  shaded: sizes.map((_, index) => index < jam),
});

/**
 * Four plates: the share cut fairly, the same pieces cut unfairly, the wrong number of pieces,
 * and the wrong number with jam. None of the others is the same amount as the share.
 */
export function pickTask(random: Random, food: Food, share: Fraction): PickTask {
  const { n, d } = share;
  const right = drawing(food, equalSizes(d), n);
  const uneven = drawing(food, unevenSizes(d, int(random, 0, d - 1), 0.5), n);
  const otherD =
    [d + 1, d - 1, d * 2, d + 2].find((x) => x > n && x > 1 && !equivalent(frac(n, x), share)) ??
    d + 1;
  const parts = drawing(food, equalSizes(otherD), n);
  const jam = [n + 1, n - 1, d - n].find((x) => x > 0 && x < d && !equivalent(frac(x, d), share));
  const fourth = jam ? drawing(food, equalSizes(d), jam) : drawing(food, equalSizes(otherD + 1), n);
  const plates = shuffle(random, [right, uneven, parts, fourth]);
  return { kind: 'pick', share, plates, answer: plates.indexOf(right) };
}

function compareTask(
  food: Food,
  left: Fraction,
  right: Fraction,
  covered: boolean,
  same: boolean,
): CompareTask {
  return { kind: 'compare', food, left, right, covered, same };
}

/** Plausible slips for "n⁄d of total": one plate, all of it, one off, the number of plates. */
export function dealChoices(random: Random, share: Fraction, total: number): number[] {
  const answer = fractionOfSet(share, total) ?? 0;
  const plate = total / share.d;
  const wrong = [plate, answer + 1, answer - 1, total - answer, answer + 2, share.d, answer - 2]
    .filter((x) => x > 0 && x !== answer && x <= total)
    .filter((x, index, all) => all.indexOf(x) === index);
  return [answer, ...shuffle(random, wrong).slice(0, 3)].sort((a, b) => a - b);
}

function dealTask(
  random: Random,
  share: Fraction,
  total: number,
  handfuls: readonly number[],
): DealTask {
  return { kind: 'deal', share, total, handfuls, choices: dealChoices(random, share, total) };
}

/** A basket for `share` from `min` to `max` berries that shares out evenly. */
function basket(random: Random, share: Fraction, min: number, max: number): number {
  const sizes: number[] = [];
  for (let total = min; total <= max; total++) if (total % share.d === 0) sizes.push(total);
  return pick(random, sizes.length ? sizes : [share.d * 2]);
}

const UNITS = [2, 3, 4, 6, 8].map((d) => frac(1, d));
const NON_UNITS = [
  frac(2, 3),
  frac(3, 4),
  frac(2, 4),
  frac(3, 6),
  frac(4, 6),
  frac(5, 6),
  frac(3, 8),
  frac(5, 8),
  frac(6, 8),
  frac(7, 8),
];
const RIBBONS = [
  frac(1, 2),
  frac(1, 3),
  frac(2, 3),
  frac(1, 4),
  frac(3, 4),
  frac(1, 5),
  frac(2, 5),
  frac(3, 5),
  frac(1, 6),
  frac(5, 6),
  frac(3, 8),
  frac(3, 10),
  frac(7, 10),
];
/** Pairs that are the same amount, and pairs that only look alike. */
export const SAME_PAIRS: readonly [Fraction, Fraction][] = [
  [frac(1, 2), frac(2, 4)],
  [frac(1, 3), frac(2, 6)],
  [frac(1, 2), frac(3, 6)],
  [frac(1, 4), frac(2, 8)],
  [frac(2, 3), frac(4, 6)],
  [frac(3, 4), frac(6, 8)],
  [frac(1, 2), frac(4, 8)],
];
export const NEAR_PAIRS: readonly [Fraction, Fraction][] = [
  [frac(1, 2), frac(2, 6)],
  [frac(2, 4), frac(1, 3)],
  [frac(1, 3), frac(3, 6)],
  [frac(1, 4), frac(3, 8)],
  [frac(2, 3), frac(3, 6)],
  [frac(3, 4), frac(4, 8)],
  [frac(1, 2), frac(3, 8)],
];

/** Two different unit fractions, smaller denominators earlier in the round. */
function unitPair(random: Random, hard: boolean): [Fraction, Fraction] {
  const ds = hard ? [3, 4, 5, 6, 8, 10] : [2, 3, 4, 6, 8];
  const a = pick(random, ds);
  const b = pick(
    random,
    ds.filter((x) => x !== a),
  );
  return [frac(1, a), frac(1, b)];
}

function samePair(random: Random, same: boolean): [Fraction, Fraction] {
  const pair = pick(random, same ? SAME_PAIRS : NEAR_PAIRS);
  return random() < 0.5 ? [pair[0], pair[1]] : [pair[1], pair[0]];
}

const foods: Food[] = ['pie', 'bar'];

export const picnicStages: readonly PicnicStage[] = [
  {
    stage: 1,
    group: 'picnicHalves',
    skill: 'halves',
    masteryStars: 2,
    example: '½ + ½ = 1',
    make: (r) => {
      const fair = shuffle(r, [true, false, r() < 0.5]);
      return [
        cutTask('pie', 2),
        fairTask(r, 'bar', 2, fair[0]),
        cutTask('bar', 2),
        fairTask(r, 'pie', 2, fair[1]),
        cutTask('ribbon', 2),
        fairTask(r, pick(r, foods), 2, fair[2]),
        cutTask('cake', 2),
      ];
    },
  },
  {
    stage: 2,
    group: 'picnicHalves',
    skill: 'quarters',
    masteryStars: 2,
    example: '¼ + ¼ + ¼ + ¼ = 1',
    make: (r) => [
      cutTask('pie', 4, true),
      cutTask('bar', 4, true),
      fairTask(r, pick(r, foods), 4, r() < 0.5),
      cutTask('pie', 4),
      cutTask('ribbon', 4),
      cutTask('bar', 4),
      cutTask('cake', 4),
    ],
  },
  {
    stage: 3,
    group: 'picnicHalves',
    skill: 'thirds-sixths',
    masteryStars: 2,
    example: '⅓ + ⅓ + ⅓ = 1',
    make: (r) => [
      cutTask('pie', 3),
      cutTask('bar', 3),
      fairTask(r, pick(r, foods), 3, r() < 0.5),
      cutTask('pie', 6),
      cutTask('ribbon', 3),
      cutTask('bar', 6),
      cutTask('cake', 6),
    ],
  },
  {
    stage: 4,
    group: 'picnicName',
    skill: 'unit-fractions',
    masteryStars: 2,
    example: '½ ⅓ ¼ ⅙ ⅛',
    make: (r) => {
      const shares = shuffle(r, UNITS);
      return [
        nameTask(r, 'pie', shares[0]),
        pickTask(r, 'bar', shares[1]),
        nameTask(r, 'bar', shares[2]),
        pickTask(r, 'pie', shares[3]),
        nameTask(r, pick(r, foods), shares[4]),
        pickTask(r, pick(r, foods), shares[0]),
        nameTask(r, 'cake', pick(r, [frac(1, 6), frac(1, 8)])),
      ];
    },
  },
  {
    stage: 5,
    group: 'picnicName',
    skill: 'non-unit-fractions',
    masteryStars: 2,
    example: '¾ ⅔ ⅝',
    make: (r) => {
      const shares = shuffle(r, NON_UNITS);
      return [
        nameTask(r, 'pie', shares[0]),
        pickTask(r, 'bar', shares[1]),
        nameTask(r, 'bar', shares[2]),
        pickTask(r, 'pie', shares[3]),
        nameTask(r, pick(r, foods), shares[4]),
        pickTask(r, pick(r, foods), shares[5]),
        nameTask(r, 'cake', pick(r, [frac(5, 6), frac(5, 8), frac(7, 8)])),
      ];
    },
  },
  {
    stage: 6,
    group: 'picnicName',
    skill: 'fractions-of-length',
    masteryStars: 2,
    example: '⅗',
    make: (r) => {
      const shares = shuffle(r, RIBBONS);
      return [
        cutTask('ribbon', pick(r, [3, 4, 6])),
        nameTask(r, 'ribbon', shares[0]),
        pickTask(r, 'ribbon', shares[1]),
        nameTask(r, 'ribbon', shares[2]),
        pickTask(r, 'ribbon', shares[3]),
        nameTask(r, 'ribbon', shares[4]),
        nameTask(r, 'cake', pick(r, [frac(3, 4), frac(2, 3), frac(5, 6)])),
      ];
    },
  },
  {
    stage: 7,
    group: 'picnicMore',
    skill: 'compare-unit-fractions',
    masteryStars: 2,
    example: '⅓ > ⅙',
    make: (r) => [
      ...Array.from({ length: SHARES }, (_, index) => {
        const [left, right] = unitPair(r, index >= 3);
        return compareTask(pick(r, foods), left, right, index >= 3, false);
      }),
      compareTask('cake', frac(1, 6), frac(1, 8), false, false),
    ],
  },
  {
    stage: 8,
    group: 'picnicMore',
    skill: 'equivalent-fractions',
    masteryStars: 2,
    example: '½ = 2⁄4',
    make: (r) => {
      const same = shuffle(r, [true, true, true, false, false, false]);
      return [
        ...same.map((isSame) => {
          const [left, right] = samePair(r, isSame);
          return compareTask(pick(r, foods), left, right, false, true);
        }),
        compareTask('cake', frac(3, 4), frac(6, 8), false, true),
      ];
    },
  },
  {
    stage: 9,
    group: 'picnicGroups',
    skill: 'fraction-of-set',
    masteryStars: 2,
    example: '⅓ {of} 12 = 4',
    make: (r) => {
      const shares = [frac(1, 2), frac(1, 3), frac(1, 4)];
      return [
        ...Array.from({ length: SHARES }, (_, index) => {
          const share = shares[index % 3];
          return dealTask(r, share, basket(r, share, 4, index < 3 ? 12 : 24), [1, 2]);
        }),
        dealTask(r, frac(1, 4), 24, [1, 2]),
      ];
    },
  },
  {
    stage: 10,
    group: 'picnicGroups',
    skill: 'fraction-of-set',
    masteryStars: 2,
    example: '⅕ {of} 40 = 8',
    make: (r) => {
      const shares = shuffle(r, [
        frac(1, 3),
        frac(1, 4),
        frac(1, 5),
        frac(1, 6),
        frac(1, 10),
        frac(1, 4),
      ]);
      return [
        ...shares.map((share) =>
          dealTask(r, share, basket(r, share, 20, Math.min(60, share.d * 12)), [1, 2, 5]),
        ),
        dealTask(r, frac(1, 5), 60, [1, 2, 5, 10]),
      ];
    },
  },
  {
    stage: 11,
    group: 'picnicGroups',
    skill: 'non-unit-fraction-of-set',
    masteryStars: 2,
    example: '¾ {of} 12 = 9',
    make: (r) => {
      const shares = shuffle(r, [
        frac(3, 4),
        frac(2, 3),
        frac(3, 4),
        frac(2, 5),
        frac(2, 3),
        frac(3, 5),
      ]);
      return [
        dealTask(r, frac(3, 4), 12, [1, 2]),
        ...shares.slice(1).map((share) => dealTask(r, share, basket(r, share, 8, 24), [1, 2, 5])),
        dealTask(r, frac(3, 4), 24, [1, 2, 5]),
      ];
    },
  },
  {
    stage: 12,
    group: 'picnicMaster',
    skill: 'fractions-mixed',
    masteryStars: 3,
    example: '⅔ · ½ = 2⁄4 · ¾ {of} 20',
    make: (r) => {
      const [left, right] = unitPair(r, true);
      const [sameLeft, sameRight] = samePair(r, r() < 0.5);
      const setShare = pick(r, [frac(2, 3), frac(3, 4), frac(3, 5)]);
      return [
        cutTask(pick(r, foods), pick(r, [3, 4, 6])),
        nameTask(r, pick(r, foods), pick(r, NON_UNITS)),
        compareTask(pick(r, foods), left, right, true, false),
        dealTask(r, pick(r, [frac(1, 5), frac(1, 6), frac(1, 4)]), 60, [1, 2, 5, 10]),
        pickTask(r, 'ribbon', pick(r, RIBBONS)),
        compareTask(pick(r, foods), sameLeft, sameRight, false, true),
        dealTask(r, setShare, basket(r, setShare, 12, 30), [1, 2, 5]),
      ];
    },
  },
];

export const TOTAL_STAGES = picnicStages.length;

export const picnicLevels: readonly Level[] = picnicStages.map((stage) => ({
  id: `picnic-${stage.stage}`,
  title: `picnic${stage.stage}` as MessageKey,
  description: `picnic${stage.stage}Help` as MessageKey,
  skills: ['fractions', stage.skill],
  format: 'picnic',
  group: stage.group,
}));

export function picnicStage(id: string | null | undefined): PicnicStage | undefined {
  const match = /^picnic-([1-9]\d*)$/.exec(id ?? '');
  return match ? picnicStages.find((stage) => stage.stage === Number(match[1])) : undefined;
}

export function picnicPosition(stage: PicnicStage): number {
  return picnicStages.indexOf(stage) + 1;
}

/** The hub card's example, with "of" in the child's language. */
export const picnicExample = (stage: PicnicStage, of: string) => stage.example.replace('{of}', of);

/** Six shares and the big cake for a level. */
export function createRound(stage: PicnicStage, random: Random = Math.random): Task[] {
  return stage.make(random);
}

/** The right answer of a comparison: which side gets more, or "same". */
export function bigger(task: Pick<CompareTask, 'left' | 'right'>): 'left' | 'right' | 'same' {
  const order = compareFractions(task.left, task.right);
  return order > 0 ? 'left' : order < 0 ? 'right' : 'same';
}

/** The fraction a task is about, for the scene and the spoken status. */
export function taskShare(task: Task): Fraction | null {
  switch (task.kind) {
    case 'cut':
      return frac(1, task.parts);
    case 'fair':
      return frac(1, task.sizes.length);
    case 'compare':
      return null;
    default:
      return task.share;
  }
}

/** How many friends sit at the blanket for a task. */
export function taskFriends(task: Task): number {
  switch (task.kind) {
    case 'cut':
      return task.parts;
    case 'fair':
      return task.sizes.length;
    case 'compare':
      return 2;
    case 'deal':
      return task.share.d;
    default:
      return Math.min(task.share.d, 8);
  }
}

// ---- Ants (the timer), points and stars -------------------------------------------------------

/** Seconds before the ant line reaches the blanket, for one share. */
export const PICNIC_PACES = [
  { id: 'off', label: 'paceOff', base: 0 },
  { id: 'relaxed', label: 'paceRelaxed', base: 50 },
  { id: 'normal', label: 'paceNormal', base: 32 },
  { id: 'fast', label: 'paceFast', base: 20 },
] as const;

export type PicnicPace = (typeof PICNIC_PACES)[number]['id'];

/** Cutting and dealing take longer than tapping an answer; the big cake gets a little more. */
export function antSeconds(pace: PicnicPace, task: Task, cake = false): number {
  const base = PICNIC_PACES.find((item) => item.id === pace)?.base ?? 0;
  if (!base) return 0;
  const work =
    task.kind === 'cut'
      ? 1.2
      : task.kind === 'deal'
        ? 1.1 + Math.min(0.6, task.total / task.share.d / 25)
        : task.kind === 'fair'
          ? 0.6
          : 0.8;
  return Math.round(base * work * (cake ? 1.25 : 1));
}

export function parsePicnicPace(value: unknown): PicnicPace {
  return PICNIC_PACES.find((pace) => pace.id === value)?.id ?? 'off';
}

export interface Share {
  readonly firstTry: boolean;
  /** Shared before the ants arrived. */
  readonly crumb: boolean;
  readonly golden: boolean;
  readonly cake: boolean;
}

export const POINTS = { share: 10, firstTry: 10, crumb: 15 } as const;

/** Points for a share: the big cake and the golden spoon double it; the crumb bonus is extra. */
export function sharePoints(share: Share): number {
  const base =
    (POINTS.share + (share.firstTry ? POINTS.firstTry : 0)) *
    (share.cake ? 2 : 1) *
    (share.golden ? 2 : 1);
  return base + (share.crumb ? POINTS.crumb : 0);
}

/** Three stars when every share but one was right first time, two for four of seven. */
export function roundStars(firstTries: number): 1 | 2 | 3 {
  return firstTries >= ROUND_LENGTH - 1 ? 3 : firstTries >= 4 ? 2 : 1;
}

export function isMastered(stage: PicnicStage, stars: number): boolean {
  return stars >= stage.masteryStars;
}
