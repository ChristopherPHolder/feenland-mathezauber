import {
  CHOICES,
  cupStages,
  raceCups,
  raceLevelEntries,
  raceQuestion,
  raceStage,
  RaceSkill,
  raceStages,
} from './race-questions';
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}
/** Works the sum out; a missing-number question is solved for its question mark. */
function evaluate(text: string): number {
  const apply = (left: number, op: string, right: number) =>
    op === '+' ? left + right : op === '−' ? left - right : left * right;
  const [lhs, rhs] = text.split(' = ');
  const [a, op, b] = lhs.split(' ');
  if (rhs === undefined) return apply(Number(a), op, Number(b));
  const result = Number(rhs);
  const known = Number(a === '?' ? b : a);
  if (op === '+') return result - known;
  if (op === '×') return result / known;
  // a − ? = result
  return Number(a) - result;
}
describe('race questions', () => {
  it('lists fifteen open races in five cups with stable ids', () => {
    expect(raceLevelEntries.map((level) => level.id)).toEqual(
      Array.from({ length: 15 }, (_, index) => `unicorn-race-${index + 1}`),
    );
    expect(raceStage('unicorn-race-7')?.skill).toBe('easyTimes');
    expect(raceStage('unicorn-race-12')?.final).toBe(true);
    expect(raceStage('unicorn-race-15')?.final).toBe(true);
    expect(raceStage('unicorn-race-16')).toBeUndefined();
    expect(raceStage('crocodile-1')).toBeUndefined();
    for (const cup of raceCups) expect(cupStages(cup)).toHaveLength(3);
    expect(raceStages.map((stage) => stage.mode).filter((mode) => mode === 'chase')).toHaveLength(
      4,
    );
    expect(raceStages.map((stage) => stage.mode).filter((mode) => mode === 'shadow')).toHaveLength(
      4,
    );
    // Later races are longer, so a race grows with the child.
    expect(raceStages[11].length).toBeGreaterThan(raceStages[0].length);
  });
  it.each<[RaceSkill, (answer: number, text: string) => boolean]>([
    ['plus10', (answer, text) => answer <= 10 && text.includes('+')],
    ['minus10', (answer, text) => answer >= 1 && answer <= 9 && text.includes('−')],
    ['plusMinus20', (answer) => answer >= 1 && answer <= 20],
    ['doubles', (answer, text) => answer <= 20 && text.includes('+')],
    ['plusMinus100', (answer) => answer >= 1 && answer <= 100],
    ['twoDigit', (answer) => answer >= 1 && answer <= 99],
    ['easyTimes', (answer, text) => answer <= 30 && text.includes('×')],
    ['times34', (answer, text) => answer <= 30 && text.includes('×')],
    ['missingFactor', (answer, text) => answer >= 2 && answer <= 10 && text.includes('?')],
    ['missingAddend', (answer, text) => answer >= 1 && answer <= 80 && text.includes('?')],
    ['hardTimes', (answer, text) => answer <= 30 && text.includes('×')],
    ['mixed', (answer) => answer >= 1 && answer <= 100],
  ])('keeps %s questions in range with four distinct choices', (skill, inRange) => {
    const random = seeded(7);
    for (let n = 0; n < 200; n++) {
      const question = raceQuestion(skill, random);
      expect(evaluate(question.text)).toBe(question.answer);
      expect(inRange(question.answer, question.text), question.text).toBe(true);
      expect(question.choices).toHaveLength(CHOICES);
      expect(new Set(question.choices).size).toBe(CHOICES);
      expect(question.choices).toContain(question.answer);
      expect(question.choices.every((choice) => choice >= 0)).toBe(true);
    }
  });
  it('keeps easy times tables in the 2, 5 and 10 rows', () => {
    const random = seeded(3);
    for (let n = 0; n < 100; n++) {
      const [a, , b] = raceQuestion('easyTimes', random).text.split(' ');
      expect([a, b].some((factor) => ['2', '5', '10'].includes(factor))).toBe(true);
    }
  });
  it('keeps hard times tables out of the easy rows and two-digit sums free of carrying', () => {
    const random = seeded(5);
    for (let n = 0; n < 100; n++) {
      const [a, , b] = raceQuestion('hardTimes', random).text.split(' ');
      expect([a, b].includes('2') || [a, b].includes('5') || [a, b].includes('10')).toBe(false);
      const [left, op, right] = raceQuestion('twoDigit', random).text.split(' ');
      const [tensA, onesA] = [Math.floor(Number(left) / 10), Number(left) % 10];
      const [tensB, onesB] = [Math.floor(Number(right) / 10), Number(right) % 10];
      if (op === '+') expect(onesA + onesB).toBeLessThan(10);
      else {
        expect(onesA).toBeGreaterThan(onesB);
        expect(tensA).toBeGreaterThan(tensB);
      }
    }
  });
  it('avoids asking the same question twice in a row', () => {
    const random = seeded(11);
    let previous = raceQuestion('plus10', random).text;
    for (let n = 0; n < 60; n++) {
      const next = raceQuestion('plus10', random, previous).text;
      expect(next).not.toBe(previous);
      previous = next;
    }
  });
});
