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
  lockPosition,
  lockStage,
  lockStages,
  lockStars,
  parseLockPace,
  ROUND_LENGTH,
  roundStars,
  Spell,
  unsplittable,
} from './lock-puzzles';

const half: Spell = { op: '÷', n: 2 };

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

  it('halves even numbers only', () => {
    expect(cast(40, half, 50)).toBe(20);
    expect(cast(10, half, 50)).toBe(5);
    expect(cast(5, half, 50)).toBeNull();
    expect(cast(39, half, 50)).toBeNull();
    expect(unsplittable(7, half)).toBe(true);
    expect(unsplittable(8, half)).toBe(false);
    expect(unsplittable(7, { op: '+', n: 2 })).toBe(false);
  });

  it('never lets the solver halve an odd number', () => {
    // From 40 halving alone reaches 20, 10 and 5, and stops there: 5 is odd.
    const distance = hopDistances(40, 50, [half]);
    expect(distance[20]).toBe(1);
    expect(distance[10]).toBe(2);
    expect(distance[5]).toBe(3);
    expect(distance.filter((hops) => hops >= 0)).toHaveLength(4);
    expect(hopDistances(7, 50, [half]).filter((hops) => hops >= 0)).toHaveLength(1);
    for (const stage of lockStages.filter((s) => s.spells.some((spell) => spell.op === '÷')))
      for (let seed = 1; seed <= 60; seed++)
        for (const lock of createRound(stage, seeded(seed * 31 + stage.stage))) {
          let value = lock.start;
          for (const step of bestPath(lock, seeded(seed))) {
            const ways = lock.spells.filter((spell) => cast(value, spell, lock.max) === step);
            expect(ways.length).toBeGreaterThan(0);
            for (const spell of ways) if (spell.op === '÷') expect(value % 2).toBe(0);
            value = step;
          }
        }
  });

  it('keeps halving levels to locks where ÷2 is part of the best way', () => {
    for (const id of ['treasure-lock-8', 'treasure-lock-9']) {
      const stage = lockStage(id)!;
      const without = stage.spells.filter((spell) => spell.op !== '÷');
      for (let seed = 1; seed <= 40; seed++)
        for (const lock of createRound(stage, seeded(seed))) {
          const slower = hopDistances(lock.start, lock.max, without)[lock.target];
          expect(slower === -1 || slower > lock.par, `${id} → ${lock.target}`).toBe(true);
        }
    }
  });

  it('shows a worked example on every level that is a best way to its number', () => {
    for (const stage of lockStages) {
      const [hops, target] = stage.example.split(' → ');
      const words = hops.split(' ');
      let value = /^\d+$/.test(words[0]) ? Number(words.shift()) : stage.start;
      expect(value, stage.example).toBe(stage.start);
      for (const word of words) {
        const spell = stage.spells.find((candidate) => `${candidate.op}${candidate.n}` === word);
        expect(spell, `${stage.example}: ${word}`).toBeDefined();
        value = cast(value, spell!, stage.max)!;
      }
      expect(value, stage.example).toBe(Number(target));
      expect(hopDistances(stage.start, stage.max, stage.spells)[value], stage.example).toBe(
        words.length,
      );
    }
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
    expect(lockStage('treasure-lock-9')?.trick).toBe('doubleHalve');
    expect(lockStage('treasure-lock-10')).toBeUndefined();
    expect(lockStage('treasure-lock-')).toBeUndefined();
  });

  it('slots new levels in by difficulty without renumbering their ids', () => {
    expect(lockStages.map((stage) => stage.stage)).toEqual([1, 2, 3, 4, 5, 6, 8, 7, 9]);
    expect(lockPosition(lockStage('treasure-lock-8')!)).toBe(7);
    expect(lockPosition(lockStage('treasure-lock-7')!)).toBe(8);
    expect(lockPosition(lockStage('treasure-lock-9')!)).toBe(9);
    expect(new Set(lockStages.map((stage) => stage.stage)).size).toBe(lockStages.length);
  });
});
