import type { Level } from '../../core/catalog';
import type { MessageKey } from '../../core/messages';
export type RaceSkill = 'plus10' | 'plusMinus20' | 'plusMinus100' | 'easyTimes' | 'mixed';
export interface RaceStage {
  readonly stage: RaceLevel;
  readonly skill: RaceSkill;
  readonly example: string;
}
export type RaceLevel = 1 | 2 | 3 | 4 | 5;
export const raceLevels: readonly RaceLevel[] = [1, 2, 3, 4, 5];
export interface RaceQuestion {
  readonly text: string;
  readonly answer: number;
  /** Four choices in display order; exactly one equals `answer`. */
  readonly choices: readonly number[];
}
export const CHOICES = 4;
export const raceStages: readonly RaceStage[] = [
  { stage: 1, skill: 'plus10', example: '3 + 4' },
  { stage: 2, skill: 'plusMinus20', example: '15 − 7' },
  { stage: 3, skill: 'plusMinus100', example: '48 + 30' },
  { stage: 4, skill: 'easyTimes', example: '5 × 4' },
  { stage: 5, skill: 'mixed', example: '7 × 3' },
];
export const TOTAL_STAGES = raceStages.length;
/** Every race is open from the start; stars only reward where you finish. */
export const raceLevelEntries: readonly Level[] = raceStages.map((config) => ({
  id: `unicorn-race-${config.stage}`,
  title: `race${config.stage}` as MessageKey,
  description: `race${config.stage}Help` as MessageKey,
  skills: ['fluency', config.skill],
  format: 'unicorn-race',
}));
export function raceStage(id: string | null | undefined): RaceStage | undefined {
  const match = /^unicorn-race-(\d)$/.exec(id ?? '');
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
function times(random: Random, rows: readonly number[], maxProduct: number): Fact {
  const row = pick(random, rows);
  const other = int(random, 2, Math.min(10, Math.floor(maxProduct / row)));
  return random() < 0.5
    ? { text: `${row} × ${other}`, answer: row * other }
    : { text: `${other} × ${row}`, answer: row * other };
}
function fact(random: Random, skill: RaceSkill): Fact {
  switch (skill) {
    case 'plus10':
      return plus(random, 10);
    case 'plusMinus20':
      return random() < 0.5 ? plus(random, 20) : minus(random, 20);
    case 'plusMinus100':
      return random() < 0.5 ? plusTens(random) : minusTens(random);
    case 'easyTimes':
      return times(random, [2, 5, 10], 30);
    case 'mixed': {
      const roll = random();
      if (roll < 0.5) return times(random, [2, 3, 4, 5, 6, 7, 8, 9, 10], 30);
      return roll < 0.75 ? plusTens(random) : minusTens(random);
    }
  }
}
/** Near misses a child actually makes: off by one or two, off by a ten, or a digit swap. */
function distractors(random: Random, answer: number, skill: RaceSkill): number[] {
  const candidates = new Set<number>();
  const offsets =
    skill === 'easyTimes' || skill === 'mixed'
      ? [1, -1, 2, -2, 10, -10, 5, -5]
      : skill === 'plusMinus100'
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
