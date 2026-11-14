import { describe, expect, it } from 'vitest';
import {
  bestPath,
  cast,
  chestCoins,
  createRound,
  hopDistances,
  hourglassSeconds,
  isMastered,
  lockLevels,
  lockStage,
  lockStages,
  lockStars,
  parseLockPace,
  ROUND_LENGTH,
  roundStars,
} from './lock-puzzles';

function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

describe('treasure lock puzzles', () => {
  it('casts hops and refuses to leave the dial', () => {
    expect(cast(5, { op: '+', n: 10 }, 20)).toBe(15);
    expect(cast(15, { op: '+', n: 10 }, 20)).toBeNull();
    expect(cast(0, { op: '−', n: 1 }, 20)).toBeNull();
    expect(cast(6, { op: '×', n: 2 }, 20)).toBe(12);
  });

  it('finds the fewest hops, so the nine trick beats counting', () => {
    const spells = lockStage('treasure-lock-4')!.spells;
    const distance = hopDistances(0, 50, spells);
    expect(distance[19]).toBe(3);
    expect(distance[29]).toBe(4);
    expect(distance[34]).toBe(7);
    // A thorn on 10 forces a longer way to 19.
    expect(hopDistances(0, 50, spells, [10])[19]).toBeGreaterThan(3);
  });

  it('builds solvable rounds at the right size for every level', () => {
    for (const stage of lockStages)
      for (let seed = 1; seed <= 120; seed++) {
        const round = createRound(stage, seeded(seed * 7919 + stage.stage));
        expect(round).toHaveLength(ROUND_LENGTH);
        expect(new Set(round.map((lock) => lock.target)).size).toBe(ROUND_LENGTH);
        for (const lock of round) {
          expect(lock.par).toBeGreaterThanOrEqual(stage.par[0]);
          expect(lock.par).toBeLessThanOrEqual(stage.par[1]);
          expect(hopDistances(lock.start, lock.max, lock.spells, lock.thorns)[lock.target]).toBe(
            lock.par,
          );
          expect(lock.thorns).not.toContain(lock.target);
          expect(lock.thorns).not.toContain(lock.start);
          expect(stage.fits?.(lock.target) ?? true).toBe(true);
          if (lock.gem !== null) {
            expect(lock.thorns).not.toContain(lock.gem);
            expect(lock.gem).not.toBe(lock.target);
          }
        }
        // The big chest is never easier than the locks before it.
        const last = round.at(-1)!;
        expect(Math.max(...round.map((lock) => lock.par))).toBe(last.par);
      }
  });

  it('walks a best path that ends on the lock and avoids thorns', () => {
    const stage = lockStage('treasure-lock-7')!;
    for (let seed = 1; seed <= 40; seed++) {
      const lock = createRound(stage, seeded(seed))[0];
      const path = bestPath(lock, seeded(seed + 1));
      expect(path).toHaveLength(lock.par);
      expect(path.at(-1)).toBe(lock.target);
      let value = lock.start;
      for (const step of path) {
        expect(lock.spells.some((spell) => cast(value, spell, lock.max) === step)).toBe(true);
        expect(lock.thorns).not.toContain(step);
        value = step;
      }
    }
  });

  it('rates locks and rounds generously', () => {
    expect(lockStars(4, 4)).toBe(3);
    expect(lockStars(6, 4)).toBe(2);
    expect(lockStars(7, 4)).toBe(1);
    expect(roundStars([3, 3, 3, 3, 3, 3])).toBe(3);
    expect(roundStars([3, 3, 3, 3, 3, 2])).toBe(3);
    expect(roundStars([2, 2, 2, 2, 2, 2])).toBe(2);
    expect(roundStars([1, 1, 1, 2, 2, 2])).toBe(1);
    expect(isMastered([2, 2, 2, 2, 2, 2])).toBe(true);
  });

  it('pays coins for keys, gems, crystals, the big chest and the fever', () => {
    const plain = { stars: 3, gem: false, crystal: false, streak: 1, big: false };
    expect(chestCoins(plain)).toBe(30);
    expect(chestCoins({ ...plain, gem: true, crystal: true })).toBe(55);
    expect(chestCoins({ ...plain, streak: 3 })).toBe(60);
    expect(chestCoins({ ...plain, big: true, stars: 1 })).toBe(20);
  });

  it('runs the hourglass longer for longer locks and not at all when off', () => {
    expect(hourglassSeconds('off', 5)).toBe(0);
    expect(hourglassSeconds('normal', 4)).toBe(30);
    expect(hourglassSeconds('fast', 4)).toBeLessThan(hourglassSeconds('relaxed', 4));
    expect(parseLockPace('nope')).toBe('off');
  });

  it('lists one catalog level per stage', () => {
    expect(lockLevels.map((level) => level.id)).toEqual(
      lockStages.map((stage) => `treasure-lock-${stage.stage}`),
    );
    expect(lockStage('treasure-lock-9')).toBeUndefined();
  });
});
