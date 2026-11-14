import type { Level } from './catalog';
import type { MessageKey } from './messages';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type Pace = 'relaxed' | 'steady' | 'quick';
export type Skill =
  | 'placeValue'
  | 'makeTen'
  | 'addition'
  | 'crossing'
  | 'subtractionSkill'
  | 'subCrossing'
  | 'startingNumber'
  | 'mixed'
  | 'times'
  | 'missingFactor';
export interface PracticeConfig {
  /** The level id progress is saved under; stable even when stages are reordered. */
  readonly id?: string;
  /** Position on the castle's path, easiest first. */
  readonly stage: number;
  readonly skill: Skill;
  readonly max: 10 | 20 | 30 | 100;
  readonly example: string;
  /** Times tables: the rows practised. Without it the ×2 to ×10 rows up to `max` are used. */
  readonly rows?: readonly number[];
  /** A name for the stage when the skill's own name is too broad, like "Times 3 and 4". */
  readonly title?: MessageKey;
}
export interface Question {
  readonly text: string;
  readonly answer: number;
}
/** Questions per castle stage: about two minutes of battle at a steady pace. */
export const STAGE_QUESTIONS = 10;
interface StageDefinition {
  /** The number in the level id `practice-30-<n>`; saved progress uses it, so never change it. */
  readonly key: number;
  readonly group: CastleGroup;
  readonly skill: Skill;
  readonly max: 10 | 20 | 30 | 100;
  readonly example: string;
  readonly rows?: readonly number[];
  readonly title?: MessageKey;
}
export type CastleGroup =
  'castleNumbers' | 'castleAdding' | 'castleTakeAway' | 'castleTimes' | 'castleMixed';
/**
 * The castle's stages from easiest to hardest, in topic groups. Ids 1 to 11 are the original
 * path to 30; later ids were added when the path grew to 100 and the times tables.
 */
const stages: readonly StageDefinition[] = [
  { key: 1, group: 'castleNumbers', skill: 'placeValue', max: 20, example: '17 = 10 + □' },
  { key: 2, group: 'castleNumbers', skill: 'placeValue', max: 30, example: '24 = □ + 4' },
  { key: 12, group: 'castleNumbers', skill: 'placeValue', max: 100, example: '68 = 60 + □' },
  { key: 13, group: 'castleAdding', skill: 'makeTen', max: 10, example: '7 + □ = 10' },
  { key: 3, group: 'castleAdding', skill: 'addition', max: 10, example: '4 + □ = 9' },
  { key: 4, group: 'castleAdding', skill: 'addition', max: 20, example: '12 + □ = 18' },
  { key: 14, group: 'castleAdding', skill: 'crossing', max: 20, example: '8 + □ = 13' },
  { key: 5, group: 'castleAdding', skill: 'crossing', max: 30, example: '13 + □ = 21' },
  { key: 15, group: 'castleAdding', skill: 'addition', max: 100, example: '34 + □ = 39' },
  { key: 16, group: 'castleAdding', skill: 'crossing', max: 100, example: '47 + □ = 52' },
  { key: 17, group: 'castleTakeAway', skill: 'subtractionSkill', max: 10, example: '9 − □ = 5' },
  { key: 6, group: 'castleTakeAway', skill: 'subtractionSkill', max: 20, example: '18 − □ = 11' },
  { key: 18, group: 'castleTakeAway', skill: 'subCrossing', max: 20, example: '13 − □ = 6' },
  { key: 7, group: 'castleTakeAway', skill: 'subtractionSkill', max: 30, example: '25 − □ = 19' },
  { key: 8, group: 'castleTakeAway', skill: 'startingNumber', max: 30, example: '□ − 8 = 12' },
  { key: 19, group: 'castleTakeAway', skill: 'subtractionSkill', max: 100, example: '63 − □ = 58' },
  {
    key: 20,
    group: 'castleTimes',
    skill: 'times',
    max: 100,
    example: '5 × 6 = □',
    rows: [2, 5, 10],
    title: 'timesEasyRows',
  },
  { key: 10, group: 'castleTimes', skill: 'times', max: 30, example: '3 × 4 = □' },
  {
    key: 21,
    group: 'castleTimes',
    skill: 'times',
    max: 100,
    example: '4 × 7 = □',
    rows: [3, 4],
    title: 'timesThreeFour',
  },
  {
    key: 22,
    group: 'castleTimes',
    skill: 'times',
    max: 100,
    example: '7 × 8 = □',
    rows: [6, 7, 8, 9],
    title: 'timesBigRows',
  },
  { key: 11, group: 'castleTimes', skill: 'missingFactor', max: 30, example: '3 × □ = 12' },
  { key: 23, group: 'castleTimes', skill: 'missingFactor', max: 100, example: '6 × □ = 42' },
  { key: 9, group: 'castleMixed', skill: 'mixed', max: 30, example: '7 + □ = 16' },
  { key: 24, group: 'castleMixed', skill: 'mixed', max: 100, example: '□ − 28 = 47' },
];
export const practiceLevels: readonly Level[] = stages.map((definition, index) => {
  const id = `practice-30-${definition.key}`;
  return {
    id,
    title: definition.title ?? definition.skill,
    description: 'practiceHelp',
    skills: [definition.skill],
    format: 'math-practice',
    group: definition.group,
    practice: {
      id,
      stage: index + 1,
      skill: definition.skill,
      max: definition.max,
      example: definition.example,
      ...(definition.rows ? { rows: definition.rows } : {}),
      ...(definition.title ? { title: definition.title } : {}),
    },
  };
});
/** The castle stage behind a level id, if it is one. */
export function practiceConfig(id: string | null | undefined): PracticeConfig | undefined {
  return practiceLevels.find((level) => level.id === id)?.practice;
}
/** Enumerate valid equations first so every difficulty respects the level's skill and range. */
export function questionPool(config: PracticeConfig, difficulty: Difficulty): readonly Question[] {
  const skills: readonly Skill[] =
    config.skill === 'mixed'
      ? ['placeValue', 'addition', 'crossing', 'subtractionSkill', 'startingNumber']
      : [config.skill];
  const questions: Question[] = [];
  for (const skill of skills) {
    if (skill === 'placeValue') {
      for (let n = 10; n <= config.max; n++) {
        const tens = Math.floor(n / 10) * 10,
          ones = n % 10;
        if (difficulty !== 'hard') questions.push({ text: `${n} = ${tens} + □`, answer: ones });
        if (difficulty !== 'easy') questions.push({ text: `${n} = □ + ${ones}`, answer: tens });
      }
      continue;
    }
    if (skill === 'makeTen') {
      questions.push(...tenQuestions(difficulty));
      continue;
    }
    if (skill === 'times' || skill === 'missingFactor') {
      questions.push(
        ...(config.rows
          ? rowQuestions(skill, config.rows, config.max, difficulty)
          : timesQuestions(skill, config.max, difficulty)),
      );
      continue;
    }
    const crossingOnly = skill === 'crossing' || skill === 'subCrossing';
    for (let a = 1; a < config.max; a++)
      for (let b = 1; a + b <= config.max; b++) {
        const crosses = (a % 10) + (b % 10) >= 10;
        if (crossingOnly && !crosses) continue;
        if (skill === 'addition' && crosses) continue;
        if (difficulty === 'easy' && (b > 5 || (!crossingOnly && crosses))) continue;
        if (difficulty === 'hard' && b < (config.max === 10 ? 5 : 6)) continue;
        if (skill === 'addition' || skill === 'crossing') {
          if (difficulty !== 'hard') questions.push({ text: `${a} + □ = ${a + b}`, answer: b });
          if (difficulty !== 'easy') questions.push({ text: `□ + ${a} = ${a + b}`, answer: b });
        } else if (skill === 'startingNumber') {
          questions.push({ text: `□ − ${b} = ${a}`, answer: a + b });
        } else {
          questions.push({ text: `${a + b} − □ = ${a}`, answer: b });
        }
      }
  }
  return questions;
}
/** Number bonds to ten, the castle's own spell: 7 + □ = 10, □ + 3 = 10 and 10 − □ = 6. */
function tenQuestions(difficulty: Difficulty): Question[] {
  const questions: Question[] = [];
  for (let a = 1; a <= 9; a++) {
    if (difficulty !== 'hard') questions.push({ text: `${a} + □ = 10`, answer: 10 - a });
    questions.push({ text: `□ + ${a} = 10`, answer: 10 - a });
    if (difficulty !== 'easy') questions.push({ text: `10 − □ = ${a}`, answer: 10 - a });
  }
  return questions;
}
/**
 * Products stay within the range; easy keeps to the ×2, ×5 and ×10 rows, hard skips ×2.
 * Ranges above 30 let the easy rows run all the way to ×10.
 */
