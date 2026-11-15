import { ruleHint } from './rule-hint';

describe('ruleHint', () => {
  it('names a way to work each question shape out with the numbers already shown', () => {
    expect(ruleHint('7 + □ = 16')).toEqual({ key: 'hintCountOn', values: { a: 7, c: 16 } });
    expect(ruleHint('□ + 7 = 16')).toEqual({ key: 'hintCountOn', values: { a: 7, c: 16 } });
    expect(ruleHint('16 = 10 + □')).toEqual({ key: 'hintCountOn', values: { a: 10, c: 16 } });
    expect(ruleHint('16 = □ + 6')).toEqual({ key: 'hintCountOn', values: { a: 6, c: 16 } });
    expect(ruleHint('16 − □ = 12')).toEqual({ key: 'hintCountOn', values: { a: 12, c: 16 } });
    expect(ruleHint('□ − 4 = 12')).toEqual({ key: 'hintAddBack', values: { a: 4, c: 12 } });
    expect(ruleHint('Half of 12 = □')).toEqual({ key: 'hintHalf', values: { a: 12 } });
    expect(ruleHint('Half of □ = 6')).toEqual({ key: 'hintDouble', values: { a: 6 } });
    expect(ruleHint('□ × 5 = 20')).toEqual({ key: 'hintSkip', values: { a: 5, c: 20 } });
    expect(ruleHint('20 ÷ 5 = □')).toEqual({ key: 'hintSkip', values: { a: 5, c: 20 } });
    expect(ruleHint('3 × 4 = □')).toEqual({ key: 'hintJumps', values: { a: 4, c: 3 } });
  });
  it('never carries a number that is not already in the question', () => {
    for (const [question, answer] of [
      ['7 + □ = 16', 9],
      ['16 − □ = 12', 4],
      ['□ − 4 = 12', 16],
      ['Half of 12 = □', 6],
      ['20 ÷ 5 = □', 4],
      ['□ × 5 = 20', 4],
    ] as const) {
      const shown = question.match(/\d+/g)!.map(Number);
      const values = Object.values(ruleHint(question)!.values);
      expect(
        values.every((value) => shown.includes(value)),
        question,
      ).toBe(true);
      expect(values, question).not.toContain(answer);
    }
  });
  it('has no hint for a shape it does not know', () => {
    expect(ruleHint('9 + 1 = 10')).toBeNull();
  });
});
