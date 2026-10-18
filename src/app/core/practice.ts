import type { Level } from './catalog';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type Pace = 'relaxed' | 'steady' | 'quick';
export type Skill =
  'placeValue' | 'addition' | 'crossing' | 'subtractionSkill' | 'startingNumber' | 'mixed';
export interface PracticeConfig {
  readonly stage: number;
  readonly skill: Skill;
  readonly max: 10 | 20 | 30 | 100;
  readonly example: string;
}
export interface Question {
  readonly text: string;
  readonly answer: number;
}
const stages: readonly [Skill, 10 | 20 | 30, string][] = [
  ['placeValue', 20, '17 = 10 + □'],
  ['placeValue', 30, '24 = □ + 4'],
  ['addition', 10, '4 + □ = 9'],
  ['addition', 20, '12 + □ = 18'],
  ['crossing', 30, '13 + □ = 21'],
  ['subtractionSkill', 20, '18 − □ = 11'],
  ['subtractionSkill', 30, '25 − □ = 19'],
  ['startingNumber', 30, '□ − 8 = 12'],
  ['mixed', 30, '7 + □ = 16'],
];
export const practiceLevels: readonly Level[] = stages.map(([skill, max, example], index) => ({
  id: `practice-30-${index + 1}`,
  title: skill,
  description: 'practiceHelp',
  implemented: true,
  prerequisites: [],
  skills: [skill],
  format: 'math-practice',
  practice: { stage: index + 1, skill, max, example },
}));
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
    for (let a = 1; a < config.max; a++)
      for (let b = 1; a + b <= config.max; b++) {
        const crosses = (a % 10) + (b % 10) >= 10;
        if (skill === 'crossing' && !crosses) continue;
        if (skill === 'addition' && crosses) continue;
        if (difficulty === 'easy' && (b > 5 || (skill !== 'crossing' && crosses))) continue;
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
  return pool.slice(0, 8);
}
