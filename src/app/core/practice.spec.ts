import { describe, expect, it } from 'vitest';
import {
  createRound,
  practiceConfig,
  practiceLevels,
  questionPool,
  STAGE_QUESTIONS,
} from './practice';
const stage = (key: number) => practiceConfig(`practice-30-${key}`)!;
describe('practice progression', () => {
  it('offers twenty-four selectable stages with valid equations at every difficulty', () => {
    expect(practiceLevels).toHaveLength(24);
    expect(practiceLevels.map((level) => level.practice!.stage)).toEqual(
      practiceLevels.map((_, index) => index + 1),
    );
    for (const level of practiceLevels) {
      const config = level.practice!;
      for (const difficulty of ['easy', 'medium', 'hard'] as const) {
        const pool = questionPool(config, difficulty);
        expect(pool.length).toBeGreaterThanOrEqual(STAGE_QUESTIONS);
        for (const question of pool) {
          const equation = question.text.replace('□', String(question.answer));
          const values = equation.match(/\d+/g)!.map(Number);
          expect(values.every((n) => n >= 0 && n <= config.max)).toBe(true);
          const [left, right] = equation.split(' = ');
          const [a, b] = left!.split(/ [＋+−×] /).map(Number);
          const result =
            b === undefined
              ? a
              : left!.includes('−')
                ? a! - b
                : left!.includes('×')
                  ? a! * b
                  : a! + b;
          const [c, d] = right!.split(' + ').map(Number);
          expect(result).toBe(d === undefined ? c : c! + d);
        }
        const round = createRound(config, difficulty, () => 0.5);
        expect(round).toHaveLength(STAGE_QUESTIONS);
        expect(new Set(round.map((q) => q.text)).size).toBe(STAGE_QUESTIONS);
      }
    }
  });
  it('keeps crossing-tens questions distinct from ordinary addition', () => {
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      for (const key of [3, 4, 5, 14, 15, 16]) {
        for (const q of questionPool(stage(key), difficulty)) {
          const values = q.text.replace('□', String(q.answer)).match(/\d+/g)!.map(Number);
          expect((values[0]! % 10) + (values[1]! % 10) >= 10).toBe(stage(key).skill === 'crossing');
        }
      }
      // Taking away across ten always has to cross: 13 − □ = 6.
      for (const q of questionPool(stage(18), difficulty)) {
        const [whole, , part] = q.text.replace('□', String(q.answer)).match(/\d+/g)!.map(Number);
        expect(whole! % 10).toBeLessThan(q.answer % 10);
        expect(whole! - q.answer).toBe(part);
      }
    }
  });
  it('keeps the multiplication stages to times tables with products up to 30', () => {
    for (const key of [10, 11]) {
      const config = stage(key);
      expect(config.max).toBe(30);
      for (const difficulty of ['easy', 'medium', 'hard'] as const)
        for (const q of questionPool(config, difficulty)) {
          expect(q.text).toContain('×');
          expect(q.text.endsWith('□')).toBe(key === 10);
          const [a, b, product] = q.text.replace('□', String(q.answer)).match(/\d+/g)!.map(Number);
          expect(a! * b!).toBe(product);
          expect(Math.min(a!, b!)).toBeGreaterThanOrEqual(difficulty === 'hard' ? 3 : 2);
          if (difficulty === 'easy') expect(product).toBeLessThanOrEqual(20);
        }
    }
  });
  it('practises only the chosen rows in the table stages, in both orders', () => {
    for (const [key, rows] of [
      [20, [2, 5, 10]],
      [21, [3, 4]],
      [22, [6, 7, 8, 9]],
    ] as const)
      for (const difficulty of ['easy', 'medium', 'hard'] as const) {
        const pool = questionPool(stage(key), difficulty);
        const orders = new Set<boolean>();
        for (const q of pool) {
          const [a, b, product] = q.text.replace('□', String(q.answer)).match(/\d+/g)!.map(Number);
          expect(a! * b!).toBe(product);
          expect(product).toBeLessThanOrEqual(100);
          expect(
            (rows as readonly number[]).includes(a!) || (rows as readonly number[]).includes(b!),
          ).toBe(true);
          orders.add((rows as readonly number[]).includes(a!));
        }
        expect(orders.size).toBe(2);
      }
  });
  it('makes ten with every bond from 1 + 9 to 9 + 1', () => {
    for (const difficulty of ['easy', 'medium', 'hard'] as const)
      for (const q of questionPool(stage(13), difficulty)) {
        const values = q.text.replace('□', String(q.answer)).match(/\d+/g)!.map(Number);
        expect(values).toContain(10);
        expect(q.answer).toBeGreaterThanOrEqual(1);
        expect(q.answer).toBeLessThanOrEqual(9);
      }
  });
});