function timesQuestions(skill: Skill, max: number, difficulty: Difficulty): Question[] {
  const questions: Question[] = [];
  for (let a = 2; a <= 10; a++)
    for (let b = 2; b <= 10 && a * b <= max; b++) {
      if (difficulty === 'easy' && (a * b > (max > 30 ? 100 : 20) || ![2, 5, 10].includes(a)))
        continue;
      if (difficulty === 'hard' && (a < 3 || b < 3)) continue;
      questions.push(timesQuestion(skill, a, b, difficulty === 'easy' || (a + b) % 2 === 0));
    }
  return questions;
}
/** Chosen rows only: easy keeps to the first half of each row, hard to its second half. */
function rowQuestions(
  skill: Skill,
  rows: readonly number[],
  max: number,
  difficulty: Difficulty,
): Question[] {
  const questions: Question[] = [];
  for (const row of rows)
    for (let other = 2; other <= 10 && row * other <= max; other++) {
      if (difficulty === 'easy' && other > 6) continue;
      if (difficulty === 'hard' && other < 5) continue;
      // Both orders appear, so a row is learnt from either side: 4 × 7 and 7 × 4.
      const rowFirst = (row + other) % 2 === 0;
      questions.push(
        rowFirst ? timesQuestion(skill, row, other, true) : timesQuestion(skill, other, row, false),
      );
    }
  return questions;
}
function timesQuestion(skill: Skill, a: number, b: number, hideSecond: boolean): Question {
  if (skill === 'times') return { text: `${a} × ${b} = □`, answer: a * b };
  return hideSecond
    ? { text: `${a} × □ = ${a * b}`, answer: b }
    : { text: `□ × ${b} = ${a * b}`, answer: a };
}
export function createRound(
  config: PracticeConfig,
  difficulty: Difficulty,
  random = Math.random,
): readonly Question[] {
  const pool = [...questionPool(config, difficulty)];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, STAGE_QUESTIONS);
}
