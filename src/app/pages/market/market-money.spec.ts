import { describe, expect, it } from 'vite-plus/test';
import {
  canPayExactly,
  faceUnit,
  faceValue,
  fewestCoins,
  fewestFromPurse,
  formatMoney,
} from './market-money';

describe('market money', () => {
  it('makes amounts with the fewest coins and notes', () => {
    expect(fewestCoins(1700)).toEqual([1000, 500, 200]);
    expect(fewestCoins(900, [500, 200, 100])).toEqual([500, 200, 200]);
    expect(fewestCoins(300, [200])).toBeNull();
  });

  it('knows what a purse can pay exactly, and with how few coins', () => {
    expect(canPayExactly([500, 200, 200], 700)).toBe(true);
    expect(canPayExactly([500, 200, 200], 600)).toBe(false);
    expect(fewestFromPurse([200, 200, 200, 100, 500], 600)).toBe(2);
    expect(fewestFromPurse([200, 200], 300)).toBeNull();
  });

  it('writes money the way each language does', () => {
    expect(formatMoney(600, 'en')).toBe('€6');
    expect(formatMoney(600, 'de').replace(/\s/g, ' ')).toBe('6 €');
    expect(formatMoney(150, 'fr').replace(/\s/g, ' ')).toBe('1,50 €');
    expect(faceValue(200)).toBe('2');
    expect(faceValue(50)).toBe('50');
    expect(faceUnit(50)).toBe('c');
  });
});
