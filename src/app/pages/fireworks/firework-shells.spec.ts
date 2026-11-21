import { describe, expect, it } from 'vite-plus/test';
import { flashesPerSecond, SHOW } from './firework-frame';
import {
  climb,
  finaleCues,
  openSpread,
  rocketAt,
  RocketPoint,
  shapeGlow,
  shapeSpread,
  SHAPE_LIFE,
  skyLevel,
  skyLight,
} from './firework-shells';
import { sparkFade } from './firework-sparks';

const sample = (from: number, to: number, step: number) =>
  Array.from({ length: Math.round((to - from) / step) + 1 }, (_, i) => from + i * step);

describe('rocket climb', () => {
  it('leaves fast and slows to a near stop before the burst', () => {
    expect(climb(0)).toBe(0);
    expect(climb(1)).toBe(1);
    const early = climb(0.1) - climb(0);
    const late = climb(1) - climb(0.9);
    expect(early).toBeGreaterThan(late * 20);
    for (const k of sample(0, 0.99, 0.01)) expect(climb(k + 0.01)).toBeGreaterThan(climb(k));
  });

  it('ends exactly at the burst and swells its head just before', () => {
    const out: RocketPoint = { x: 0, y: 0, lean: 0, glow: 0 };
    rocketAt(1, -3, -2, 0.5, 4, 1, out);
    expect(out.x).toBeCloseTo(0.5, 5);
    expect(out.y).toBeCloseTo(4, 5);
    expect(out.glow).toBeGreaterThan(1.2);
    rocketAt(0.4, -3, -2, 0.5, 4, 1, out);
    expect(out.glow).toBeCloseTo(0.75, 5);
    expect(Math.abs(out.lean)).toBeLessThanOrEqual(0.5);
  });

  it('only wobbles when asked', () => {
    const still: RocketPoint = { x: 0, y: 0, lean: 0, glow: 0 };
    const wobbly: RocketPoint = { x: 0, y: 0, lean: 0, glow: 0 };
    rocketAt(0.2, 0, 0, 0, 5, 0, still);
    rocketAt(0.2, 0, 0, 0, 5, 1, wobbly);
    expect(still.x).toBe(0);
    expect(wobbly.x).not.toBe(0);
  });
});

describe('a shell opening', () => {
  it('blooms out from the centre with a small overshoot, never a snap', () => {
    expect(openSpread(0, false)).toBe(0);
    expect(openSpread(10, false)).toBe(1);
    const steps = sample(0, 0.6, 1 / 60).map((t) => openSpread(t, false));
    expect(Math.max(...steps)).toBeLessThan(1.1);
    // No single frame jumps more than a fifth of the way.
    for (let i = 1; i < steps.length; i++) expect(steps[i] - steps[i - 1]).toBeLessThan(0.2);
  });

  it('stands still under calm motion', () => {
    expect(openSpread(0, true)).toBe(1);
  });

  it('draws the shape round its outline, the last spark arriving last', () => {
    expect(shapeSpread(0.2, 0, 100)).toBeGreaterThan(shapeSpread(0.2, 90, 100));
    expect(shapeSpread(1.2, 99, 100)).toBeCloseTo(1, 5);
    expect(shapeGlow(SHAPE_LIFE / 2)).toBe(1);
    expect(shapeGlow(SHAPE_LIFE + 0.01)).toBe(0);
  });
});

describe('the sky light', () => {
  it('fades softly back to the dusk sky', () => {
    expect(skyLight(0)).toBe(0);
    expect(skyLight(0.1)).toBe(1);
    expect(skyLight(0.7)).toBeGreaterThan(0.3);
    expect(skyLight(1.5)).toBe(0);
  });

  it('never flashes more than three times a second through the whole finale', () => {
    for (const calm of [false, true]) {
      for (const hues of [[0], [0, 1, 2, 3, 4, 5], Array.from({ length: 13 }, (_, i) => i % 6)]) {
        const cues = finaleCues(hues, SHOW, calm);
        const trace = sample(0, SHOW + 1.5, 1 / 60).map((t) => skyLevel(t, cues));
        expect(flashesPerSecond(trace, 1 / 60)).toBeLessThanOrEqual(3);
      }
    }
  });
});

describe('the finale', () => {
  it('sends up every firework the child launched, then the shape, a salvo and a willow canopy', () => {
    const hues = [0, 1, 2, 3, 4, 5, 0, 1];
    const cues = finaleCues(hues, SHOW, false);
    const own = cues.filter(
      (cue) => cue.kind !== 'shape' && cue.kind !== 'willow' && cue.rise > 0.6,
    );
    expect(own.map((cue) => cue.hue)).toEqual(hues);
    const shape = cues.find((cue) => cue.kind === 'shape')!;
    const willows = cues.filter((cue) => cue.kind === 'willow');
    expect(willows).toHaveLength(3);
    expect(Math.min(...willows.map((cue) => cue.at))).toBeGreaterThan(shape.at);
    // Everything bursts in time for its glitter to fall before the show ends.
    for (const cue of cues) expect(cue.at).toBeLessThanOrEqual(SHOW - 1.3);
    for (const cue of cues) {
      expect(Math.abs(cue.x)).toBeLessThanOrEqual(1);
      expect(cue.y).toBeGreaterThanOrEqual(0);
      expect(cue.y).toBeLessThanOrEqual(1);
    }
  });

  it('keeps calm shows short, few and in place', () => {
    const cues = finaleCues([0, 1, 2, 3, 4, 5], SHOW / 2, true);
    expect(cues.every((cue) => cue.rise === 0)).toBe(true);
    expect(cues.some((cue) => cue.kind === 'willow' || cue.kind === 'crackle')).toBe(false);
    expect(cues.length).toBeLessThanOrEqual(5);
    for (const cue of cues) expect(cue.at).toBeLessThan(SHOW / 2);
  });
});

describe('a spark fading', () => {
  it('glows up, holds and dims away to nothing', () => {
    expect(sparkFade(-0.1, 1, 0.1, 0.4)).toBe(0);
    expect(sparkFade(0.05, 1, 0.1, 0.4)).toBeCloseTo(0.5, 5);
    expect(sparkFade(0.3, 1, 0.1, 0.4)).toBe(1);
    expect(sparkFade(0.7, 1, 0.1, 0.4)).toBeCloseTo(0.5, 5);
    expect(sparkFade(1, 1, 0.1, 0.4)).toBe(0);
  });
});
