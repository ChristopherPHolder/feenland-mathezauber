import { describe, expect, it } from 'vitest';
import {
  blockReason,
  createPotion,
  createRound,
  hourglassSeconds,
  isMastered,
  localOps,
  mix,
  potionCoins,
  potionLevels,
  potionStage,
  potionStages,
  potionStars,
  ROUND_LENGTH,
  roundStars,
  solve,
} from './potion-puzzles';

/** A small, repeatable random source, so failures can be replayed. */
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

describe('potion puzzles', () => {
  it('mixes whole numbers and never empties or overfills a bottle', () => {
    expect(mix(7, '+', 5, 20)).toBe(12);
    expect(mix(7, '−', 5, 20)).toBe(2);
    expect(mix(5, '−', 5, 20)).toBeNull();
    expect(mix(3, '−', 5, 20)).toBeNull();
    expect(mix(6, '×', 4, 20)).toBeNull();
    expect(mix(6, '×', 4, 100)).toBe(24);
    expect(mix(12, '÷', 3, 100)).toBe(4);
    expect(mix(13, '÷', 3, 100)).toBeNull();
    expect(blockReason(3, '−', 5, 20)).toBe('notEnough');
    expect(blockReason(13, '÷', 3, 100)).toBe('cannotShare');
    expect(blockReason(15, '+', 9, 20)).toBe('tooMuch');
    expect(blockReason(15, '+', 2, 20)).toBeNull();
  });

  it('finds a recipe that uses every bottle, or proves there is none', () => {
    const recipe = solve([8, 5, 3], 10, ['+', '−'], 20)!;
    expect(recipe).toHaveLength(2);
    expect(recipe.at(-1)!.result).toBe(10);
    expect(solve([8, 5, 3], 16, ['+', '−'], 20)).not.toBeNull();
    expect(solve([2, 2], 5, ['+', '−', '×'], 100)).toBeNull();
    expect(solve([8, 2, 3], 13, ['+', '−', '×', '÷'], 100)).not.toBeNull();
  });

  it('builds rounds of brewable potions that need the level’s spells', () => {
    for (const stage of potionStages) {
      const random = seeded(stage.stage * 7919);
      for (let round = 0; round < 15; round++) {
        const potions = createRound(stage, random);
        expect(potions).toHaveLength(ROUND_LENGTH);
        expect(new Set(potions.map((potion) => potion.target)).size).toBe(ROUND_LENGTH);
        potions.forEach((potion, index) => {
          const big = index === ROUND_LENGTH - 1;
          const [low, high] = (big && stage.bigTargets) || stage.targets;
          expect(potion.values).toHaveLength(big ? stage.bigBottles : stage.bottles);
          expect(potion.target).toBeGreaterThanOrEqual(low);
          expect(potion.target).toBeLessThanOrEqual(high);
          expect(potion.values).not.toContain(potion.target);
          expect(solve(potion.values, potion.target, potion.ops, potion.max)).not.toBeNull();
          if (stage.needs) {
            const without = stage.ops.filter((op) => !stage.needs!.includes(op));
            expect(solve(potion.values, potion.target, without, potion.max)).toBeNull();
          }
        });
      }
    }
  });

  it('keeps friends of ten in the tens level', () => {
    const stage = potionStage('potion-3')!;
    const random = seeded(42);
    for (let index = 0; index < 40; index++) {
      const potion = createPotion(stage, {}, random);
      expect(potion.target % 10).toBe(0);
      const ones = potion.values.filter((value) => value < 10);
      expect(ones.some((a, i) => ones.some((b, j) => i !== j && a + b === 10))).toBe(true);
    }
  });

  it('pays stars and coins for careful brewing', () => {
    expect([0, 1, 2, 5].map(potionStars)).toEqual([3, 2, 1, 1]);
    expect(roundStars([3, 3, 3, 3, 3, 2])).toBe(3);
    expect(roundStars([2, 2, 2, 2, 2, 2])).toBe(2);
    expect(roundStars([1, 1, 2, 2, 1, 1])).toBe(1);
    expect(isMastered([2, 2, 2, 2, 2, 2])).toBe(true);
    expect(potionCoins({ stars: 3, moon: false, sparkle: false, streak: 1, big: false })).toBe(30);
    expect(potionCoins({ stars: 3, moon: true, sparkle: true, streak: 3, big: true })).toBe(145);
    expect(hourglassSeconds('off', 3)).toBe(0);
    expect(hourglassSeconds('fast', 3)).toBe(21);
  });

  it('lists seven levels with stable ids and local division signs', () => {
    expect(potionLevels.map((level) => level.id)).toEqual([
      'potion-1',
      'potion-2',
      'potion-3',
      'potion-4',
      'potion-5',
      'potion-6',
      'potion-7',
    ]);
    expect(potionStage('potion-8')).toBeUndefined();
    expect(potionStage('treasure-lock-1')).toBeUndefined();
    expect(localOps('12 ÷ 3 + 2 → 6', ':')).toBe('12 : 3 + 2 → 6');
  });
});
