import { describe, expect, it } from 'vitest';
import { POUR_SECONDS, pourPhase } from './potion-loader-world';

describe('potion loader motion', () => {
  it('tips the bottle, lets a drop fall, then spreads a splash and stands the bottle up', () => {
    expect(pourPhase(0)).toEqual({ pour: 0, tip: 0, drop: null, splash: null });
    expect(pourPhase(POUR_SECONDS * 0.3).tip).toBe(1);
    expect(pourPhase(POUR_SECONDS * 0.35).drop).toBeCloseTo(0.5);
    expect(pourPhase(POUR_SECONDS * 0.65).splash).toBeCloseTo(0.5);
    expect(pourPhase(POUR_SECONDS * 0.65).drop).toBeNull();
    expect(pourPhase(POUR_SECONDS * 0.9)).toMatchObject({ tip: 0, drop: null, splash: null });
  });

  it('loops on the same beat, with the next bottle each time', () => {
    const later = pourPhase(POUR_SECONDS * 3.35);
    expect(later.pour).toBe(3);
    expect(later.drop).toBeCloseTo(pourPhase(POUR_SECONDS * 0.35).drop!);
  });
});
