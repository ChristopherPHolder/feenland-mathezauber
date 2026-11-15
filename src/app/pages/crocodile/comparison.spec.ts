import { describe, expect, it } from 'vitest';
import {
  compare,
  comparisonLevels,
  comparisonStage,
  comparisonStages,
  createComparisonRound,
  isMastered,
  localSide,
  nextComparisonStage,
  roundStars,
} from './comparison';
import { evaluate } from './comparison.fixture';
/** Deterministic generator so every stage is exercised across many rounds. */
function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}
describe('crocodile comparison rounds', () => {
  it('builds correct, in-range and varied questions for every stage', () => {
    for (const config of comparisonStages)
      for (let seed = 1; seed <= 150; seed++) {
        const round = createComparisonRound(config, seeded(seed * 7919 + config.stage));
        expect(round).toHaveLength(config.snacks);
        const answers = round.map((question) => question.answer);
        expect(answers.filter((answer) => answer === '=').length).toBeGreaterThanOrEqual(2);
        expect(answers.filter((answer) => answer === '<').length).toBeGreaterThanOrEqual(3);
        expect(answers.filter((answer) => answer === '>').length).toBeGreaterThanOrEqual(3);
        expect(new Set(round.map((q) => `${q.left.text}|${q.right.text}`)).size).toBe(
          config.snacks,
        );
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
          if (config.skill.startsWith('numbers')) {
            expect(left.text).toMatch(/^\d+$/);
            expect(right.text).toMatch(/^\d+$/);
          }
          if (config.skill === 'sums' || config.skill === 'sums10')
            expect(left.text).toContain('+');
          if (config.skill === 'differences' || config.skill === 'differences10')
            expect(left.text).toContain('−');
          if (config.skill === 'twoSides' || config.skill === 'twoSides100') {
            expect(left.text).toMatch(/[+−]/);
            expect(right.text).toMatch(/[+−]/);
          }
          if (config.skill === 'easyTimes') {
            expect(left.text).toMatch(/^(2|5|10) × |× (2|5|10)$/);
            expect(right.text).toMatch(/^\d+$/);
          }
          if (
            config.skill === 'times' ||
            config.skill === 'times100' ||
            config.skill === 'easyTimes'
          ) {
            expect(left.text).toContain('×');
            for (const side of [left, right])
              for (const factor of side.text.includes('×')
                ? side.text.match(/\d+/g)!.map(Number)
                : [])
                expect(factor).toBeLessThanOrEqual(10);
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
  it('keeps every level open so a child can pick any crocodile, easiest first', () => {
    expect(comparisonLevels.map((level) => level.id)).toEqual(
      [8, 1, 2, 9, 10, 3, 11, 4, 5, 6, 12, 13, 7, 14, 15, 16, 17].map((n) => `crocodile-${n}`),
    );
    expect(comparisonStages.map((stage) => stage.position)).toEqual(
      comparisonStages.map((_, index) => index + 1),
    );
    expect(nextComparisonStage(comparisonStage('crocodile-8')!)?.stage).toBe(1);
    expect(nextComparisonStage(comparisonStage('crocodile-14')!)?.stage).toBe(15);
    expect(nextComparisonStage(comparisonStage('crocodile-17')!)).toBeUndefined();
    // Quick looks get longer rounds, so every level lasts a few minutes.
    for (const stage of comparisonStages)
      expect(stage.snacks).toBe(
        stage.skill.startsWith('numbers') && stage.max <= 100 ? 15 : stage.snacks,
      );
    expect(comparisonStage('crocodile-5')?.skill).toBe('twoSides');
    expect(comparisonStage('crocodile-7')?.skill).toBe('times');
    expect(comparisonStage('crocodile-9')?.max).toBe(1000);
    expect(comparisonStage('crocodile-17')?.group).toBe('crocShare');
    expect(comparisonStage('crocodile-18')).toBeUndefined();
    expect(comparisonStage('practice-30-1')).toBeUndefined();
  });
  it('halves only even numbers up to 40 and shares out exactly', () => {
    for (const id of ['crocodile-15', 'crocodile-16', 'crocodile-17']) {
      const config = comparisonStage(id)!;
      const answers = { '<': 0, '=': 0, '>': 0 };
      let close = 0;
      let total = 0;
      for (let seed = 1; seed <= 200; seed++)
        for (const { left, right, answer } of createComparisonRound(config, seeded(seed))) {
          total++;
          answers[answer]++;
          const gap = Math.abs(left.value - right.value);
          if (gap > 0 && gap <= 3) close++;
          for (const side of [left, right]) {
            const halving = /^½ of (\d+)$/.exec(side.text);
            if (halving) {
              const whole = Number(halving[1]);
              expect(whole % 2).toBe(0);
              expect(whole).toBeGreaterThanOrEqual(4);
              expect(whole).toBeLessThanOrEqual(40);
            }
            const sharing = /^(\d+) ÷ (\d+)$/.exec(side.text);
            if (sharing) {
              const [dividend, divisor] = [Number(sharing[1]), Number(sharing[2])];
              expect(dividend % divisor).toBe(0);
              expect(divisor).toBeGreaterThanOrEqual(2);
              expect(divisor).toBeLessThanOrEqual(10);
              const shared = dividend / divisor;
              expect(shared).toBeGreaterThanOrEqual(2);
              // Times-table facts backwards; only sharing by 2 goes past 10, as halving to 40.
              expect(shared <= 10 || (divisor === 2 && shared <= 20)).toBe(true);
            }
          }
          if (config.skill === 'halves') {
            expect(left.text).toMatch(/^½ of \d+$/);
            expect(right.text).toMatch(/^\d+$/);
          }
          if (config.skill === 'share') {
            expect(left.text).toMatch(/^\d+ ÷ (2|5|10)$/);
            expect(right.text).toMatch(/^\d+$/);
          }
          if (config.skill === 'timesOrShare') {
            expect(left.text).toMatch(/ [×÷] /);
            expect(`${left.text} ${right.text}`).toContain('÷');
            expect(left.text).not.toBe(right.text);
          }
        }
      // Every round mixes the three answers, and most wrong-looking pairs are close calls.
      expect(answers['=']).toBeGreaterThanOrEqual(total / 6);
      expect(answers['<']).toBeGreaterThanOrEqual(total / 3);
      expect(answers['>']).toBeGreaterThanOrEqual(total / 3);
      expect(close / (total - answers['='])).toBeGreaterThan(0.4);
    }
  });
  it('mixes times and sharing facts, and sets the forget-to-halve trap', () => {
    const rounds = Array.from({ length: 100 }, (_, seed) => seed + 1);
    const mixed = rounds.flatMap((seed) =>
      createComparisonRound(comparisonStage('crocodile-17')!, seeded(seed)),
    );
    const timesAgainstSharing = mixed.filter(({ left, right }) =>
      `${left.text} ${right.text}`.includes('×'),
    );
    const sharingBothSides = mixed.filter(
      ({ left, right }) => left.text.includes('÷') && right.text.includes('÷'),
    );
    const sharingAgainstNumber = mixed.filter(({ right }) => /^\d+$/.test(right.text));
    for (const kind of [timesAgainstSharing, sharingBothSides, sharingAgainstNumber])
      expect(kind.length).toBeGreaterThan(mixed.length / 10);
    // ½ of 16 ○ 10: the whole number is bigger than 10, its half is not.
    const halves = rounds.flatMap((seed) =>
      createComparisonRound(comparisonStage('crocodile-15')!, seeded(seed)),
    );
    expect(
      halves.filter(({ left, right }) => right.value > left.value && right.value < left.value * 2)
        .length,
    ).toBeGreaterThan(halves.length / 10);
  });
  it('puts halving into the child’s language and leaves the signs alone', () => {
    expect(localSide('½ of 16', 'von')).toBe('½ von 16');
    expect(localSide('½ of 16 ○ 7', 'de')).toBe('½ de 16 ○ 7');
    expect(localSide('24 ÷ 2 ○ 4 × 3', 'von', ':')).toBe('24 : 2 ○ 4 × 3');
    expect(localSide('30 ÷ 5', 'von')).toBe('30 ÷ 5');
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
