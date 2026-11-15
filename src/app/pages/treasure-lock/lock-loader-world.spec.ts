import { describe, expect, it } from 'vitest';
import { dialTurn, glintSweep } from './lock-loader-world';

describe('lock loader motion', () => {
  it('turns the dial one tile per click, overshooting a little before it settles', () => {
    expect(dialTurn(0)).toBeCloseTo(0);
    expect(dialTurn(0.2)).toBeGreaterThan(1);
    expect(dialTurn(0.5)).toBeCloseTo(1);
    expect(dialTurn(1.05)).toBeCloseTo(2);
    // Twelve clicks make one whole turn, so the loop wraps without a jump.
    expect(dialTurn(12 * 0.55 + 0.5)).toBeCloseTo(13);
  });

  it('sweeps the glint across the lid and rests it off to the side', () => {
    expect(glintSweep(0)).toBe(-1);
    expect(glintSweep(0.45)).toBeCloseTo(0);
    expect(glintSweep(1.5)).toBe(1);
    expect(glintSweep(2.2 + 0.45)).toBeCloseTo(0);
  });
});
