import { describe, expect, it } from 'vitest';
import {
  compare,
  comparisonLevels,
  comparisonStage,
  comparisonStages,
  createComparisonRound,
  isMastered,
  roundStars,
  ROUND_LENGTH,
  Side,
} from './comparison';
/** Deterministic generator so every stage is exercised across many rounds. */
function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}
export function evaluate(side: Side): number {
  const [a, operator, b] = side.text.split(' ');
  if (!operator) return Number(a);
  return operator === '+' ? Number(a) + Number(b) : Number(a) - Number(b);
}
describe('crocodile comparison rounds', () => {
  it('builds correct, in-range and varied questions for every stage', () => {
    for (const config of comparisonStages)
      for (let seed = 1; seed <= 150; seed++) {
        const round = createComparisonRound(config, seeded(seed * 7919 + config.stage));
        expect(round).toHaveLength(ROUND_LENGTH);
        const answers = round.map((question) => question.answer);
        expect(answers.filter((answer) => answer === '=').length).toBeGreaterThanOrEqual(2);
        expect(answers.filter((answer) => answer === '<').length).toBeGreaterThanOrEqual(3);
        expect(answers.filter((answer) => answer === '>').length).toBeGreaterThanOrEqual(3);
        expect(new Set(round.map((q) => `${q.left.text}|${q.right.text}`)).size).toBe(ROUND_LENGTH);
        for (const { left, right, answer } of round) {
          expect(evaluate(left)).toBe(left.value);
          expect(evaluate(right)).toBe(right.value);
          expect(compare(left.value, right.value)).toBe(answer);
          for (const side of [left, right]) {
            expect(side.value).toBeGreaterThanOrEqual(0);
            expect(side.value).toBeLessThanOrEqual(config.max);
            for (const operand of side.text.match(/\d+/g)!.map(Number)) {
              expect(operand).toBeGreaterThanOrEqual(0);
              expect(operand).toBeLessThanOrEqual(config.max);
            }
          }
          if (config.skill === 'numbers20' || config.skill === 'numbers100') {
            expect(left.text).toMatch(/^\d+$/);
            expect(right.text).toMatch(/^\d+$/);
          }
          if (config.skill === 'sums') expect(left.text).toContain('+');
          if (config.skill === 'differences') expect(left.text).toContain('−');
          if (config.skill === 'twoSides') {
            expect(left.text).toMatch(/[+−]/);
            expect(right.text).toMatch(/[+−]/);
          }
          if (config.skill === 'mixed') {
            expect(`${left.text}${right.text}`).toMatch(/[+−]/);
            for (const side of [left, right])
              if (side.text.includes(' '))
                expect(side.text.match(/\d+/g)!.some((n) => Number(n) % 10 === 0)).toBe(true);
          }
        }
      }
  });
  it('keeps the first level open and chains the rest behind mastery', () => {
    expect(comparisonLevels.map((level) => level.id)).toEqual([
      'crocodile-1',
      'crocodile-2',
      'crocodile-3',
      'crocodile-4',
      'crocodile-5',
      'crocodile-6',
    ]);
    expect(comparisonLevels[0].prerequisites).toEqual([]);
    expect(comparisonLevels[3].prerequisites).toEqual(['crocodile-3']);
    expect(comparisonStage('crocodile-5')?.skill).toBe('twoSides');
    expect(comparisonStage('crocodile-7')).toBeUndefined();
    expect(comparisonStage('practice-30-1')).toBeUndefined();
  });
  it('awards stars gently and opens the next level from two stars', () => {
    expect(roundStars(0)).toBe(3);
    expect(roundStars(2)).toBe(2);
    expect(roundStars(3)).toBe(1);
    expect(roundStars(9)).toBe(1);
    expect(isMastered(2)).toBe(true);
    expect(isMastered(3)).toBe(false);
  });
});
