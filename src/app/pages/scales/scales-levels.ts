import type { Level } from '../../core/catalog';
import type { MessageKey } from '../../core/messages';
import { Dial, fewestWeights, sum, Unit } from './scales-math';

export type Random = () => number;

/** Everything that can sit on a pan or go into the pot. */
export type ItemId =
  | 'pumpkin'
  | 'melon'
  | 'cabbage'
  | 'potatoes'
  | 'cheese'
  | 'flour'
  | 'carrots'
  | 'apples'
  | 'butter'
  | 'berries'
  | 'honey'
  | 'nuts'
  | 'pillow'
  | 'rock'
  | 'salt'
  | 'water'
  | 'milk'
  | 'juice';

export const LIQUIDS: readonly ItemId[] = ['water', 'milk', 'juice'];

/**
 * One thing on a pan: an ingredient, a brass weight, a mystery box whose weight the child
 * works out, or a labelled sack (three sacks of 4 kg for 3 × 4).
 */
export type Load =
  | { readonly kind: 'item'; readonly item: ItemId; readonly amount: number }
  | { readonly kind: 'weight'; readonly amount: number }
  | { readonly kind: 'mystery'; readonly amount: number }
  | { readonly kind: 'sack'; readonly amount: number };

export type Side = 'left' | 'right';

/** Heavier or lighter by the tilt, or a ✓/✗ sentence about two things on the pans. */
export interface CompareTask {
  readonly kind: 'compare';
  readonly unit: 'kg';
  readonly left: Load & { kind: 'item' };
  readonly right: Load & { kind: 'item' };
  readonly ask: 'heavier' | 'lighter' | 'claim';
  /** For a ✓/✗ sentence: "the left one is heavier than the right one". */
  readonly claim: Side;
  /** Weights are written on the things and Bramble holds the beam until the child answers. */
  readonly labelled: boolean;
}

/** The child taps weights onto one pan until both sides weigh the same. */
export interface BalanceTask {
  readonly kind: 'balance';
  readonly unit: Unit;
  readonly left: readonly Load[];
  readonly right: readonly Load[];
  /** The pan the child's weights go on. */
  readonly side: Side;
  /** The weights on offer, biggest first; there are always as many of each as needed. */
  readonly sizes: readonly number[];
  /** What the child must add to make it level. Never shown. */
  readonly need: number;
  /** What goes into the pot once it is level. */
  readonly item: ItemId;
  /** Both pans hold weights and the sum is written as an equation, 7 + □ = 4 + 5. */
  readonly equation: boolean;
}

/** A mystery box (or a few of the same) sits on a pan: the child types what one weighs. */
export interface MissingTask {
  readonly kind: 'missing';
  readonly unit: 'kg';
  readonly left: readonly Load[];
  readonly right: readonly Load[];
  readonly answer: number;
}

/** The item sits on a kitchen scale: the child reads the needle and types the amount. */
export interface DialTask {
  readonly kind: 'dial';
  readonly unit: 'kg' | 'g';
  readonly dial: Dial;
  readonly amount: number;
  readonly item: ItemId;
}

/** Pour from the jugs to fill the pot up to the line. Amounts are in millilitres. */
export interface PourTask {
  readonly kind: 'pour';
  readonly unit: 'l' | 'ml';
  readonly target: number;
  readonly jugs: readonly number[];
  /** How much the pot holds, for drawing its line and water. */
  readonly capacity: number;
  readonly item: ItemId;
}

export type Task = CompareTask | BalanceTask | MissingTask | DialTask | PourTask;
export type TaskKind = Task['kind'];

export interface ScalesStage {
  readonly stage: number;
  readonly group: MessageKey;
  /** The worked example on the level card and the hub card. */
  readonly example: string;
  readonly masteryStars: 2 | 3;
  /** Makes recipe line `index` (the last one is the feast dish). */
  readonly make: (random: Random, index: number) => Task;
}

