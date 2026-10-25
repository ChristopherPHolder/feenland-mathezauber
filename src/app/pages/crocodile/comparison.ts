import type { Level } from '../../core/catalog';
import type { MessageKey } from '../../core/messages';
export type Comparison = '<' | '=' | '>';
export type ComparisonSkill =
  'numbers20' | 'numbers100' | 'sums' | 'differences' | 'twoSides' | 'mixed';
export interface ComparisonStage {
  readonly stage: number;
  readonly skill: ComparisonSkill;
  readonly max: 20 | 100;
  readonly example: string;
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
export const ROUND_LENGTH = 10;
export const comparisonStages: readonly ComparisonStage[] = [
  { stage: 1, skill: 'numbers20', max: 20, example: '5 ○ 12' },
  { stage: 2, skill: 'numbers100', max: 100, example: '47 ○ 74' },
  { stage: 3, skill: 'sums', max: 20, example: '7 + 6 ○ 14' },
  { stage: 4, skill: 'differences', max: 20, example: '19 − 8 ○ 10' },
  { stage: 5, skill: 'twoSides', max: 20, example: '5 + 7 ○ 6 + 6' },
  { stage: 6, skill: 'mixed', max: 100, example: '40 + 8 ○ 50' },
];
export const TOTAL_STAGES = comparisonStages.length;
/** Every level stays open so a child can pick any crocodile; stars still reward mastery. */
export const comparisonLevels: readonly Level[] = comparisonStages.map((config) => ({
  id: `crocodile-${config.stage}`,
  title: `crocodile${config.stage}` as MessageKey,
  description: `crocodile${config.stage}Help` as MessageKey,
  prerequisites: [],
  skills: ['compare-numbers', config.skill],
  format: 'crocodile',
}));
export function comparisonStage(id: string | null | undefined): ComparisonStage | undefined {
  const match = /^crocodile-(\d)$/.exec(id ?? '');
  return match ? comparisonStages.find((stage) => stage.stage === Number(match[1])) : undefined;
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
function side(random: Random, skill: ComparisonSkill, position: 'left' | 'right', value: number) {
  switch (skill) {
    case 'sums':
      return position === 'left' && value >= 2 ? sum(random, value) : number(value);
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
  if (config.max === 100) {
    const swapped = (value % 10) * 10 + Math.floor(value / 10);
    if (swapped >= low && swapped <= high && swapped !== value) choices.push(swapped, swapped);
    const sameTens = Math.floor(value / 10) * 10 + int(random, 0, 9);
    if (sameTens >= low && sameTens <= high) choices.push(sameTens);
  }
  return pick(random, choices);
}
function question(
  random: Random,
  config: ComparisonStage,
  answer: Comparison,
): ComparisonQuestion | undefined {
  const [low, high] = {
    sums: [2, 20],
    differences: [0, 19],
    twoSides: [1, 19],
    numbers20: [0, 20],
    numbers100: [0, 100],
    mixed: [0, 100],
  }[config.skill];
  const leftValue = int(random, low, high);
  const rightValue =
    answer === '=' ? leftValue : partner(random, config, leftValue, answer === '<');
  if (rightValue < 0) return undefined;
  const left = side(random, config.skill, 'left', leftValue);
  const right = side(random, config.skill, 'right', rightValue);
  if (config.skill === 'mixed' && !left.text.includes(' ') && !right.text.includes(' '))
    return undefined;
  return { left, right, answer: compare(left.value, right.value) };
}
export function createComparisonRound(
  config: ComparisonStage,
  random: Random = Math.random,
): readonly ComparisonQuestion[] {
  const equals = config.max === 100 || config.skill === 'numbers20' ? 2 : 3;
  const plan: Comparison[] = [
    ...Array<Comparison>(equals).fill('='),
    ...Array<Comparison>(4).fill('<'),
    ...Array<Comparison>(ROUND_LENGTH - equals - 4).fill('>'),
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
