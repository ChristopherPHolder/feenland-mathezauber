import { describe, expect, it } from 'vitest';
import { CONSTELLATIONS, constellationEdges, constellation } from './star-constellations';
import {
  catchPoints,
  catchWindow,
  createRound,
  FINALE_LENGTH,
  fallSeconds,
  landmarkHint,
  lineFor,
  parseStarPace,
  roundLength,
  roundStars,
  share,
  spread,
  stardust,
  StarItem,
  starLevels,
  starStage,
  starStages,
  sumValue,
  tryCatch,
  whereabouts,
} from './star-levels';
import { parseStarRecords } from './star-scores';

/** A small seeded random, so every round in these tests is the same each run. */
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const stage = (n: number) => starStage(`star-catcher-${n}`)!;
const placed = (items: StarItem[]) =>
  items.filter((item): item is Extract<StarItem, { kind: 'place' }> => item.kind === 'place');

describe('star catcher levels', () => {
  it('has twelve levels with stable ids in four topics', () => {
    expect(starLevels.map((level) => level.id)).toEqual(
      Array.from({ length: 12 }, (_, index) => `star-catcher-${index + 1}`),
    );
    expect(new Set(starStages.map((s) => s.group))).toEqual(
      new Set(['starSmall', 'starHundred', 'starSums', 'starBig']),
    );
    expect(new Set(starStages.map((s) => s.constellation)).size).toBe(12);
    expect(starStage('star-catcher-13')).toBeUndefined();
    expect(starStage('potion-1')).toBeUndefined();
  });

  it('fades the landmarks level by level', () => {
    const labelled = (n: number) =>
      lineFor(stage(n))
        .ticks.filter((tick) => tick.labelled)
        .map((tick) => tick.value);
    expect(labelled(1)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(labelled(2)).toEqual([0, 5, 10]);
    expect(labelled(5)).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    expect(labelled(6)).toEqual([0, 50, 100]);
    expect(lineFor(stage(6)).ticks).toHaveLength(11);
    expect(lineFor(stage(7)).ticks.map((tick) => tick.value)).toEqual([0, 100]);
    expect(lineFor(stage(7)).hintTicks).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90]);
    expect(labelled(11)).toEqual([0, 500, 1000]);
  });

  it('hides the far end of the mystery bridge and shows one step instead', () => {
    for (let seed = 1; seed < 20; seed++) {
      const line = lineFor(stage(12), seeded(seed));
      expect(line.mystery).toBe(true);
      expect([10, 100]).toContain(line.unit);
      expect(line.ticks.map((tick) => tick.value)).toEqual([0, line.unit]);
      expect(line.max % line.unit).toBe(0);
      expect(line.max / line.unit).toBeGreaterThanOrEqual(4);
    }
  });
});

