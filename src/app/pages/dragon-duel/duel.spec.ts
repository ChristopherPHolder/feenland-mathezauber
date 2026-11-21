import { describe, expect, it } from 'vite-plus/test';
import {
  answer,
  charge,
  chargeSeconds,
  damageFor,
  Duel,
  duelLevels,
  duelSprite,
  duelStars,
  HEARTS,
  parseDuelPace,
  SPRITES,
  startDuel,
  WRONG_CHARGE,
} from './duel';
import { duelQuestion, DuelSkill, shownSum } from './duel-questions';

const seeded =
  (seed = 7) =>
  () =>
    ((seed = (seed * 48271) % 2147483647) % 1000) / 1000;
const wrong = (duel: Duel, nth = 0) =>
  duel.question.choices.filter((value) => value !== duel.question.answer)[nth];
const pebble = SPRITES[0];

/** Works out a sum's real value from its text, to check every generated question. */
function solve(text: string): number {
  const [left, right] = text.split(' = ');
  const value = (expression: string) => {
    const [a, op, b] = expression.split(' ');
    if (op === '+') return Number(a) + Number(b);
    if (op === '−') return Number(a) - Number(b);
    return Number(a) * Number(b);
  };
  if (!right) return value(left);
  const [a, op, b] = left.split(' ');
  const total = Number(right);
  if (a === '?') return op === '+' ? total - Number(b) : total + Number(b);
  return op === '+' ? total - Number(a) : Number(a) - total;
}

describe('duel questions', () => {
  const ranges: Record<DuelSkill, [number, number]> = {
    add10: [2, 10],
    take10: [1, 9],
    plusMinus20: [1, 20],
    doubles: [4, 21],
    tens100: [10, 100],
    times: [1, 100],
    missing: [1, 19],
    mixed: [1, 100],
  };
  for (const [skill, [min, max]] of Object.entries(ranges) as [DuelSkill, [number, number]][]) {
    it(`asks right ${skill} sums with four different choices`, () => {
      const random = seeded(skill.length * 13);
      for (let i = 0; i < 300; i++) {
        const q = duelQuestion(skill, random);
        expect(solve(q.text)).toBe(q.answer);
        expect(q.answer).toBeGreaterThanOrEqual(min);
        expect(q.answer).toBeLessThanOrEqual(max);
        expect(q.choices).toHaveLength(4);
        expect(new Set(q.choices).size).toBe(4);
        expect(q.choices.filter((choice) => choice === q.answer)).toHaveLength(1);
        expect(q.choices.every((choice) => choice >= 0)).toBe(true);
      }
    });
  }

  it('times tables stay in the 2, 5 and 10 rows', () => {
    const random = seeded(3);
    for (let i = 0; i < 200; i++) {
      const [a, , b] = duelQuestion('times', random).text.split(' ').map(Number);
      expect([2, 5, 10].includes(a) || [2, 5, 10].includes(b)).toBe(true);
    }
  });

  it('never asks the same sum twice in a row', () => {
    const random = seeded(11);
    let previous = duelQuestion('add10', random);
    for (let i = 0; i < 200; i++) {
      const next = duelQuestion('add10', random, previous.text);
      expect(next.text).not.toBe(previous.text);
      previous = next;
    }
  });

  it('adds the question mark only where nothing is hidden', () => {
    expect(shownSum('3 + 4')).toBe('3 + 4 = ?');
    expect(shownSum('7 + ? = 12')).toBe('7 + ? = 12');
  });
});

