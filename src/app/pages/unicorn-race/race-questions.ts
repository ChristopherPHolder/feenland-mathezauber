import type { Level } from '../../core/catalog';
import type { MessageKey } from '../../core/messages';
export type RaceSkill =
  | 'plus10'
  | 'minus10'
  | 'plusMinus20'
  | 'doubles'
  | 'plusMinus100'
  | 'twoDigit'
  | 'easyTimes'
  | 'times34'
  | 'missingFactor'
  | 'missingAddend'
  | 'hardTimes'
  | 'mixed';
/** How a race is run: against three friends, chasing one thief, or beating your own shadow. */
export type RaceMode = 'race' | 'chase' | 'shadow';
/** Five cups of three races each; every cup has its own scenery. */
export type RaceCup = 'meadow' | 'sky' | 'star' | 'castle' | 'rainbow';
export const raceCups: readonly RaceCup[] = ['meadow', 'sky', 'star', 'castle', 'rainbow'];
export interface RaceStage {
  readonly stage: RaceLevel;
  readonly cup: RaceCup;
  readonly mode: RaceMode;
  readonly skill: RaceSkill;
  readonly example: string;
  /** Track units; a longer track makes a longer race. */
  readonly length: number;
  /** Shadow races: the time the shadow runs until the child sets a faster best. */
  readonly parMs?: number;
  /** A cup final: only a win masters it. */
  readonly final?: boolean;
}
export type RaceLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;
export const raceLevels: readonly RaceLevel[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
export interface RaceQuestion {
  readonly text: string;
  readonly answer: number;
  /** Four choices in display order; exactly one equals `answer`. */
  readonly choices: readonly number[];
}
export const CHOICES = 4;
export const raceStages: readonly RaceStage[] = [
  { stage: 1, cup: 'meadow', mode: 'race', skill: 'plus10', example: '3 + 4', length: 200 },
  { stage: 2, cup: 'meadow', mode: 'chase', skill: 'minus10', example: '9 − 4', length: 200 },
  { stage: 3, cup: 'meadow', mode: 'race', skill: 'plusMinus20', example: '15 − 7', length: 210 },
  { stage: 4, cup: 'sky', mode: 'race', skill: 'doubles', example: '7 + 7', length: 220 },
  {
    stage: 5,
    cup: 'sky',
    mode: 'shadow',
    skill: 'plusMinus100',
    example: '48 + 30',
    length: 220,
    parMs: 80000,
  },
  { stage: 6, cup: 'sky', mode: 'chase', skill: 'twoDigit', example: '34 + 25', length: 220 },
  { stage: 7, cup: 'star', mode: 'race', skill: 'easyTimes', example: '5 × 4', length: 230 },
  {
    stage: 8,
    cup: 'star',
    mode: 'shadow',
    skill: 'times34',
    example: '4 × 6',
    length: 230,
    parMs: 90000,
  },
  {
    stage: 9,
    cup: 'star',
    mode: 'chase',
    skill: 'missingFactor',
    example: '5 × ? = 20',
    length: 230,
  },
  {
    stage: 10,
    cup: 'castle',
    mode: 'race',
    skill: 'missingAddend',
    example: '7 + ? = 12',
    length: 240,
  },
  {
    stage: 11,
    cup: 'castle',
    mode: 'shadow',
    skill: 'hardTimes',
    example: '7 × 3',
    length: 240,
    parMs: 100000,
  },
  {
    stage: 12,
    cup: 'castle',
    mode: 'race',
    skill: 'mixed',
    example: '6 × 4',
    length: 260,
    final: true,
  },
  { stage: 13, cup: 'rainbow', mode: 'chase', skill: 'mixed', example: '8 × 3', length: 250 },
  {
    stage: 14,
    cup: 'rainbow',
    mode: 'shadow',
    skill: 'mixed',
    example: '56 − 8',
    length: 250,
    parMs: 95000,
  },
  {
    stage: 15,
    cup: 'rainbow',
    mode: 'race',
    skill: 'mixed',
    example: '7 × 4',
    length: 280,
    final: true,
  },
];
export const TOTAL_STAGES = raceStages.length;
export function cupStages(cup: RaceCup): readonly RaceStage[] {
  return raceStages.filter((stage) => stage.cup === cup);
}
/** Every race is open from the start; stars only reward where you finish. */
export const raceLevelEntries: readonly Level[] = raceStages.map((config) => ({
  id: `unicorn-race-${config.stage}`,
  title: `race${config.stage}` as MessageKey,
  description: `race${config.stage}Help` as MessageKey,
  skills: ['fluency', config.skill],
  format: 'unicorn-race',
}));
export function raceStage(id: string | null | undefined): RaceStage | undefined {
  const match = /^unicorn-race-(\d{1,2})$/.exec(id ?? '');
  return match ? raceStages.find((stage) => stage.stage === Number(match[1])) : undefined;
}
type Random = () => number;
const int = (random: Random, min: number, max: number) =>
  min + Math.floor(random() * (max - min + 1));
const pick = <T>(random: Random, items: readonly T[]): T => items[int(random, 0, items.length - 1)];
interface Fact {
  readonly text: string;
  readonly answer: number;
}
function plus(random: Random, max: number): Fact {
  const answer = int(random, 2, max);
  const a = int(random, 1, answer - 1);
  return { text: `${a} + ${answer - a}`, answer };
}
function minus(random: Random, max: number): Fact {
  const a = int(random, 2, max);
  const b = int(random, 1, a - 1);
  return { text: `${a} − ${b}`, answer: a - b };
}
/** Doubles up to 10 + 10 and the near doubles beside them, the backbone of mental adding. */
function doubles(random: Random): Fact {
  const a = int(random, 2, 10);
  const roll = random();
  if (roll < 0.5 || a === 10) return { text: `${a} + ${a}`, answer: a + a };
  const b = roll < 0.75 ? a + 1 : a - 1;
  return random() < 0.5
    ? { text: `${a} + ${b}`, answer: a + b }
    : { text: `${b} + ${a}`, answer: a + b };
}
/** Sums to 100 stay mental: whole tens, or a one-digit step that may cross a ten. */
function plusTens(random: Random): Fact {
  if (random() < 0.5) {
    const a = int(random, 1, 8) * 10;
    const b = int(random, 1, 9 - a / 10) * 10;
    return { text: `${a} + ${b}`, answer: a + b };
  }
  const a = int(random, 11, 89);
  const b = int(random, 2, 9);
  return a + b > 100 ? plusTens(random) : { text: `${a} + ${b}`, answer: a + b };
}
function minusTens(random: Random): Fact {
  if (random() < 0.5) {
    const a = int(random, 2, 9) * 10;
    const b = int(random, 1, a / 10 - 1) * 10;
    return { text: `${a} − ${b}`, answer: a - b };
  }
  const a = int(random, 12, 99);
  const b = int(random, 2, 9);
  return { text: `${a} − ${b}`, answer: a - b };
}
/** Two two-digit numbers, tens and ones separately, without carrying or borrowing. */
function twoDigit(random: Random): Fact {
  if (random() < 0.5) {
    const tensA = int(random, 1, 7);
    const tensB = int(random, 1, 9 - tensA);
    const onesA = int(random, 1, 8);
    const onesB = int(random, 1, 9 - onesA);
    const a = tensA * 10 + onesA;
    const b = tensB * 10 + onesB;
    return { text: `${a} + ${b}`, answer: a + b };
  }
  const tensA = int(random, 3, 9);
  const tensB = int(random, 1, tensA - 1);
  const onesA = int(random, 2, 9);
  const onesB = int(random, 1, onesA - 1);
  const a = tensA * 10 + onesA;
  const b = tensB * 10 + onesB;
  return { text: `${a} − ${b}`, answer: a - b };
}
function times(
  random: Random,
  rows: readonly number[],
  maxProduct: number,
  others: readonly number[] = [2, 3, 4, 5, 6, 7, 8, 9, 10],
): Fact {
  const row = pick(random, rows);
  const other = pick(
    random,
    others.filter((candidate) => candidate * row <= maxProduct),
  );
  return random() < 0.5
    ? { text: `${row} × ${other}`, answer: row * other }
    : { text: `${other} × ${row}`, answer: row * other };
}
/** One factor is hidden: 5 × ? = 20. The answer is the missing factor. */
function missingFactor(random: Random): Fact {
  const row = pick(random, [2, 3, 4, 5, 10]);
  const other = int(random, 2, Math.min(10, Math.floor(30 / row)));
  return random() < 0.5
    ? { text: `${row} × ? = ${row * other}`, answer: other }
    : { text: `? × ${row} = ${row * other}`, answer: other };
}
/** A missing part: 7 + ? = 12 or 15 − ? = 9, up to 20, plus whole-ten versions to 100. */
function missingAddend(random: Random): Fact {
  const roll = random();
  if (roll < 0.35) {
    const sum = int(random, 5, 20);
    const a = int(random, 1, sum - 1);
    return { text: `${a} + ? = ${sum}`, answer: sum - a };
  }
  if (roll < 0.7) {
    const a = int(random, 5, 20);
    const b = int(random, 1, a - 1);
    return { text: `${a} − ? = ${a - b}`, answer: b };
  }
  const a = int(random, 1, 8) * 10;
  const b = int(random, 1, 9 - a / 10) * 10;
  return { text: `${a} + ? = ${a + b}`, answer: b };
}
function fact(random: Random, skill: RaceSkill): Fact {
  switch (skill) {
    case 'plus10':
      return plus(random, 10);
    case 'minus10':
      return minus(random, 10);
    case 'plusMinus20':
      return random() < 0.5 ? plus(random, 20) : minus(random, 20);
    case 'doubles':
      return doubles(random);
    case 'plusMinus100':
      return random() < 0.5 ? plusTens(random) : minusTens(random);
    case 'twoDigit':
      return twoDigit(random);
    case 'easyTimes':
      return times(random, [2, 5, 10], 30);
    case 'times34':
      return times(random, [3, 4], 30);
    case 'missingFactor':
      return missingFactor(random);
    case 'missingAddend':
      return missingAddend(random);
    case 'hardTimes':
      // Neither factor comes from the easy 2, 5 or 10 rows.
      return times(random, [3, 4, 6, 7, 8, 9], 30, [3, 4, 6, 7, 8, 9]);
    case 'mixed': {
      const roll = random();
      if (roll < 0.4) return times(random, [2, 3, 4, 5, 6, 7, 8, 9, 10], 30);
      if (roll < 0.55) return missingFactor(random);
      if (roll < 0.7) return missingAddend(random);
      if (roll < 0.85) return twoDigit(random);
      return random() < 0.5 ? plusTens(random) : minusTens(random);
    }
  }
}
/** Near misses a child actually makes: off by one or two, off by a ten, or a digit swap. */
function distractors(random: Random, answer: number, skill: RaceSkill): number[] {
  const candidates = new Set<number>();
  const offsets =
    skill === 'easyTimes' || skill === 'times34' || skill === 'hardTimes' || skill === 'mixed'
      ? [1, -1, 2, -2, 10, -10, 5, -5]
      : skill === 'plusMinus100' || skill === 'twoDigit'
        ? [10, -10, 1, -1, 2, -2, 20, -20]
        : [1, -1, 2, -2, 3, -3, 10, -10];
  const swapped = Number(String(answer).split('').reverse().join(''));
  // A digit swap only fools anyone for two-digit answers that are not whole tens.
  if (swapped !== answer && swapped >= 10 && answer % 10 !== 0) candidates.add(swapped);
  for (const offset of offsets) if (answer + offset >= 1) candidates.add(answer + offset);
  const pool = [...candidates].filter((value) => value !== answer && value <= 100);
  const chosen: number[] = [];
  while (chosen.length < CHOICES - 1 && pool.length) {
    const index = Math.min(pool.length - 1, Math.floor(random() * pool.length));
    chosen.push(pool.splice(index, 1)[0]);
  }
  let filler = answer + 3;
  while (chosen.length < CHOICES - 1) chosen.push(filler++);
  return chosen;
}
function shuffle<T>(random: Random, items: readonly T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}
/** One question with four shuffled choices; avoids repeating `previous` twice in a row. */
export function raceQuestion(
  skill: RaceSkill,
  random: Random = Math.random,
  previous?: string,
): RaceQuestion {
  let next = fact(random, skill);
  for (let tries = 0; tries < 6 && next.text === previous; tries++) next = fact(random, skill);
  return {
    text: next.text,
    answer: next.answer,
    choices: shuffle(random, [next.answer, ...distractors(random, next.answer, skill)]),
  };
}
