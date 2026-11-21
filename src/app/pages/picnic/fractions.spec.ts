import { describe, expect, it } from 'vite-plus/test';
import {
  checkShare,
  compareFractions,
  equalSizes,
  equivalent,
  extremes,
  frac,
  fractionGlyph,
  fractionOfSet,
  pieceSizes,
  unevenSizes,
} from './fractions';

describe('fractions', () => {
  it('compares by amount, so more friends means smaller slices', () => {
    expect(compareFractions(frac(1, 3), frac(1, 6))).toBe(1);
    expect(compareFractions(frac(1, 8), frac(1, 4))).toBe(-1);
    expect(compareFractions(frac(1, 2), frac(2, 4))).toBe(0);
    expect(compareFractions(frac(3, 4), frac(2, 3))).toBe(1);
  });

  it('knows equivalent fractions', () => {
    expect(equivalent(frac(1, 2), frac(2, 4))).toBe(true);
    expect(equivalent(frac(1, 3), frac(2, 6))).toBe(true);
    expect(equivalent(frac(1, 2), frac(2, 6))).toBe(false);
  });

  it('takes a fraction of a group only when it shares out evenly', () => {
    expect(fractionOfSet(frac(1, 3), 12)).toBe(4);
    expect(fractionOfSet(frac(3, 4), 12)).toBe(9);
    expect(fractionOfSet(frac(1, 5), 12)).toBeNull();
  });

  it('writes the common fractions as single glyphs', () => {
    expect(fractionGlyph(frac(1, 2))).toBe('½');
    expect(fractionGlyph(frac(3, 4))).toBe('¾');
    expect(fractionGlyph(frac(2, 4))).toBe('2⁄4');
  });
});

describe('cutting', () => {
  it('cuts a strip into pieces from end to end', () => {
    expect(pieceSizes('strip', [])).toEqual([12]);
    expect(pieceSizes('strip', [6])).toEqual([6, 6]);
    expect(pieceSizes('strip', [8, 4])).toEqual([4, 4, 4]);
    expect(pieceSizes('strip', [3, 3, 0, 12])).toEqual([3, 9]);
  });

  it('cuts a round food from its top cut around the rim', () => {
    expect(pieceSizes('round', [])).toEqual([12]);
    expect(pieceSizes('round', [0])).toEqual([12]);
    expect(pieceSizes('round', [6])).toEqual([6, 6]);
    expect(pieceSizes('round', [4, 8])).toEqual([4, 4, 4]);
    expect(pieceSizes('round', [5])).toEqual([5, 7]);
  });

  it('checks the number of pieces and that they are the same size', () => {
    expect(checkShare([6, 6], 2)).toEqual({ count: true, equal: true, fair: true });
    expect(checkShare([5, 7], 2)).toEqual({ count: true, equal: false, fair: false });
    expect(checkShare([4, 4, 4], 2)).toEqual({ count: false, equal: true, fair: false });
    expect(extremes([3, 5, 4])).toEqual([3, 5]);
  });

  it('draws uneven pieces that are clearly not the same, and still make a whole', () => {
    for (const parts of [2, 3, 4, 6, 8]) {
      const sizes = unevenSizes(parts, 1);
      expect(sizes.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
      const [small, big] = extremes(sizes);
      expect(big / small).toBeGreaterThan(1.5);
      expect(equalSizes(parts).every((size) => size === 1 / parts)).toBe(true);
    }
  });
});
