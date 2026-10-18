import { describe, expect, it } from 'vitest';
import { createRound, practiceLevels, questionPool } from './practice';
describe('practice progression', () => {
  it('offers nine directly selectable stages with valid equations at every difficulty', () => {
    expect(practiceLevels).toHaveLength(9);
    for (const level of practiceLevels) {
      expect(level.prerequisites).toEqual([]);
      const config = level.practice!;
      for (const difficulty of ['easy', 'medium', 'hard'] as const) {
        const pool = questionPool(config, difficulty);
        expect(pool.length).toBeGreaterThanOrEqual(8);
        for (const question of pool) {
          const equation = question.text.replace('□', String(question.answer));
          const values = equation.match(/\d+/g)!.map(Number);
          expect(values.every((n) => n >= 0 && n <= config.max)).toBe(true);
          const [left, right] = equation.split(' = ');
          const [a, b] = left!.split(/ [＋+−] /).map(Number);
          const result = b === undefined ? a : left!.includes('−') ? a! - b : a! + b;
          const [c, d] = right!.split(' + ').map(Number);
          expect(result).toBe(d === undefined ? c : c! + d);
        }
        const round = createRound(config, difficulty, () => 0.5);
        expect(round).toHaveLength(8);
        expect(new Set(round.map((q) => q.text)).size).toBe(8);
      }
    }
  });
  it('keeps crossing-tens questions distinct from ordinary addition', () => {
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      for (const stage of [3, 4, 5]) {
        for (const q of questionPool(practiceLevels[stage - 1]!.practice!, difficulty)) {
          const values = q.text.replace('□', String(q.answer)).match(/\d+/g)!.map(Number);
          expect((values[0]! % 10) + (values[1]! % 10) >= 10).toBe(stage === 5);
        }
      }
    }
  });
});
