import { describe, expect, it } from 'vite-plus/test';
import { RIDE_SECONDS, ridePhase } from './gondola-loader-world';

describe('gondola loader motion', () => {
  it('fades the cabin in at the bottom, glides it up, and fades it out at the top', () => {
    expect(ridePhase(0)).toMatchObject({ ride: 0, along: 0, shown: 0 });
    expect(ridePhase(RIDE_SECONDS * 0.5).along).toBeCloseTo(0.5);
    expect(ridePhase(RIDE_SECONDS * 0.5).shown).toBe(1);
    expect(ridePhase(RIDE_SECONDS * 0.97).along).toBeGreaterThan(0.95);
    expect(ridePhase(RIDE_SECONDS * 0.97).shown).toBeLessThan(0.5);
  });

  it('loops on the same beat, with the next cabin each time', () => {
    const later = ridePhase(RIDE_SECONDS * 2.5);
    expect(later.ride).toBe(2);
    expect(later.along).toBeCloseTo(ridePhase(RIDE_SECONDS * 0.5).along);
  });
});