/** Six recipe lines, then the feast dish. */
export const LINES = 6;
export const ROUND_LENGTH = LINES + 1;
/** Three first-try lines in a row make the pot glow gold: points double until a slip. */
export const HEARTY_STREAK = 3;
/** The most weights a pan holds, and the most pours into the pot. */
export const MAX_PIECES = 12;

const int = (random: Random, min: number, max: number) =>
  min + Math.floor(random() * (max - min + 1));
const pick = <T>(random: Random, items: readonly T[]): T => items[int(random, 0, items.length - 1)];
function shuffle<T>(random: Random, items: readonly T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index--) {
    const other = int(random, 0, index);
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}
const weight = (amount: number): Load => ({ kind: 'weight', amount });
const mystery = (amount: number): Load => ({ kind: 'mystery', amount });
const item = (id: ItemId, amount: number) => ({ kind: 'item' as const, item: id, amount });

// ---- Heavier or lighter ------------------------------------------------------------------------

/** Things to compare, with what they really weigh: big is not always heavy. */
const COMPARE_ITEMS: readonly { readonly item: ItemId; readonly kg: number }[] = [
  { item: 'pillow', kg: 1 },
  { item: 'honey', kg: 2 },
  { item: 'cabbage', kg: 3 },
  { item: 'melon', kg: 4 },
  { item: 'cheese', kg: 5 },
  { item: 'rock', kg: 7 },
  { item: 'pumpkin', kg: 9 },
];
/** Big but light against small but heavy, for the feast's tricky sentence. */
const SURPRISES: readonly [ItemId, ItemId][] = [
  ['pillow', 'rock'],
  ['pillow', 'honey'],
  ['cabbage', 'rock'],
];
const SACKS: readonly ItemId[] = ['flour', 'potatoes', 'apples', 'carrots'];

function compareTask(random: Random, index: number): CompareTask {
  const feast = index === LINES;
  const labelled = index === 4 || index === 5;
  const asks = ['heavier', 'heavier', 'lighter', 'claim', 'heavier', 'lighter', 'claim'] as const;
  const ask = asks[index] ?? 'heavier';
  let left: CompareTask['left'];
  let right: CompareTask['right'];
  if (labelled) {
    const [a, b] = shuffle(random, SACKS);
    const first = int(random, 2, 19);
    let second = int(random, 2, 19);
    while (second === first) second = int(random, 2, 19);
    left = item(a, first);
    right = item(b, second);
  } else if (feast) {
    const [light, heavy] = pick(random, SURPRISES);
    const kg = (id: ItemId) => COMPARE_ITEMS.find((entry) => entry.item === id)!.kg;
    [left, right] =
      random() < 0.5
        ? [item(light, kg(light)), item(heavy, kg(heavy))]
        : [item(heavy, kg(heavy)), item(light, kg(light))];
  } else {
    const [a, b] = shuffle(random, COMPARE_ITEMS);
    left = item(a.item, a.kg);
    right = item(b.item, b.kg);
  }
  return {
    kind: 'compare',
    unit: 'kg',
    left,
    right,
    ask,
    claim: random() < 0.5 ? 'left' : 'right',
    labelled,
  };
}

/** The side a compare task wants tapped, or whether its sentence is true. */
export function compareAnswer(task: CompareTask): Side | 'yes' | 'no' {
  const heavier: Side = task.left.amount > task.right.amount ? 'left' : 'right';
  const lighter: Side = heavier === 'left' ? 'right' : 'left';
  if (task.ask === 'heavier') return heavier;
  if (task.ask === 'lighter') return lighter;
  return task.claim === heavier ? 'yes' : 'no';
}

// ---- Balancing with weights ---------------------------------------------------------------------

const KG_ITEMS: readonly ItemId[] = ['pumpkin', 'melon', 'potatoes', 'cheese', 'flour', 'cabbage'];
const GRAM_ITEMS: readonly ItemId[] = ['butter', 'berries', 'honey', 'nuts', 'flour', 'apples'];

