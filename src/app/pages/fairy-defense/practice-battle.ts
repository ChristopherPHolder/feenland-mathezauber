import { createRound, Difficulty, PracticeConfig } from '../../core/practice';
import type { Battle } from './battle';
export function practiceBattle(config: PracticeConfig, difficulty: Difficulty): Battle {
  const questions = createRound(config, difficulty);
  return {
    wave: {
      number: config.stage,
      boss: false,
      assistance: difficulty === 'easy' ? 'guided' : 'independent',
      spells: [],
      encounters: questions.map((question, index) => ({
        energy: 0,
        appearance: ['monster-red', 'monster-blue', 'monster-green', 'monster-purple'][index % 4],
        question,
      })),
    },
    encounter: 0,
    hearts: 3,
    mistakes: 0,
    attempts: 0,
    hintVisible: difficulty === 'easy',
    helpUsed: difficulty === 'easy',
    independent: [],
    phase: 'ready',
    spell: null,
    damaged: false,
  };
}
export function practiceSpells(answer: number): readonly number[] {
  const offset = (answer * 7 + 3) % 5;
  const start = Math.max(0, Math.min(26, answer - offset));
  return Array.from({ length: 5 }, (_, index) => start + index);
}
