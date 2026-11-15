import { describe, expect, it } from 'vitest';
import {
  createRound,
  HALF_OF,
  localQuestion,
  practiceConfig,
  practiceLevels,
  questionPool,
  STAGE_QUESTIONS,
} from './practice';
const stage = (key: number) => practiceConfig(`practice-30-${key}`)!;
describe('practice progression', () => {
  it('offers thirty selectable stages with valid equations at every difficulty', () => {
    expect(practiceLevels).toHaveLength(30);
    expect(practiceLevels.map((level) => level.practice!.stage)).toEqual(
      practiceLevels.map((_, index) => index + 1),
    );
    for (const level of practiceLevels) {
      const config = level.practice!;
      for (const difficulty of ['easy', 'medium', 'hard'] as const) {
        const pool = questionPool(config, difficulty);
        expect(pool.length).toBeGreaterThanOrEqual(STAGE_QUESTIONS);
        for (const question of pool) {
          expect(Number.isInteger(question.answer)).toBe(true);
          const equation = question.text
            .replace('□', String(question.answer))
            .replace(/^Half of (\d+)/, (_, whole: string) => `${whole} ÷ 2`);
          const values = equation.match(/\d+/g)!.map(Number);
          expect(values.every((n) => n >= 0 && n <= config.max)).toBe(true);
          const [left, right] = equation.split(' = ');
          const [a, b] = left!.split(/ [＋+−×÷] /).map(Number);
          const result =
            b === undefined
              ? a
              : left!.includes('−')
                ? a! - b
                : left!.includes('×')
                  ? a! * b
                  : left!.includes('÷')
                    ? a! / b
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
  it('puts the sharing stages after the times tables, keys 25 to 30', () => {
    const groups = practiceLevels.map((level) => level.group);
    const sharing = practiceLevels.filter((level) => level.group === 'castleSharing');
    expect(sharing.map((level) => level.id)).toEqual(
      [25, 26, 27, 28, 29, 30].map((key) => `practice-30-${key}`),
    );
    expect(groups.lastIndexOf('castleTimes')).toBeLessThan(groups.indexOf('castleSharing'));
    expect(groups.lastIndexOf('castleSharing')).toBeLessThan(groups.indexOf('castleMixed'));
  });
  it('halves only even numbers, so every half is whole', () => {
    for (const [key, max] of [
      [25, 20],
      [26, 100],
    ] as const)
      for (const difficulty of ['easy', 'medium', 'hard'] as const) {
        const pool = questionPool(stage(key), difficulty);
        for (const q of pool) {
          expect(q.text.startsWith(HALF_OF)).toBe(true);
          const [given] = q.text.match(/\d+/g)!.map(Number);
          const whole = q.text.includes('□ =') ? q.answer : given!;
          const half = q.text.includes('□ =') ? given! : q.answer;
          expect(whole % 2).toBe(0);
          expect(whole).toBeLessThanOrEqual(max);
          expect(half * 2).toBe(whole);
          if (max === 100) {
            // Whole tens, or two even digits like 48: no regrouping needed.
            const tens = Math.floor(whole / 10) % 10;
            expect(whole % 10 === 0 || (tens % 2 === 0 && (whole % 10) % 2 === 0)).toBe(true);
          }
        }
        expect(pool.length).toBeGreaterThanOrEqual(10);
      }
    expect(questionPool(stage(26), 'easy').map((q) => q.text)).toContain(`${HALF_OF} 48 = □`);
    expect(questionPool(stage(26), 'hard').map((q) => q.text)).toContain(`${HALF_OF} 70 = □`);
  });
  it('shares exactly, only in the chosen rows, easy small and hard big', () => {
    for (const [key, rows] of [
      [27, [2, 5, 10]],
      [28, [3, 4]],
      [29, [6, 7, 8, 9]],
    ] as const)
      for (const difficulty of ['easy', 'medium', 'hard'] as const)
        for (const q of questionPool(stage(key), difficulty)) {
          const [whole, row] = q.text.match(/\d+/g)!.map(Number);
          expect(q.text).toBe(`${whole} ÷ ${row} = □`);
          expect((rows as readonly number[]).includes(row!)).toBe(true);
          expect(q.answer * row!).toBe(whole);
          expect(q.answer).toBeGreaterThanOrEqual(difficulty === 'hard' ? 5 : 2);
          expect(q.answer).toBeLessThanOrEqual(difficulty === 'easy' ? 6 : 10);
          expect(whole).toBeLessThanOrEqual(100);
        }
  });
  it('mixes missing factors with sharing in the last sharing stage', () => {
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      const pool = questionPool(stage(30), difficulty);
      const kinds = new Set(pool.map((q) => (q.text.includes('÷') ? 'share' : 'times')));
      expect(kinds).toEqual(new Set(['share', 'times']));
      for (const q of pool) {
        const [a, b] = q.text.match(/\d+/g)!.map(Number);
        if (q.text.includes('÷')) expect(q.answer * b!).toBe(a);
        else {
          expect(q.text.startsWith('□ × ')).toBe(true);
          expect(q.answer * a!).toBe(b);
        }
      }
    }
  });
  it('writes halving and sharing in the child’s language', () => {
    const de = { halfOf: 'Die Hälfte von', divide: ':' };
    expect(localQuestion(`${HALF_OF} 14 = □`, de)).toBe('Die Hälfte von 14 = □');
    expect(localQuestion('35 ÷ 5 = □', de)).toBe('35 : 5 = □');
    expect(localQuestion('3 × 4 = □', de)).toBe('3 × 4 = □');
  });
});