function itemBalance(
  unit: Unit,
  sizes: readonly number[],
  need: number,
  id: ItemId,
  side: Side = 'right',
): BalanceTask {
  const pan = [item(id, need)];
  return {
    kind: 'balance',
    unit,
    left: side === 'right' ? pan : [],
    right: side === 'right' ? [] : pan,
    side,
    sizes,
    need,
    item: id,
    equation: false,
  };
}

const BLOCKS = [5, 1] as const;
const KILOS = [10, 5, 2, 1] as const;
const GRAMS = [500, 200, 100] as const;
const EQUATION_SIZES = [5, 2, 1] as const;

function blockTask(random: Random, index: number): BalanceTask {
  const need = index === LINES ? int(random, 16, 20) : int(random, 4 + index, 9 + index * 2);
  return itemBalance('block', BLOCKS, need, pick(random, KG_ITEMS));
}

function kiloTask(random: Random, index: number): BalanceTask {
  const need = index === LINES ? int(random, 21, 30) : int(random, 3 + index, 9 + index * 2);
  return itemBalance('kg', KILOS, need, pick(random, KG_ITEMS), random() < 0.3 ? 'left' : 'right');
}

function gramTask(random: Random, index: number): BalanceTask {
  const need =
    index === LINES
      ? pick(random, [1100, 1200, 1300, 1400, 1500])
      : index === 3
        ? 1000
        : int(random, 2, 9) * 100;
  return itemBalance('g', GRAMS, need, pick(random, GRAM_ITEMS));
}

/** 7 + □ = 4 + 5: weights on both pans, the child fills the gap on one side. */
function equationTask(random: Random, index: number): BalanceTask {
  const top = index === LINES ? 20 : 12 + index;
  for (;;) {
    const b = int(random, 2, 9);
    const c = int(random, 2, Math.min(9, top - b));
    const whole = b + c;
    const a = int(random, 1, whole - 1);
    const need = whole - a;
    if (need > 9) continue;
    // Either 7 + □ = 4 + 5, or 4 + 5 = 7 + □ with the gap on the right pan.
    const side: Side = random() < 0.65 ? 'left' : 'right';
    const fixed = [weight(a)];
    const other = [weight(b), weight(c)];
    return {
      kind: 'balance',
      unit: 'kg',
      left: side === 'left' ? fixed : other,
      right: side === 'left' ? other : fixed,
      side,
      sizes: EQUATION_SIZES,
      need,
      item: 'salt',
      equation: true,
    };
  }
}

// ---- Mystery boxes -------------------------------------------------------------------------------

function missingTask(random: Random, index: number): MissingTask {
  const form = index === LINES ? 2 : index % 4;
  for (;;) {
    let left: Load[];
    let right: Load[];
    let answer: number;
    if (form === 0) {
      // □ + 6 = 15
      const whole = int(random, 8, 20);
      const a = int(random, 2, whole - 2);
      answer = whole - a;
      left = [mystery(answer), weight(a)];
      right = [weight(whole)];
    } else if (form === 1) {
      // 6 + □ = 4 + 9
      const b = int(random, 3, 10);
      const c = int(random, 2, 10);
      const a = int(random, 1, b + c - 1);
      answer = b + c - a;
      left = [weight(a), mystery(answer)];
      right = [weight(b), weight(c)];
    } else if (form === 2) {
      // 3 + 5 + □ = 12 + 2
      const c = int(random, 8, 14);
      const d = int(random, 1, 20 - c);
      const a = int(random, 1, 6);
      const b = int(random, 1, 6);
      answer = c + d - a - b;
      left = [weight(a), weight(b), mystery(answer)];
      right = [weight(c), weight(d)];
    } else {
      // Two boxes that weigh the same: □ + □ = 14
      answer = int(random, 3, 10);
      left = [mystery(answer), mystery(answer)];
      right = [weight(answer * 2)];
    }
    if (answer < 1 || answer > 15 || sum([...left, ...right].map((l) => l.amount)) > 40) continue;
    return random() < 0.4
      ? { kind: 'missing', unit: 'kg', left: right, right: left, answer }
      : { kind: 'missing', unit: 'kg', left, right, answer };
  }
}