describe('dragon duels', () => {
  it('lines up eight sprites that get tougher and finish with a boss', () => {
    expect(SPRITES.map((sprite) => sprite.stage)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    for (let i = 1; i < SPRITES.length; i++)
      expect(SPRITES[i].energy).toBeGreaterThanOrEqual(SPRITES[i - 1].energy);
    expect(SPRITES.at(-1)!.boss).toBe(true);
    expect(duelSprite('dragon-duel-3')!.id).toBe('bramble');
    expect(duelSprite('dragon-duel-9')).toBeUndefined();
    expect(duelLevels.map((level) => level.id)).toContain('dragon-duel-8');
    expect(duelLevels.every((level) => level.group)).toBe(true);
  });

  it('gives every element a sprite with that weak spot', () => {
    const weak = new Set(SPRITES.map((sprite) => sprite.weakTo));
    expect([...weak].sort()).toEqual(['cloud', 'fire', 'leaf', 'rainbow', 'star', 'water']);
  });

  it('hits for two on a first try, one after a miss, more when quick or on the weak spot', () => {
    expect(damageFor(true, false, false)).toEqual({ damage: 2, critical: false, weakSpot: false });
    expect(damageFor(true, true, false)).toEqual({ damage: 3, critical: true, weakSpot: false });
    expect(damageFor(true, false, true).damage).toBe(3);
    expect(damageFor(true, true, true).damage).toBe(4);
    expect(damageFor(false, true, false)).toEqual({ damage: 1, critical: false, weakSpot: false });
    expect(damageFor(false, false, true).damage).toBe(2);
  });

  it('knocks the sprite out with right answers and asks a fresh sum each time', () => {
    const random = seeded();
    let duel = startDuel(pebble, 'fire', random);
    let turns = 0;
    while (duel.phase === 'fighting') {
      const before = duel;
      duel = answer(duel, duel.question.answer, 20, 'off', random);
      expect(duel.energy).toBe(Math.max(0, before.energy - 2));
      expect(duel.hits).toBe(before.hits + 1);
      if (duel.phase === 'fighting') expect(duel.question.text).not.toBe(before.question.text);
      turns++;
    }
    expect(duel.phase).toBe('won');
    expect(turns).toBe(pebble.energy / 2);
    expect(duelStars(duel)).toBe(3);
  });

  it('counts a quick first try as a critical hit and a weak spot as extra', () => {
    let duel = startDuel(pebble, 'water', seeded());
    duel = answer(duel, duel.question.answer, 2, 'normal');
    expect(duel.lastHit).toEqual({ damage: 4, critical: true, weakSpot: true });
    expect(duel.criticals).toBe(1);
    // Harder sprites give more time for a critical.
    let moth = startDuel(SPRITES[5], 'fire', seeded());
    moth = answer(moth, moth.question.answer, 8, 'normal');
    expect(moth.lastHit!.critical).toBe(true);
  });

  it('strikes a wrong choice out and keeps the sum; the sprite giggles', () => {
    const duel = startDuel(pebble, 'fire', seeded());
    const missed = answer(duel, wrong(duel), 1, 'off');
    expect(missed.question).toBe(duel.question);
    expect(missed.struck).toEqual([wrong(duel)]);
    expect(missed.giggles).toBe(1);
    expect(missed.mistakes).toBe(1);
    expect(missed.charge).toBe(0);
    expect(answer(missed, wrong(duel), 1, 'off')).toBe(missed);
    const again = answer(missed, wrong(duel, 1), 1, 'off');
    expect(again.mistakes).toBe(1);
    const right = answer(again, duel.question.answer, 1, 'off');
    expect(right.lastHit).toEqual({ damage: 1, critical: false, weakSpot: false });
  });

  it('charges while the child thinks and zaps a heart at full charge', () => {
    let duel = startDuel(pebble, 'fire', seeded());
    const full = chargeSeconds('normal', pebble)!;
    duel = charge(duel, full / 2, 'normal');
    expect(duel.charge).toBeCloseTo(0.5);
    duel = charge(duel, full / 2, 'normal');
    expect(duel.hearts).toBe(HEARTS - 1);
    expect(duel.zaps).toBe(1);
    expect(duel.charge).toBe(0);
    expect(charge(duel, 100, 'off')).toBe(duel);
  });

  it('feeds the charge on a wrong answer only when the sprite charges', () => {
    const duel = startDuel(pebble, 'fire', seeded());
    expect(answer(duel, wrong(duel), 1, 'fast').charge).toBeCloseTo(WRONG_CHARGE);
    let zapped = duel;
    for (let i = 0; i < 3; i++) zapped = answer(zapped, wrong(zapped, i), 1, 'fast');
    expect(zapped.zaps).toBe(1);
    expect(zapped.hearts).toBe(HEARTS - 1);
  });

  it('sends the dragon for a nap after three zaps', () => {
    let duel = startDuel(pebble, 'fire', seeded());
    for (let i = 0; i < 3; i++) duel = charge(duel, 100, 'fast');
    expect(duel.phase).toBe('napping');
    expect(duel.hearts).toBe(0);
    expect(answer(duel, duel.question.answer, 1, 'fast')).toBe(duel);
    expect(duelStars(duel)).toBe(0);
  });

  it('gives fewer stars for lost hearts and slips', () => {
    const won = (hearts: number, mistakes: number) =>
      duelStars({ ...startDuel(pebble, 'fire', seeded()), phase: 'won', hearts, mistakes });
    expect(won(3, 0)).toBe(3);
    expect(won(3, 1)).toBe(3);
    expect(won(3, 2)).toBe(2);
    expect(won(2, 3)).toBe(2);
    expect(won(1, 0)).toBe(1);
    expect(won(3, 6)).toBe(1);
  });

  it('stretches the charge for harder sprites and reads saved paces safely', () => {
    expect(chargeSeconds('off', pebble)).toBeNull();
    expect(chargeSeconds('normal', SPRITES[5])!).toBeGreaterThan(chargeSeconds('normal', pebble)!);
    expect(chargeSeconds('fast', pebble)!).toBeLessThan(chargeSeconds('relaxed', pebble)!);
    expect(parseDuelPace('fast')).toBe('fast');
    expect(parseDuelPace('turbo')).toBe('off');
    expect(parseDuelPace(null)).toBe('off');
  });
});
