import { describe, expect, it } from 'vite-plus/test';
import { TOSS_SECONDS, tossPhase } from './market-loader-world';

describe('market loader motion', () => {
  it('throws the coin from the start, over an arc, into the basket', () => {
    expect(tossPhase(0)).toMatchObject({ toss: 0, along: 0, shown: true });
    const mid = tossPhase(TOSS_SECONDS * 0.275);
    expect(mid.along).toBeCloseTo(0.5);
    expect(mid.arc).toBeGreaterThan(1);
    expect(tossPhase(TOSS_SECONDS * 0.54).along).toBeGreaterThan(0.95);
  });

  it('hides the coin once it is in, and the basket bounces', () => {
    const landed = tossPhase(TOSS_SECONDS * 0.62);
    expect(landed.shown).toBe(false);
    expect(landed.squash).toBeGreaterThan(0);
    expect(tossPhase(TOSS_SECONDS * 0.95).squash).toBe(0);
  });

  it('loops on the same beat, with the next coin each time', () => {
    const later = tossPhase(TOSS_SECONDS * 2.275);
    expect(later.toss).toBe(2);
    expect(later.along).toBeCloseTo(tossPhase(TOSS_SECONDS * 0.275).along);
  });
});