/** 3 × 4 = □ + 2: three sacks of 4 kg against a box and a weight. */
function timesTask(random: Random, index: number): MissingTask {
  const n = int(random, 2, index === LINES ? 5 : 4);
  const m = int(random, 2, index === LINES ? 6 : 5);
  const sacks: Load[] = Array.from({ length: n }, () => ({ kind: 'sack', amount: m }) as const);
  if (index === LINES) {
    // The feast turns it round: 3 × □ = 12, three boxes against one weight.
    return {
      kind: 'missing',
      unit: 'kg',
      left: Array.from({ length: n }, () => mystery(m)),
      right: [weight(n * m)],
      answer: m,
    };
  }
  const c = int(random, 1, Math.min(9, n * m - 1));
  return {
    kind: 'missing',
    unit: 'kg',
    left: sacks,
    right: [mystery(n * m - c), weight(c)],
    answer: n * m - c,
  };
}

// ---- Reading a dial ------------------------------------------------------------------------------

const KG_DIALS: readonly Dial[] = [
  { max: 10, step: 1, label: 5 },
  { max: 10, step: 1, label: 2 },
  { max: 20, step: 1, label: 5 },
  { max: 20, step: 2, label: 10 },
];
const GRAM_DIALS: readonly Dial[] = [
  { max: 1000, step: 100, label: 500 },
  { max: 500, step: 50, label: 100 },
  { max: 1000, step: 50, label: 250 },
  { max: 1000, step: 100, label: 200 },
];

/** A needle on a mark, and never on a written number, so the child counts marks. */
function dialValue(random: Random, dial: Dial): number {
  const marks = dial.max / dial.step;
  for (;;) {
    const value = int(random, 1, marks - 1) * dial.step;
    if (value % dial.label !== 0) return value;
  }
}

function kiloDial(random: Random, index: number): DialTask {
  const dial = index === LINES ? KG_DIALS[3] : KG_DIALS[Math.min(3, Math.floor(index / 2))];
  return {
    kind: 'dial',
    unit: 'kg',
    dial,
    amount: dialValue(random, dial),
    item: pick(random, KG_ITEMS),
  };
}

function gramDial(random: Random, index: number): DialTask {
  const dial =
    index === LINES
      ? { max: 2000, step: 100, label: 500 }
      : GRAM_DIALS[Math.min(3, Math.floor(index / 2) + (index % 2))];
  return {
    kind: 'dial',
    unit: 'g',
    dial,
    amount: dialValue(random, dial),
    item: pick(random, GRAM_ITEMS),
  };
}

// ---- Pouring -------------------------------------------------------------------------------------

const potFor = (target: number) => Math.max(2000, Math.ceil((target + 600) / 1000) * 1000);

function litreTask(random: Random, index: number): PourTask {
  const target = index === LINES ? pick(random, [3500, 4500]) : int(random, 1, 7) * 500;
  return {
    kind: 'pour',
    unit: 'l',
    target,
    jugs: [1000, 500],
    capacity: potFor(target),
    item: pick(random, LIQUIDS),
  };
}

function millilitreTask(random: Random, index: number): PourTask {
  const target = index === LINES ? int(random, 9, 12) * 250 : int(random, 1, 8) * 250;
  return {
    kind: 'pour',
    unit: 'ml',
    target,
    jugs: [1000, 500, 250],
    capacity: potFor(target),
    item: pick(random, LIQUIDS),
  };
}

// ---- The twelve levels ---------------------------------------------------------------------------

const MIXED = [
  kiloTask,
  kiloDial,
  gramTask,
  gramDial,
  equationTask,
  missingTask,
  timesTask,
  litreTask,
  millilitreTask,
];

