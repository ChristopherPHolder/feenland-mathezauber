import type { Level } from '../../core/catalog';
import type { MessageKey } from '../../core/messages';
export type Comparison = '<' | '=' | '>';
export type ComparisonSkill =
  | 'numbers10'
  | 'numbers20'
  | 'numbers100'
  | 'numbers1000'
  | 'sums10'
  | 'sums'
  | 'differences10'
  | 'differences'
  | 'twoSides'
  | 'mixed'
  | 'twoSides100'
  | 'easyTimes'
  | 'times'
  | 'times100';
export type ComparisonGroup = 'crocNumbers' | 'crocWorkOut' | 'crocHundred' | 'crocTimes';
export interface ComparisonStage {
  /** The number in the level id `crocodile-<n>`; saved progress uses it, so never change it. */
  readonly stage: number;
  /** Position in the pond's list of levels, easiest first. */
  readonly position: number;
  readonly group: ComparisonGroup;
  readonly skill: ComparisonSkill;
  readonly max: 10 | 20 | 30 | 100 | 1000;
  readonly example: string;
  /** Snacks in a round: quick looks get more of them, so every round lasts two to four minutes. */
  readonly snacks: number;
}
export interface Side {
  readonly text: string;
  readonly value: number;
}
export interface ComparisonQuestion {
  readonly left: Side;
  readonly right: Side;
  readonly answer: Comparison;
}
/** The usual round; plain-number levels run longer and are listed with their own length. */
export const ROUND_LENGTH = 10;
/** Easiest first. Stages 1 to 7 are the original levels; later ones filled the gaps around them. */
export const comparisonStages: readonly ComparisonStage[] = (
  [
    { stage: 8, group: 'crocNumbers', skill: 'numbers10', max: 10, example: '3 ○ 7', snacks: 15 },
    { stage: 1, group: 'crocNumbers', skill: 'numbers20', max: 20, example: '5 ○ 12', snacks: 15 },
    {
      stage: 2,
      group: 'crocNumbers',
      skill: 'numbers100',
      max: 100,
      example: '47 ○ 74',
      snacks: 15,
    },
    {
      stage: 9,
      group: 'crocNumbers',
      skill: 'numbers1000',
      max: 1000,
      example: '408 ○ 480',
      snacks: 12,
    },
    { stage: 10, group: 'crocWorkOut', skill: 'sums10', max: 10, example: '3 + 4 ○ 8', snacks: 12 },
    { stage: 3, group: 'crocWorkOut', skill: 'sums', max: 20, example: '7 + 6 ○ 14', snacks: 12 },
    {
      stage: 11,
      group: 'crocWorkOut',
      skill: 'differences10',
      max: 10,
      example: '9 − 3 ○ 5',
      snacks: 12,
    },
    {
      stage: 4,
      group: 'crocWorkOut',
      skill: 'differences',
      max: 20,
      example: '19 − 8 ○ 10',
      snacks: 12,
    },
    {
      stage: 5,
      group: 'crocWorkOut',
      skill: 'twoSides',
      max: 20,
      example: '5 + 7 ○ 6 + 6',
      snacks: 10,
    },
    {
      stage: 6,
      group: 'crocHundred',
      skill: 'mixed',
      max: 100,
      example: '40 + 8 ○ 50',
      snacks: 12,
    },
    {
      stage: 12,
      group: 'crocHundred',
      skill: 'twoSides100',
      max: 100,
      example: '30 + 15 ○ 50 − 4',
      snacks: 10,
    },
    {
      stage: 13,
      group: 'crocTimes',
      skill: 'easyTimes',
      max: 100,
      example: '5 × 3 ○ 12',
      snacks: 12,
    },
    { stage: 7, group: 'crocTimes', skill: 'times', max: 30, example: '4 × 5 ○ 3 × 7', snacks: 10 },
    {
      stage: 14,
      group: 'crocTimes',
      skill: 'times100',
      max: 100,
      example: '6 × 7 ○ 8 × 5',
      snacks: 10,
    },
  ] as const
).map((stage, index) => ({ ...stage, position: index + 1 }));
export const TOTAL_STAGES = comparisonStages.length;
/** Every level stays open so a child can pick any crocodile; stars still reward mastery. */
export const comparisonLevels: readonly Level[] = comparisonStages.map((config) => ({
  id: `crocodile-${config.stage}`,
  title: `crocodile${config.stage}` as MessageKey,
  description: `crocodile${config.stage}Help` as MessageKey,
  skills: ['compare-numbers', config.skill],
  format: 'crocodile',
  group: config.group,
}));
export function comparisonStage(id: string | null | undefined): ComparisonStage | undefined {
  const match = /^crocodile-(\d{1,2})$/.exec(id ?? '');
  return match ? comparisonStages.find((stage) => stage.stage === Number(match[1])) : undefined;
}
/** The level after this one in the pond's order, if there is one. */
export function nextComparisonStage(stage: ComparisonStage): ComparisonStage | undefined {
  return comparisonStages[stage.position];
}
export function compare(left: number, right: number): Comparison {
  return left < right ? '<' : left > right ? '>' : '=';
}
/** Three stars for a flawless round; two keep the path open; one always rewards finishing. */
export function roundStars(mistakes: number): 1 | 2 | 3 {
  return mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1;
}
export function isMastered(mistakes: number): boolean {
  return roundStars(mistakes) >= 2;
}
type Random = () => number;
const int = (random: Random, min: number, max: number) =>
  min + Math.floor(random() * (max - min + 1));
