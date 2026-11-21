import { describe, expect, it } from 'vite-plus/test';
import {
  dialAngle,
  dialMarks,
  fewestWeights,
  formatAmount,
  MAX_TILT,
  swing,
  tiltFor,
} from './scales-math';

describe('the beam', () => {
  it('sits level only when both pans weigh the same', () => {
    expect(tiltFor(0, 10)).toBe(0);
    expect(tiltFor(3, 10)).toBeGreaterThan(0);
    expect(tiltFor(-3, 10)).toBeLessThan(0);
  });

  it('tips the heavier side down further for a bigger difference, up to the stand', () => {
    expect(tiltFor(1, 10)).toBeLessThan(tiltFor(5, 10));
    expect(tiltFor(50, 10)).toBe(MAX_TILT);
    expect(tiltFor(-50, 10)).toBe(-MAX_TILT);
  });

  it('tips clearly even for the smallest difference', () => {
    expect(tiltFor(1, 1000)).toBeGreaterThan(MAX_TILT * 0.4);
  });

  it('swings past its resting place and settles there', () => {
    let state = { angle: 0, speed: 0 };
    let peak = 0;
    for (let frame = 0; frame < 240; frame++) {
      state = swing(state.angle, state.speed, 0.2, 1 / 60);
      peak = Math.max(peak, state.angle);
    }
    expect(peak).toBeGreaterThan(0.2);
    expect(state.angle).toBeCloseTo(0.2, 3);
  });
});

describe('fewest weights', () => {
  it('makes an amount with the biggest weights that fit', () => {
    expect(fewestWeights(7, [1, 2, 5, 10])).toEqual([5, 2]);
    expect(fewestWeights(19, [10, 5, 2, 1])).toEqual([10, 5, 2, 2]);
    expect(fewestWeights(1000, [500, 200, 100])).toEqual([500, 500]);
    expect(fewestWeights(2750, [1000, 500, 250])).toEqual([1000, 1000, 500, 250]);
  });

  it('finds the fewest even where biggest-first would not', () => {
    expect(fewestWeights(6, [4, 3, 1])).toEqual([3, 3]);
  });

  it('says when no mix of the weights makes the amount', () => {
    expect(fewestWeights(150, [500, 200, 100])).toBeNull();
    expect(fewestWeights(-1, [1])).toBeNull();
    expect(fewestWeights(0, [1])).toEqual([]);
  });
});

describe('the dial', () => {
  const dial = { max: 10, step: 1, label: 5 };

  it('sweeps from the lower left to the lower right', () => {
    expect(dialAngle(dial, 0)).toBe(-135);
    expect(dialAngle(dial, 5)).toBe(0);
    expect(dialAngle(dial, 10)).toBe(135);
  });

  it('has a mark for every step and numbers on the labelled ones', () => {
    const marks = dialMarks(dial);
    expect(marks).toHaveLength(11);
    expect(marks.filter((mark) => mark.labelled).map((mark) => mark.value)).toEqual([0, 5, 10]);
  });

  it('marks the halfway points between numbers', () => {
    const marks = dialMarks({ max: 1000, step: 50, label: 100 });
    expect(marks.find((mark) => mark.value === 50)?.half).toBe(true);
    expect(marks.find((mark) => mark.value === 100)?.half).toBe(false);
  });
});

describe('amounts', () => {
  it('writes a decimal comma in German, Spanish and French', () => {
    expect(formatAmount(1500, 'l', 'en')).toBe('1.5 l');
    expect(formatAmount(1500, 'l', 'de')).toBe('1,5 l');
    expect(formatAmount(500, 'l', 'es')).toBe('0,5 l');
    expect(formatAmount(2500, 'l', 'fr')).toBe('2,5 l');
  });

  it('writes whole kilograms and litres in the bigger unit', () => {
    expect(formatAmount(1000, 'g', 'de')).toBe('1 kg');
    expect(formatAmount(1200, 'g', 'de')).toBe('1200 g');
    expect(formatAmount(2000, 'ml', 'fr')).toBe('2 l');
    expect(formatAmount(750, 'ml', 'fr')).toBe('750 ml');
  });

  it('asks the messages for the word for blocks', () => {
    expect(formatAmount(8, 'block', 'en', (n) => `${n} blocks`)).toBe('8 blocks');
  });
});