export const scalesStages: readonly ScalesStage[] = [
  {
    stage: 1,
    group: 'scalesLight',
    example: '9 kg > 4 kg',
    masteryStars: 2,
    make: compareTask,
  },
  {
    stage: 2,
    group: 'scalesLight',
    example: '8 = 5 + 1 + 1 + 1',
    masteryStars: 2,
    make: blockTask,
  },
  { stage: 3, group: 'scalesKilo', example: '7 kg = 5 kg + 2 kg', masteryStars: 2, make: kiloTask },
  { stage: 4, group: 'scalesKilo', example: '0 · 5 · 10 kg', masteryStars: 2, make: kiloDial },
  { stage: 5, group: 'scalesGram', example: '1 kg = 1000 g', masteryStars: 2, make: gramTask },
  { stage: 6, group: 'scalesGram', example: '0 · 500 · 1000 g', masteryStars: 2, make: gramDial },
  {
    stage: 7,
    group: 'scalesBoth',
    example: '7 + □ = 4 + 5',
    masteryStars: 2,
    make: equationTask,
  },
  { stage: 8, group: 'scalesBoth', example: '□ + □ = 14', masteryStars: 2, make: missingTask },
  { stage: 9, group: 'scalesBoth', example: '3 × 4 = □ + 2', masteryStars: 2, make: timesTask },
  { stage: 10, group: 'scalesPour', example: '1 l + ½ l', masteryStars: 2, make: litreTask },
  {
    stage: 11,
    group: 'scalesPour',
    example: '1 l = 1000 ml',
    masteryStars: 2,
    make: millilitreTask,
  },
  {
    stage: 12,
    group: 'scalesFeast',
    example: 'kg · g · l · ml',
    masteryStars: 3,
    make: (random, index) =>
      index === LINES ? kiloTask(random, LINES) : pick(random, MIXED)(random, index),
  },
];

export const TOTAL_STAGES = scalesStages.length;

export const scalesLevels: readonly Level[] = scalesStages.map((stage) => ({
  id: `scales-${stage.stage}`,
  title: `scales${stage.stage}` as MessageKey,
  description: `scales${stage.stage}Help` as MessageKey,
  skills: ['measurement', stage.stage >= 7 && stage.stage <= 9 ? 'equality' : 'weight'],
  format: 'scales',
  group: stage.group,
}));

export function scalesStage(id: string | null | undefined): ScalesStage | undefined {
  const match = /^scales-([1-9]\d*)$/.exec(id ?? '');
  return match ? scalesStages.find((stage) => stage.stage === Number(match[1])) : undefined;
}

export function scalesPosition(stage: ScalesStage): number {
  return scalesStages.indexOf(stage) + 1;
}

/** Tells two tasks apart, so a round never asks the same line twice. */
export function taskKey(task: Task): string {
  switch (task.kind) {
    case 'compare':
      return `c:${task.left.item}${task.left.amount}:${task.right.item}${task.right.amount}:${task.ask}`;
    case 'balance':
    case 'missing':
      return `${task.kind[0]}:${task.left.map((l) => l.amount).join('+')}=${task.right.map((l) => l.amount).join('+')}`;
    case 'dial':
      return `d:${task.dial.max}/${task.dial.step}:${task.amount}`;
    case 'pour':
      return `p:${task.target}`;
  }
}

/** Six recipe lines and the feast dish, none asked twice. */
export function createRound(stage: ScalesStage, random: Random = Math.random): Task[] {
  const tasks: Task[] = [];
  const keys = new Set<string>();
  for (let index = 0; index < ROUND_LENGTH; index++) {
    let task = stage.make(random, index);
    for (let tries = 0; tries < 30 && keys.has(taskKey(task)); tries++)
      task = stage.make(random, index);
    keys.add(taskKey(task));
    tasks.push(task);
  }
  return tasks;
}

