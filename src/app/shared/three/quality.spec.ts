import { QualityGovernor, QualityLevel, qualityLevels } from './quality';

/** Feeds `seconds` of frames, each `interval` long; returns every level change. */
function feed(governor: QualityGovernor, seconds: number, interval: number) {
  const changes: QualityLevel[] = [];
  for (let t = 0; t < seconds; t += interval) {
    const change = governor.sample(interval);
    if (change) changes.push(change);
  }
  return changes;
}

const FAST = 1 / 60;
const SLOW = 1 / 30;

describe('qualityLevels', () => {
  it('starts at retina sharpness, capped at 2, and steps down to 1', () => {
    expect(qualityLevels(3, false).map((l) => l.pixelRatio)).toEqual([2, 1.5, 1.25, 1]);
    expect(qualityLevels(2, false).map((l) => l.pixelRatio)).toEqual([2, 1.5, 1.25, 1]);
    expect(qualityLevels(1, false).map((l) => l.pixelRatio)).toEqual([1]);
  });

  it('shrinks the shadow map last, and only where there are shadows', () => {
    const levels = qualityLevels(1, true);
    expect(levels).toEqual([
      { pixelRatio: 1, shadowScale: 1 },
      { pixelRatio: 1, shadowScale: 0.5 },
    ]);
  });
});

describe('QualityGovernor', () => {
  it('keeps the best level on a smooth device', () => {
    const governor = new QualityGovernor(qualityLevels(2, true));
    expect(feed(governor, 30, FAST)).toEqual([]);
    expect(governor.level.pixelRatio).toBe(2);
  });

  it('ignores the warm-up and single hitches', () => {
    const governor = new QualityGovernor(qualityLevels(2, false));
    expect(feed(governor, 1.4, 0.2)).toEqual([]);
    expect(governor.sample(0.5)).toBeUndefined();
    expect(feed(governor, 1, SLOW)).toEqual([]);
    expect(feed(governor, 5, FAST)).toEqual([]);
    expect(governor.level.pixelRatio).toBe(2);
  });

  it('steps down while a device struggles and stays where it is smooth', () => {
    const governor = new QualityGovernor(qualityLevels(2, false));
    feed(governor, 1.5, FAST);
    // Slow at 2 and 1.5; each step down makes frames a bit faster, smooth from 1.25.
    expect(feed(governor, 2, SLOW).map((l) => l.pixelRatio)).toEqual([1.5]);
    expect(feed(governor, 2, 1 / 38).map((l) => l.pixelRatio)).toEqual([1.25]);
    expect(feed(governor, 4, FAST)).toEqual([]);
    expect(governor.level.pixelRatio).toBe(1.25);
  });

  it('tries the better level again after a while, and gives up on it after two failures', () => {
    const governor = new QualityGovernor(qualityLevels(2, false));
    feed(governor, 1.5, FAST);
    expect(feed(governor, 2, SLOW).map((l) => l.pixelRatio)).toEqual([1.5]);
    // Faster at 1.5; it waits 10 s (one strike) before trying 2 again.
    expect(feed(governor, 9, FAST)).toEqual([]);
    expect(feed(governor, 2, FAST).map((l) => l.pixelRatio)).toEqual([2]);
    // Struggles at 2 again: back down, and 2 is not tried any more.
    expect(feed(governor, 2, SLOW).map((l) => l.pixelRatio)).toEqual([1.5]);
    expect(feed(governor, 60, FAST)).toEqual([]);
    expect(governor.level.pixelRatio).toBe(1.5);
  });

  it('undoes a step down that does not speed anything up, e.g. a 30 fps cap', () => {
    const governor = new QualityGovernor(qualityLevels(2, true));
    feed(governor, 1.5, FAST);
    expect(feed(governor, 3, SLOW).map((l) => l.pixelRatio)).toEqual([1.5, 2]);
    expect(feed(governor, 20, SLOW)).toEqual([]);
    expect(governor.level.pixelRatio).toBe(2);
  });

  it('halves the shadow map once the pixel ratio is at its floor', () => {
    const governor = new QualityGovernor(qualityLevels(1, true));
    feed(governor, 1.5, FAST);
    expect(feed(governor, 2, 1 / 30)).toEqual([{ pixelRatio: 1, shadowScale: 0.5 }]);
  });

  it('goes back to the best level on reset', () => {
    const governor = new QualityGovernor(qualityLevels(2, false));
    feed(governor, 1.5, FAST);
    feed(governor, 2, SLOW);
    expect(governor.reset().pixelRatio).toBe(2);
  });
});
