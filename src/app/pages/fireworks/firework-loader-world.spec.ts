import { describe, expect, it } from 'vitest';
import { bloomGlow, LOOP_SECONDS, rocketPhase } from './firework-loader-world';

describe('firework loader motion', () => {
  it('rises, then blooms, then rests before the next rocket', () => {
    expect(rocketPhase(0)).toEqual({ loop: 0, rise: 0, bloom: null });
    expect(rocketPhase(LOOP_SECONDS * 0.15).rise).toBeCloseTo(0.5);
    expect(rocketPhase(LOOP_SECONDS * 0.15).bloom).toBeNull();
    expect(rocketPhase(LOOP_SECONDS * 0.6).rise).toBeNull();
    expect(rocketPhase(LOOP_SECONDS * 0.6).bloom).toBeCloseTo(0.5);
    expect(rocketPhase(LOOP_SECONDS * 0.95)).toMatchObject({ rise: null, bloom: null });
  });

  it('loops on the same beat, with the next colour each time', () => {
    const later = rocketPhase(LOOP_SECONDS * 3.6);
    expect(later.loop).toBe(3);
    expect(later.bloom).toBeCloseTo(rocketPhase(LOOP_SECONDS * 0.6).bloom!);
  });

  it('glows up and dims away smoothly, once per loop', () => {
    expect(bloomGlow(0)).toBe(0);
    expect(bloomGlow(0.3)).toBe(1);
    expect(bloomGlow(1)).toBeCloseTo(0);
    // Brightness only rises then only falls: one gentle flash per 2.6 s loop, far under 3 a second.
    const trace = Array.from({ length: 101 }, (_, i) => bloomGlow(i / 100));
    const peak = trace.indexOf(Math.max(...trace));
    expect(trace.slice(0, peak + 1).every((v, i, a) => i === 0 || v >= a[i - 1])).toBe(true);
    expect(trace.slice(peak).every((v, i, a) => i === 0 || v <= a[i - 1])).toBe(true);
  });
});
