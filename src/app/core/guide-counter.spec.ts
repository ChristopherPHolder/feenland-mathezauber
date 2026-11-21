import { afterEach, describe, expect, it } from 'vite-plus/test';
import { guideCounter } from './guide-counter';

describe('guideCounter', () => {
  afterEach(() => localStorage.clear());

  it('counts finished turns per key on the device', () => {
    const market = guideCounter('test.market-guided');
    const other = guideCounter('test.other-guided');
    expect(market.count()).toBe(0);
    expect(market.add()).toBe(1);
    expect(market.add()).toBe(2);
    expect(guideCounter('test.market-guided').count()).toBe(2);
    expect(other.count()).toBe(0);
  });
});
