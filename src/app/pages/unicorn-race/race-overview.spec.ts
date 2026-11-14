import { spreadBadges } from './race-overview';
describe('spreadBadges', () => {
  it('leaves badges alone when they are already apart', () => {
    expect(spreadBadges([0.1, 0.4, 0.8], 0.1)).toEqual([0.1, 0.4, 0.8]);
  });
  it('stands four ponies side by side on the start line, in order', () => {
    const shown = spreadBadges([0, 0, 0, 0], 0.1);
    expect(shown[0]).toBe(0);
    expect(shown).toEqual([...shown].sort((a, b) => a - b));
    for (let index = 1; index < shown.length; index++)
      expect(shown[index] - shown[index - 1]).toBeCloseTo(0.1);
  });
  it('keeps everyone on the rail at the finish, with the winner at the flag', () => {
    const shown = spreadBadges([0.97, 1, 1, 1], 0.1);
    expect(shown[3]).toBe(1);
    expect(Math.min(...shown)).toBeGreaterThanOrEqual(0);
    for (let index = 1; index < shown.length; index++)
      expect(shown[index] - shown[index - 1]).toBeGreaterThanOrEqual(0.1 - 1e-9);
  });
  it('never swaps two ponies that are close together', () => {
    const shown = spreadBadges([0.5, 0.51, 0.52], 0.1);
    expect(shown[0]).toBeLessThan(shown[1]);
    expect(shown[1]).toBeLessThan(shown[2]);
  });
});