describe('star catcher rounds', () => {
  it('has ten stars (eight on sum levels) and a three-star finale', () => {
    for (const s of starStages) {
      const items = createRound(s, seeded(s.stage));
      expect(items).toHaveLength(roundLength(s) + FINALE_LENGTH);
      expect(roundLength(s)).toBe(s.sums ? 8 : 10);
      expect(
        items.slice(-FINALE_LENGTH).every((item) => item.finale && item.kind === 'place'),
      ).toBe(true);
    }
  });

  it('keeps every star on its bridge and away from the very ends after level 2', () => {
    for (const s of starStages)
      for (let seed = 1; seed <= 15; seed++)
        for (const item of placed(createRound(s, seeded(seed * 31 + s.stage)))) {
          expect(item.target).toBeGreaterThan(0);
          expect(item.target).toBeLessThan(item.line.max);
          if (s.stage > 2 && !item.between) {
            expect(item.target).toBeGreaterThanOrEqual(item.line.max * 0.03);
            expect(item.target).toBeLessThanOrEqual(item.line.max * 0.97);
          }
        }
  });

  it('never repeats a number in a round unless the pool is smaller than the round', () => {
    for (const n of [3, 5, 6, 7, 11])
      for (let seed = 1; seed <= 10; seed++) {
        const targets = placed(createRound(stage(n), seeded(seed)))
          .filter((item) => !item.between)
          .map((item) => item.target);
        expect(new Set(targets).size).toBe(targets.length);
      }
    for (const n of [1, 2, 4])
      for (let seed = 1; seed <= 10; seed++) {
        const targets = placed(createRound(stage(n), seeded(seed))).map((item) => item.target);
        targets.slice(1).forEach((target, index) => expect(target).not.toBe(targets[index]));
        // All nine numbers come up before any comes back.
        expect(new Set(targets.slice(0, 9)).size).toBe(9);
      }
  });

  it('spreads stars across the bridge instead of bunching them', () => {
    const values = spread(seeded(4), 10, 1, 99);
    const halves = [values.filter((v) => v < 50).length, values.filter((v) => v >= 50).length];
    expect(halves).toEqual([5, 5]);
  });

  it('puts at least 30% of stars in the squash zone on levels 5 and 11', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const five = placed(createRound(stage(5), seeded(seed))).map((item) => item.target);
      expect(five.filter((v) => v >= 11 && v <= 30).length / 13).toBeGreaterThanOrEqual(0.3);
      const eleven = placed(createRound(stage(11), seeded(seed))).map((item) => item.target);
      expect(eleven.filter((v) => v >= 100 && v <= 250).length / 13).toBeGreaterThanOrEqual(0.3);
    }
  });

  it('starts the big bridge with hundreds', () => {
    const items = placed(createRound(stage(11), seeded(9)));
    expect(items.slice(0, 2).every((item) => item.target % 100 === 0)).toBe(true);
  });

  it('asks for neighbours either side of a ten one after the other on level 6', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const targets = createRound(stage(6), seeded(seed)).map((item) =>
        item.kind === 'place' ? item.target : -100,
      );
      const pairs = targets
        .slice(1)
        .filter((t, i) => Math.abs(t - targets[i]) === 2 && (t + targets[i]) % 20 === 0);
      expect(pairs.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('asks for tens only on level 4', () => {
    const targets = placed(createRound(stage(4), seeded(2))).map((item) => item.target);
    expect(targets.every((t) => t % 10 === 0)).toBe(true);
  });

  it('builds sums and differences whose answer stays on the bridge', () => {
    for (const n of [8, 9, 10])
      for (let seed = 1; seed <= 20; seed++)
        for (const item of placed(createRound(stage(n), seeded(seed)))) {
          if (item.between) continue;
          expect(item.label).toMatch(/^\d+ [+−] \d+$/);
          expect(sumValue(item.label)).toBe(item.target);
          expect(item.target).toBeGreaterThan(0);
          expect(item.target).toBeLessThan(item.line.max);
          const [a, , b] = item.label.split(' ').map(Number);
          expect(a).toBeLessThanOrEqual(item.line.max);
          expect(b).toBeGreaterThan(1);
          if (n === 10) expect(b).toBeGreaterThanOrEqual(11);
        }
  });

  it('mixes in other star types from level 5 on, about one in five', () => {
    for (const s of starStages) {
      const items = createRound(s, seeded(s.stage + 3));
      const other = items.filter((item) => item.kind !== 'place' || item.between);
      if (s.stage < 5) expect(other).toHaveLength(0);
      else expect(other).toHaveLength(2);
    }
    const kinds = new Set<string>();
    for (let seed = 1; seed <= 30; seed++)
      for (const item of createRound(stage(7), seeded(seed)))
        kinds.add(item.kind === 'place' && item.between ? 'middle' : item.kind);
    expect(kinds).toEqual(new Set(['place', 'landed', 'compare', 'middle']));
  });

  it('gives landed stars well spaced options and pairs that differ', () => {
    for (let seed = 1; seed <= 30; seed++)
      for (const item of createRound(stage(9), seeded(seed))) {
        if (item.kind === 'landed') {
          expect(item.options).toContain(item.target);
          const sorted = [...item.options].sort((a, b) => a - b);
          sorted.slice(1).forEach((v, i) => expect(v - sorted[i]).toBeGreaterThanOrEqual(18));
        }
        if (item.kind === 'compare') {
          expect(item.pair[0]).not.toBe(item.pair[1]);
          for (const value of item.pair) expect(value).toBeGreaterThan(0);
        }
      }
  });
});

