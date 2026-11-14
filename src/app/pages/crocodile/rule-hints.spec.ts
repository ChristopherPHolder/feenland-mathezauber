import { describe, expect, it } from 'vitest';
import { comparisonStages } from './comparison';
import { ruleHint } from './rule-hints';

describe('Kiki’s rule hints', () => {
  it('reminds the child of the first step, then offers another way to compare', () => {
    expect(ruleHint('numbers20', false, 1)).toBe('ruleBigger');
    expect(ruleHint('numbers20', false, 2)).toBe('ruleCountUp');
    expect(ruleHint('numbers100', false, 2)).toBe('ruleTens');
    expect(ruleHint('sums', true, 1)).toBe('ruleWorkOut');
    expect(ruleHint('twoSides', true, 2)).toBe('ruleBigger');
    expect(ruleHint('times', true, 1)).toBe('ruleTimes');
  });
  it('treats a plain pair in the mixed level like two-digit numbers', () => {
    expect(ruleHint('mixed', false, 2)).toBe('ruleTens');
  });
  it('never runs out of rules, whatever the number of tries', () => {
    for (const { skill } of comparisonStages)
      for (const maths of [true, false])
        for (let attempts = 0; attempts < 6; attempts++)
          expect(ruleHint(skill, maths, attempts)).toMatch(/^rule/);
  });
});
