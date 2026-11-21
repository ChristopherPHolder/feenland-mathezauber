import { afterEach, describe, expect, it } from 'vite-plus/test';
import { GuideCounter } from './guide-counter';

describe('GuideCounter', () => {
  afterEach(() => localStorage.clear());

  it('guides the first few times on a device, then stops', () => {
    const guide = new GuideCounter('test.guide', 2);
    expect(guide.learning()).toBe(true);
    guide.add();
    expect(new GuideCounter('test.guide', 2).learning()).toBe(true);
    expect(guide.add()).toBe(2);
    expect(guide.learning()).toBe(false);
  });
});