describe('catching a star', () => {
  const four = stage(4);
  const line = lineFor(four);

  it('catches inside the window and gilds a dead-on catch', () => {
    expect(tryCatch(four, line, 70, 0.7, 0)).toMatchObject({ caught: true, golden: true });
    expect(tryCatch(four, line, 70, 0.72, 0)).toMatchObject({ caught: true, golden: true });
    expect(tryCatch(four, line, 70, 0.73, 0)).toMatchObject({ caught: true, golden: false });
    expect(tryCatch(four, line, 70, 0.78, 0)).toMatchObject({ caught: true, golden: false });
    expect(tryCatch(four, line, 70, 0.62, 0)).toMatchObject({ caught: true });
  });

  it('only tells the direction on a miss', () => {
    expect(tryCatch(four, line, 70, 0.5, 0)).toEqual({ caught: false, direction: 'further' });
    expect(tryCatch(four, line, 70, 0.9, 0)).toEqual({ caught: false, direction: 'back' });
  });

  it('widens the window a little from the third miss on, for that star only', () => {
    expect(catchWindow(four, 0)).toBe(0.08);
    expect(catchWindow(four, 2)).toBe(0.08);
    expect(catchWindow(four, 3)).toBeCloseTo(0.12);
    expect(catchWindow(four, 4)).toBeCloseTo(0.16);
    expect(catchWindow(four, 20)).toBe(0.25);
    expect(tryCatch(four, line, 70, 0.81, 2).caught).toBe(false);
    expect(tryCatch(four, line, 70, 0.81, 3).caught).toBe(true);
  });

  it('pays more for a tighter catch, double for gold, comet and finale', () => {
    const base = { firstTry: true, golden: false, comet: false, finale: false, stardust: 0 };
    expect(catchPoints({ ...base, closeness: 0 })).toBe(10);
    expect(catchPoints({ ...base, closeness: 1 })).toBe(20);
    expect(catchPoints({ ...base, closeness: 1, golden: true })).toBe(40);
    expect(catchPoints({ ...base, closeness: 1, golden: true, comet: true })).toBe(80);
    expect(catchPoints({ ...base, closeness: 0, finale: true, stardust: 12 })).toBe(32);
    expect(catchPoints({ ...base, firstTry: false, closeness: 1 })).toBe(5);
  });

  it('rates the round by first-try catches', () => {
    expect(roundStars(13, 13)).toBe(3);
    expect(roundStars(11, 13)).toBe(3);
    expect(roundStars(10, 13)).toBe(2);
    expect(roundStars(7, 13)).toBe(2);
    expect(roundStars(6, 13)).toBe(1);
    expect(roundStars(0, 11)).toBe(1);
  });
});

describe('pace and stardust', () => {
  it('falls in 20, 12 or 7 seconds, and slower for sums', () => {
    expect(fallSeconds('off', false)).toBe(0);
    expect([fallSeconds('relaxed', false), fallSeconds('normal', false)]).toEqual([20, 12]);
    expect(fallSeconds('fast', false)).toBe(7);
    expect([fallSeconds('relaxed', true), fallSeconds('normal', true)]).toEqual([30, 20]);
    expect(fallSeconds('fast', true)).toBe(12);
    expect(parseStarPace('normal')).toBe('normal');
    expect(parseStarPace('warp')).toBe('off');
    expect(parseStarPace(null)).toBe('off');
  });

  it('drains stardust from 15 to nothing as the star falls', () => {
    expect(stardust(0)).toBe(15);
    expect(stardust(0.5)).toBe(8);
    expect(stardust(1)).toBe(0);
    expect(stardust(1.4)).toBe(0);
  });
});

