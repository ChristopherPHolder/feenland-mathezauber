import { describe, expect, it } from 'vite-plus/test';
import { SWEEP_SECONDS, sweepPhase } from './clock-loader-world';

describe('clock loader motion', () => {
  it('sweeps the long hand once round per loop, the short hand a twelfth', () => {
    expect(sweepPhase(0).minute).toBe(0);
    expect(sweepPhase(SWEEP_SECONDS / 4).minute).toBeCloseTo(90);
    expect(sweepPhase(SWEEP_SECONDS).hour).toBeCloseTo(30);
  });

  it('swings the bell just after the hour and rests it the rest of the way', () => {
    expect(Math.abs(sweepPhase(SWEEP_SECONDS * 0.05).swing)).toBeGreaterThan(0.1);
    expect(sweepPhase(SWEEP_SECONDS * 0.6).swing).toBe(0);
    expect(sweepPhase(SWEEP_SECONDS * 2.6).swing).toBe(0);
  });
});
