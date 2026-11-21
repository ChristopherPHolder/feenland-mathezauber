import { describe, expect, it } from 'vite-plus/test';
import { VOLLEY_SECONDS, volleyPhase } from './duel-loader-world';

describe('duel loader motion', () => {
  it('sends a fire ball from the dragon to the sprite, which then reels', () => {
    expect(volleyPhase(0)).toMatchObject({ volley: 0, along: 0, flying: true, reel: 0 });
    expect(volleyPhase(VOLLEY_SECONDS * 0.225).along).toBeCloseTo(0.5);
    const landed = volleyPhase(VOLLEY_SECONDS * 0.46);
    expect(landed.flying).toBe(false);
    expect(landed.reel).toBeGreaterThan(0.9);
    expect(volleyPhase(VOLLEY_SECONDS * 0.9).reel).toBe(0);
  });

  it('loops on the same beat', () => {
    const later = volleyPhase(VOLLEY_SECONDS * 3.1);
    expect(later.volley).toBe(3);
    expect(later.along).toBeCloseTo(volleyPhase(VOLLEY_SECONDS * 0.1).along);
  });
});
