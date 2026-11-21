import { describe, expect, it } from 'vite-plus/test';
import {
  chompPose,
  hopPose,
  refusePose,
  refuseShake,
  REST,
  SNAP,
  TILES_ARRIVE,
  TILES_LEAVE,
  tileHop,
  widthOf,
} from './pond-chomp';

const times = Array.from({ length: 141 }, (_, index) => index / 100);

describe('chompPose', () => {
  it('winds up before the bite: pulled back, jaws past wide, nose up, squashed', () => {
    const windUp = chompPose(0.19);
    expect(windUp.lunge).toBeLessThan(0);
    expect(windUp.jaw).toBeGreaterThan(1);
    expect(windUp.pitch).toBeGreaterThan(0);
    expect(windUp.length).toBeLessThan(1);
  });

  it('stretches out on the strike and squashes as the jaws snap shut', () => {
    const strike = chompPose((0.2 + SNAP) / 2);
    expect(strike.length).toBeGreaterThan(1.1);
    expect(strike.lunge).toBeGreaterThan(0.5);
    const bite = chompPose(SNAP + 0.04);
    expect(bite.jaw).toBeLessThan(0.05);
    expect(bite.length).toBeLessThan(0.9);
  });

  it('chews, swallows and settles home content', () => {
    expect(chompPose(SNAP + 0.3).cheeks).toBeGreaterThan(0.5);
    expect(chompPose(SNAP + 0.7).gulp).toBeGreaterThan(0);
    const home = chompPose(1.4);
    expect(home.lunge).toBeCloseTo(0, 2);
    expect(home.content).toBe(1);
    expect(home.length).toBeCloseTo(1, 2);
  });

  it('keeps her volume and never jumps between frames', () => {
    let last = chompPose(0);
    for (const t of times) {
      const pose = chompPose(t);
      expect(pose.length * pose.height * widthOf(pose)).toBeCloseTo(1, 6);
      // The strike is the quickest move: under a third of the way to the pad per 10 ms.
      expect(Math.abs(pose.lunge - last.lunge), `lunge at ${t}`).toBeLessThan(0.3);
      expect(Math.abs(pose.length - last.length), `length at ${t}`).toBeLessThan(0.1);
      last = pose;
    }
  });
});

describe('hopPose', () => {
  it('crouches, rises stretched tall and lands with a squash, without moving off her spot', () => {
    expect(hopPose(0.12).height).toBeLessThan(0.9);
    const top = hopPose(0.35);
    expect(top.rise).toBeGreaterThan(0.4);
    expect(hopPose(0.6).height).toBeLessThan(0.95);
    for (const t of times) expect(hopPose(t).lunge).toBe(0);
    expect(hopPose(1.4).content).toBe(1);
  });
});

describe('refusePose', () => {
  it('flinches back with her mouth shut and comes to rest', () => {
    const flinch = refusePose(0.3, 1.1);
    expect(flinch.lunge).toBeLessThan(0);
    expect(flinch.jaw).toBe(0);
    expect(refusePose(1.2, 1.1)).toBe(REST);
    expect(Math.abs(refuseShake(1.09, 1.1))).toBeLessThan(0.02);
    expect(Math.max(...times.map((t) => Math.abs(refuseShake(t, 1.1))))).toBeGreaterThan(0.3);
  });
});

describe('tileHop', () => {
  it('lifts the tiles off the pad on an arc and lands them in her mouth before the snap', () => {
    expect(tileHop(TILES_LEAVE)).toEqual({ along: 0, arc: 0 });
    expect(tileHop((TILES_LEAVE + TILES_ARRIVE) / 2).arc).toBeGreaterThan(0.3);
    expect(tileHop(TILES_ARRIVE).along).toBe(1);
    expect(TILES_ARRIVE).toBeLessThanOrEqual(SNAP);
  });
});