const pick = <T>(random: Random, items: readonly T[]): T => items[int(random, 0, items.length - 1)];
function number(value: number): Side {
  return { text: String(value), value };
}
function sum(random: Random, value: number): Side {
  const a = int(random, 1, value - 1);
  return { text: `${a} + ${value - a}`, value };
}
function difference(random: Random, value: number, max: number): Side {
  if (value >= max) return number(value);
  const b = int(random, 1, max - value);
  return { text: `${value + b} − ${b}`, value };
}
/** Sums and differences with a whole-tens partner keep stage six mental, not written, maths. */
function tensSum(random: Random, value: number): Side {
  const tens = int(random, 1, Math.floor(value / 10)) * 10;
  return random() < 0.5
    ? { text: `${tens} + ${value - tens}`, value }
    : { text: `${value - tens} + ${tens}`, value };
}
function tensDifference(random: Random, value: number): Side {
  const tens = int(random, 1, Math.floor((100 - value) / 10)) * 10;
  return { text: `${value + tens} − ${tens}`, value };
}
/** Times-table facts from the 2 to 10 rows; values with none (primes, 1) stay plain numbers. */
function product(
  random: Random,
  value: number,
  rows: readonly number[] = [2, 3, 4, 5, 6, 7, 8, 9, 10],
): Side {
  const factors: number[] = [];
  for (const a of rows) if (value % a === 0 && value / a >= 2 && value / a <= 10) factors.push(a);
  if (!factors.length) return number(value);
  const a = pick(random, factors);
  return { text: `${a} × ${value / a}`, value };
}
function side(random: Random, skill: ComparisonSkill, position: 'left' | 'right', value: number) {
  switch (skill) {
    case 'sums10':
    case 'sums':
      return position === 'left' && value >= 2 ? sum(random, value) : number(value);
    case 'differences10':
      return position === 'left' && value <= 9 ? difference(random, value, 10) : number(value);
    case 'differences':
      return position === 'left' && value <= 19 ? difference(random, value, 20) : number(value);
    case 'twoSides': {
      const kinds = [
        ...(value >= 2 ? ['sum'] : []),
        ...(value <= 19 ? ['difference'] : []),
      ] as const;
      return pick(random, kinds) === 'sum' ? sum(random, value) : difference(random, value, 20);
    }
    case 'mixed': {
      const kinds = [
        'number',
        ...(value >= 10 ? ['tensSum'] : []),
        ...(value <= 90 ? ['tensDifference'] : []),
      ] as const;
      const kind = pick(random, kinds);
      return kind === 'tensSum'
        ? tensSum(random, value)
        : kind === 'tensDifference'
          ? tensDifference(random, value)
          : number(value);
    }
    case 'twoSides100': {
      // Both sides are sums or differences with a whole-tens partner, so both need working out.
      const kinds = [
        ...(value >= 10 ? ['tensSum'] : []),
        ...(value <= 90 ? ['tensDifference'] : []),
      ] as const;
      if (!kinds.length) return number(value);
      return pick(random, kinds) === 'tensSum'
        ? tensSum(random, value)
        : tensDifference(random, value);
    }
    case 'easyTimes':
      return position === 'left' ? product(random, value, [2, 5, 10]) : number(value);
    case 'times':
    case 'times100':
      return position === 'left' || random() < 0.6 ? product(random, value) : number(value);
    default:
      return number(value);
  }
}
/** A partner for `value` that is close enough to need real looking, never a giveaway. */
function partner(random: Random, config: ComparisonStage, value: number, bigger: boolean): number {
  const low = bigger ? value + 1 : 0;
  const high = bigger ? config.max : value - 1;
  if (low > high) return -1;
  const choices: number[] = [];
  const close = bigger
    ? Math.min(high, value + int(random, 1, 3))
    : Math.max(low, value - int(random, 1, 3));
  choices.push(close, close, int(random, low, high));
  if (config.max >= 100) {
    // The digit swap a child falls for: 47 and 74, or 408 and 480.
    const hundreds = Math.floor(value / 100) * 100;
    const rest = value % 100;
    const swapped = hundreds + (rest % 10) * 10 + Math.floor(rest / 10);
    if (swapped >= low && swapped <= high && swapped !== value) choices.push(swapped, swapped);
    const sameTens = Math.floor(value / 10) * 10 + int(random, 0, 9);
    if (sameTens >= low && sameTens <= high) choices.push(sameTens);
  }
  if (config.max === 1000) {
    const sameHundreds = Math.floor(value / 100) * 100 + int(random, 0, 99);
    if (sameHundreds >= low && sameHundreds <= high) choices.push(sameHundreds, sameHundreds);
  }
  return pick(random, choices);
}
function question(
  random: Random,
  config: ComparisonStage,
  answer: Comparison,
): ComparisonQuestion | undefined {
  const [low, high] = {
    numbers10: [0, 10],
    numbers20: [0, 20],
    numbers100: [0, 100],
    numbers1000: [100, 999],
    sums10: [2, 10],
    sums: [2, 20],
    differences10: [0, 9],
    differences: [0, 19],
    twoSides: [1, 19],
    mixed: [0, 100],
    twoSides100: [10, 90],
    easyTimes: [4, 100],
    times: [4, 30],
    times100: [4, 100],
  }[config.skill];
  const leftValue = int(random, low, high);
  const rightValue =
    answer === '=' ? leftValue : partner(random, config, leftValue, answer === '<');
  if (rightValue < 0) return undefined;
  const left = side(random, config.skill, 'left', leftValue);
  const right = side(random, config.skill, 'right', rightValue);
  if (config.skill === 'mixed' && !left.text.includes(' ') && !right.text.includes(' '))
    return undefined;
  const timesSkill =
    config.skill === 'times' || config.skill === 'times100' || config.skill === 'easyTimes';
  if (timesSkill && (!left.text.includes('×') || left.text === right.text)) return undefined;
  if (config.skill === 'twoSides100' && (!left.text.includes(' ') || !right.text.includes(' ')))
    return undefined;
  return { left, right, answer: compare(left.value, right.value) };
}
export function createComparisonRound(
  config: ComparisonStage,
  random: Random = Math.random,
): readonly ComparisonQuestion[] {
  const length = config.snacks;
  const plainNumbers = config.skill.startsWith('numbers');
  const equals = plainNumbers || config.max >= 100 ? 2 : 3;
  const less = Math.floor((length - equals) / 2);
  const plan: Comparison[] = [
    ...Array<Comparison>(equals).fill('='),
    ...Array<Comparison>(less).fill('<'),
    ...Array<Comparison>(length - equals - less).fill('>'),
  ];
  for (let i = plan.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [plan[i], plan[j]] = [plan[j]!, plan[i]!];
  }
  const round: ComparisonQuestion[] = [];
  const seen = new Set<string>();
  for (const answer of plan) {
    let next: ComparisonQuestion | undefined;
    for (let attempt = 0; attempt < 60 && !next; attempt++) {
      const candidate = question(random, config, answer);
      const key = candidate && `${candidate.left.text}|${candidate.right.text}`;
      if (candidate && candidate.answer === answer && key && !seen.has(key)) {
        seen.add(key);
        next = candidate;
      }
    }
    round.push(
      next ?? {
        left: number(answer === '<' ? 1 : 2),
        right: number(answer === '>' ? 1 : 2),
        answer,
      },
    );
  }
  return round;
}
