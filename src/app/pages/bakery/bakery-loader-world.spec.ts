import { describe, expect, it } from 'vite-plus/test';
import { cookiePop, FILL_SECONDS } from './bakery-loader-world';

describe('bakery loader motion', () => {
  it('pops the cookies onto the tray one after another', () => {
    const at = FILL_SECONDS * 0.2;
    expect(cookiePop(at, 0)).toBe(1);
    expect(cookiePop(at, 5)).toBe(0);
    expect(cookiePop(FILL_SECONDS * 0.9, 5)).toBe(1);
  });

  it('starts over with an empty tray', () => {
    expect(cookiePop(FILL_SECONDS * 1.01, 0)).toBe(0);
  });
});