/** The fewest pieces that make it level, for the fewest-weights bonus; 0 for typed answers. */
export function fewestFor(task: Task): number {
  if (task.kind === 'balance') return fewestWeights(task.need, task.sizes)?.length ?? 0;
  if (task.kind === 'pour') return fewestWeights(task.target, task.jugs)?.length ?? 0;
  return 0;
}

/** True when a task can be finished with what the scale offers. */
export function solvable(task: Task): boolean {
  switch (task.kind) {
    case 'compare':
      return task.left.amount !== task.right.amount;
    case 'balance': {
      const pieces = fewestWeights(task.need, task.sizes);
      const left = sum(task.left.map((l) => l.amount));
      const right = sum(task.right.map((l) => l.amount));
      const gap = task.side === 'left' ? right - left : left - right;
      return !!pieces && pieces.length <= MAX_PIECES && gap === task.need && task.need > 0;
    }
    case 'missing': {
      const side = (loads: readonly Load[]) =>
        sum(loads.map((l) => (l.kind === 'mystery' ? task.answer : l.amount)));
      const boxes = [...task.left, ...task.right].filter((l) => l.kind === 'mystery');
      return (
        boxes.length > 0 &&
        boxes.every((box) => box.amount === task.answer) &&
        side(task.left) === side(task.right) &&
        task.answer > 0
      );
    }
    case 'dial':
      return (
        task.amount > 0 &&
        task.amount < task.dial.max &&
        task.amount % task.dial.step === 0 &&
        task.dial.max % task.dial.step === 0
      );
    case 'pour': {
      const pours = fewestWeights(task.target, task.jugs);
      return !!pours && pours.length <= MAX_PIECES && task.target < task.capacity;
    }
  }
}

// ---- Timer, points and stars ---------------------------------------------------------------------

/** Seconds before the soup bubbles over, per line. */
export const SCALES_PACES = [
  { id: 'off', label: 'paceOff', base: 0 },
  { id: 'relaxed', label: 'paceRelaxed', base: 60 },
  { id: 'normal', label: 'paceNormal', base: 40 },
  { id: 'fast', label: 'paceFast', base: 25 },
] as const;

export type ScalesPace = (typeof SCALES_PACES)[number]['id'];

const PACE_SHARE: Record<TaskKind, number> = {
  compare: 0.5,
  dial: 0.8,
  missing: 1,
  balance: 1,
  pour: 1,
};

export function soupSeconds(pace: ScalesPace, kind: TaskKind): number {
  const base = SCALES_PACES.find((item) => item.id === pace)?.base ?? 0;
  return base ? Math.round(base * PACE_SHARE[kind]) : 0;
}

export function parseScalesPace(value: unknown): ScalesPace {
  return SCALES_PACES.find((pace) => pace.id === value)?.id ?? 'off';
}

export interface Cook {
  readonly firstTry: boolean;
  /** Balanced or poured with as few pieces as possible. */
  readonly fewest: boolean;
  /** Done before the soup bubbled over, with the timer on. */
  readonly inTime: boolean;
  readonly hearty: boolean;
  readonly feast: boolean;
}

export const POINTS = { line: 10, firstTry: 10, fewest: 10, inTime: 15 } as const;

/** Points for a line: the hearty pot and the feast double the line, not the timer bonus. */
export function cookPoints(cook: Cook): number {
  const line =
    (POINTS.line + (cook.firstTry ? POINTS.firstTry : 0) + (cook.fewest ? POINTS.fewest : 0)) *
    (cook.feast ? 2 : 1) *
    (cook.hearty ? 2 : 1);
  return line + (cook.inTime ? POINTS.inTime : 0);
}

/** Three stars when all but one line went right first time, two for four of seven. */
export function roundStars(firstTries: number): 1 | 2 | 3 {
  return firstTries >= ROUND_LENGTH - 1 ? 3 : firstTries >= 4 ? 2 : 1;
}

export function isMastered(stage: ScalesStage, stars: number): boolean {
  return stars >= stage.masteryStars;
}