describe('screen-reader whereabouts', () => {
  it('names the nearest post only where the posts are numbered close together', () => {
    expect(whereabouts(lineFor(stage(5)), 0.63)).toEqual({ kind: 'about', value: 60 });
    expect(whereabouts(lineFor(stage(1)), 0.71)).toEqual({ kind: 'about', value: 7 });
  });

  it('gives only a coarse zone where the posts have faded', () => {
    const line = lineFor(stage(7));
    expect(whereabouts(line, 0.63)).toEqual({ kind: 'zone', zone: 'pastHalf' });
    expect(whereabouts(line, 0.5)).toEqual({ kind: 'zone', zone: 'half' });
    expect(whereabouts(line, 0.1)).toEqual({ kind: 'zone', zone: 'nearStart' });
    expect(whereabouts(line, 1)).toEqual({ kind: 'zone', zone: 'end' });
    expect(whereabouts(lineFor(stage(12), seeded(3)), 0.4).kind).toBe('zone');
  });
});

describe('help after a miss', () => {
  it('asks landmark questions by level and try, never by the answer', () => {
    const line = lineFor(stage(6));
    expect(landmarkHint(stage(6), line, 2)).toBe('hintMiddleQuestion');
    expect(landmarkHint(stage(6), line, 3)).toBe('hintFindMiddle');
    expect(landmarkHint(stage(6), line, 4)).toBe('hintNearTen');
    expect(landmarkHint(stage(11), lineFor(stage(11)), 3)).toBe('hintNearHundred');
    expect(landmarkHint(stage(12), lineFor(stage(12), seeded(1)), 2)).toBe('hintCountSteps');
    expect(landmarkHint(stage(9), lineFor(stage(9)), 2)).toBe('hintWorkOut');
  });
});

describe('constellations', () => {
  it('has a picture of 11 to 13 points for every level', () => {
    for (const shape of CONSTELLATIONS) {
      expect(shape.points.length).toBeGreaterThanOrEqual(11);
      expect(shape.points.length).toBeLessThanOrEqual(13);
      for (const [x, y] of shape.points) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(1);
      }
    }
  });

  it('joins each lit star to the one before, and closes the picture when complete', () => {
    const heart = constellation('heart');
    expect(constellationEdges(heart, 0, false)).toEqual([]);
    expect(constellationEdges(heart, 3, false)).toEqual([
      [0, 1],
      [1, 2],
    ]);
    const done = constellationEdges(heart, 5, true);
    expect(done).toHaveLength(heart.points.length);
    expect(done.at(-1)).toEqual([heart.points.length - 1, 0]);
  });
});

describe('star records', () => {
  it('keeps valid best scores and constellations and drops the rest', () => {
    expect(
      parseStarRecords({
        version: 1,
        best: { 'star-catcher-3': 140, 'star-catcher-4': -2, 'potion-1': 50, x: 'a' },
        constellations: ['cat', 'unicorn', 'spaceship', 3],
      }),
    ).toEqual({ best: { 'star-catcher-3': 140 }, constellations: ['cat', 'unicorn'] });
    expect(parseStarRecords(null)).toEqual({ best: {}, constellations: [] });
    expect(parseStarRecords({ version: 2, best: {} })).toEqual({ best: {}, constellations: [] });
  });

  it('places a number on the bridge as a share of it', () => {
    expect(share(lineFor(stage(5)), 25)).toBe(0.25);
    expect(share(lineFor(stage(11)), 250)).toBe(0.25);
  });
});
