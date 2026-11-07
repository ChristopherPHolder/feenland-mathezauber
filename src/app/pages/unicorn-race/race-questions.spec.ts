import { CHOICES, raceLevelEntries, raceQuestion, raceStage, RaceSkill } from './race-questions';
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}
function evaluate(text: string): number {
  const [a, op, b] = text.split(' ');
  const left = Number(a);
  const right = Number(b);
  return op === '+' ? left + right : op === '−' ? left - right : left * right;
}
describe('race questions', () => {
  it('lists five open races with stable ids', () => {
    expect(raceLevelEntries.map((level) => level.id)).toEqual([
      'unicorn-race-1',
      'unicorn-race-2',
      'unicorn-race-3',
      'unicorn-race-4',
      'unicorn-race-5',
    ]);
    expect(raceStage('unicorn-race-4')?.skill).toBe('easyTimes');
    expect(raceStage('crocodile-1')).toBeUndefined();
  });
  it.each<[RaceSkill, (answer: number, text: string) => boolean]>([
    ['plus10', (answer, text) => answer <= 10 && text.includes('+')],
    ['plusMinus20', (answer) => answer >= 1 && answer <= 20],
    ['plusMinus100', (answer) => answer >= 1 && answer <= 100],
    ['easyTimes', (answer, text) => answer <= 30 && text.includes('×')],
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
