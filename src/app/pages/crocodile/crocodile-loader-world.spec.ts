import { SNAP_SECONDS, sinceSnap, snapJaw } from './crocodile-loader-world';

describe('crocodile loader beat', () => {
  it('starts and ends the beat with the jaws shut, so the loop has no jump', () => {
    expect(snapJaw(0)).toBe(0);
    expect(snapJaw(SNAP_SECONDS - 0.001)).toBe(0);
    expect(snapJaw(SNAP_SECONDS)).toBe(snapJaw(0));
  });

  it('opens wide before the snap and claps shut on it', () => {
    expect(snapJaw(0.5)).toBe(1);
    expect(snapJaw(0.72)).toBeLessThan(0.05);
  });

  it('never opens past wide or below shut', () => {
    for (let phase = -3; phase < 6; phase += 0.01) {
      const jaw = snapJaw(phase);
      expect(jaw).toBeGreaterThanOrEqual(0);
      expect(jaw).toBeLessThanOrEqual(1);
    }
  });

  it('counts the time since the last snap within one beat', () => {
    expect(sinceSnap(0.72)).toBeCloseTo(0);
    expect(sinceSnap(0.82)).toBeCloseTo(0.1);
    expect(sinceSnap(0.62)).toBeCloseTo(SNAP_SECONDS - 0.1);
  });
});
