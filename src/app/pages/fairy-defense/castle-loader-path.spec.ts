import { fairyPath, twinkle } from './castle-loader-path';

describe('castle loader motion', () => {
  it('brings the fairy back to where she started after one lap, so the loop has no seam', () => {
    for (const phase of [0, 0.2, 0.5, 0.85]) {
      const now = fairyPath(phase);
      const later = fairyPath(phase + 1);
      expect(later.x).toBeCloseTo(now.x, 6);
      expect(later.y).toBeCloseTo(now.y, 6);
      expect(later.z).toBeCloseTo(now.z, 6);
      expect(later.lean).toBeCloseTo(now.lean, 6);
    }
  });

  it('flies her in front of the gate and behind it, always above the towers’ windows', () => {
    const lap = Array.from({ length: 48 }, (_, i) => fairyPath(i / 48));
    expect(Math.max(...lap.map((p) => p.z))).toBeGreaterThan(1.5);
    expect(Math.min(...lap.map((p) => p.z))).toBeLessThan(-1.5);
    expect(Math.min(...lap.map((p) => p.y))).toBeGreaterThan(1.6);
  });

  it('flashes each gem once per cycle and keeps it within 0..1', () => {
    const cycle = Array.from({ length: 120 }, (_, i) => twinkle(i / 120, 0.3));
    expect(Math.max(...cycle)).toBeCloseTo(1, 1);
    expect(Math.min(...cycle)).toBe(0);
    expect(twinkle(0.2, 0.3)).toBeCloseTo(twinkle(1.2, 0.3), 6);
    expect(twinkle(-0.4, 0)).toBeCloseTo(twinkle(0.6, 0), 6);
  });
});
