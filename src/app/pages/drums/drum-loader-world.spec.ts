import { describe, expect, it } from 'vite-plus/test';
import { BOUNCE_SECONDS, bouncePhase } from './drum-loader-world';

describe('drum loader motion', () => {
  it('stands on a drum with a spreading ring, then hops to the next one', () => {
    const start = bouncePhase(0);
    expect(start).toMatchObject({ from: 0, to: 1, hop: null });
    expect(start.ring).toBe(0);
    expect(bouncePhase(BOUNCE_SECONDS * 0.2).hop).toBeNull();
    expect(bouncePhase(BOUNCE_SECONDS * 0.2).ring).toBeGreaterThan(0);
    expect(bouncePhase(BOUNCE_SECONDS * 0.675).hop).toBeCloseTo(0.5);
    expect(bouncePhase(BOUNCE_SECONDS * 0.9).ring).toBeNull();
  });

  it('bounces along the row and back without jumping across it', () => {
    const route = [0, 1, 2, 3, 4].map((n) => bouncePhase(BOUNCE_SECONDS * (n + 0.1)));
    expect(route.map((phase) => phase.from)).toEqual([0, 1, 2, 1, 0]);
    for (const phase of route) expect(Math.abs(phase.to - phase.from)).toBe(1);
  });
});
