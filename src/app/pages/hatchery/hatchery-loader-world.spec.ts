import { hump, LOOP, loopTime, rock } from './hatchery-loader-world';

describe('hatchery loader motion', () => {
  it('starts a wobble almost at once, so the egg moves as soon as it shows', () => {
    expect(loopTime(0)).toBeCloseTo(LOOP - 0.08, 5);
    expect(Math.abs(rock(loopTime(0.4)))).toBeGreaterThan(0.02);
  });

  it('repeats exactly every loop', () => {
    for (const t of [0.3, 1.1, 2.05]) {
      expect(loopTime(t + LOOP * 3)).toBeCloseTo(loopTime(t), 5);
      expect(rock(loopTime(t + LOOP))).toBeCloseTo(rock(loopTime(t)), 5);
    }
  });

  it('rests still between wobbles, with no jump at the seam', () => {
    expect(rock(0)).toBeCloseTo(0, 9);
    expect(rock(1.6)).toBeCloseTo(0, 9);
    expect(rock(LOOP - 0.001)).toBeCloseTo(0, 9);
    expect(hump(0.6, 0, 1.2)).toBeCloseTo(1, 5);
    expect(hump(1.3, 0, 1.2)).toBe(0);
  });
});
