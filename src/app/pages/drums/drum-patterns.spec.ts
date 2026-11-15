import { describe, expect, it } from 'vitest';
import {
  buildRound,
  choicesFor,
  drumStage,
  drumStages,
  drumStars,
  greyedOut,
  Mushroom,
  ruleFor,
  ruleRun,
  seeded,
  traps,
  verseQuestions,
} from './drum-patterns';

const mushroom = (value: number, seed = 7): Mushroom => ({
  value,
  given: false,
  fresh: false,
  step: 0,
  verse: 0,
  seed,
});

describe('mushroom drums patterns', () => {
  it('builds every level from many seeds, inside its range and with steady steps', () => {
    for (const stage of drumStages) {
      for (let seed = 1; seed <= 40; seed++) {
        const round = buildRound(stage, seeded(seed * 97 + stage.stage));
        expect(round[0].given).toBe(true);
        for (const [index, item] of round.entries()) {
          expect(item.value).toBeGreaterThanOrEqual(stage.min);
          expect(item.value).toBeLessThanOrEqual(stage.max);
          if (!item.fresh) expect(item.value - round[index - 1].value).toBe(item.step);
          // Every run opens on a mushroom the band plays.
          if (item.fresh) expect(item.given).toBe(true);
        }
        expect(new Set(round.map((item) => item.verse))).toEqual(new Set([0, 1, 2, 3]));
        const questions = verseQuestions(round);
        expect(questions).toBeGreaterThanOrEqual(20);
        expect(questions).toBeLessThanOrEqual(30);
      }
    }
  });

  it('starts level 4 off the tens and keeps the ones digit', () => {
    const round = buildRound(drumStage('drums-4')!, seeded(3));
    const first = round.filter((item) => item.verse === 0);
    expect(first[0].value % 10).not.toBe(0);
    expect(new Set(first.map((item) => item.value % 10)).size).toBe(1);
  });

  it('sends level 12 past 100 in tens or fives', () => {
    for (let seed = 1; seed < 20; seed++) {
      const round = buildRound(drumStage('drums-12')!, seeded(seed));
      expect(round.some((item) => item.verse === 0 && item.value > 100)).toBe(true);
    }
  });

  it('asks for the number before in every fourth call', () => {
    const round = buildRound(drumStage('drums-2')!, seeded(5));
    const calls = round.filter((item) => item.verse === 2 && !item.given);
    expect(calls).toHaveLength(8);
    expect(calls.map((item) => !!item.before)).toEqual([
      false,
      false,
      false,
      true,
      false,
      false,
      false,
      true,
    ]);
  });

  it('offers the answer with the traps children fall into', () => {
    expect(traps(37, 47, 'en').slice(0, 2)).toEqual([38, 57]);
    expect(traps(28, 30, 'en')[0]).toBe(20);
    expect(traps(31, 29, 'en')[0]).toBe(39);
    expect(traps(17, 27, 'de')[0]).toBe(72);
    expect(traps(67, 77, 'fr')[0]).toBe(67);
    const choices = choicesFor(mushroom(47), 37, 4, 'de');
    expect(choices).toContain(47);
    expect(choices).toContain(74);
    expect(new Set(choices).size).toBe(4);
  });

  it('keeps every button positive and different, in a stable order', () => {
    for (const [previous, value] of [
      [0, 10],
      [1, 0],
      [3, 1],
      [10, 0],
      [100, 110],
    ]) {
      const choices = choicesFor(mushroom(value), previous, 4, 'en');
      expect(choices.every((choice) => choice >= 0)).toBe(true);
      expect(new Set(choices).size).toBe(4);
      expect(choicesFor(mushroom(value), previous, 4, 'en')).toEqual(choices);
    }
  });

  it('picks a rule card for the ten crossing first, told with other numbers', () => {
    expect(ruleFor(28, 30)).toBe('newTen');
    expect(ruleFor(30, 29)).toBe('backTen');
    expect(ruleFor(95, 100)).toBe('hundred');
    expect(ruleFor(37, 47)).toBe('tens');
    expect(ruleFor(23, 25)).toBe('odd');
    expect(ruleRun('tens', 4, 14)).not.toContain(14);
    expect(ruleRun('newTen', 28, 30)).not.toContain(30);
    expect(ruleRun('tens', 14, 24)).not.toContain(24);
  });

  it('greys out one wrong button per miss after the second, always leaving two', () => {
    const choices = [10, 20, 30, 40];
    expect(greyedOut(choices, 30, 2, 1)).toEqual([]);
    expect(greyedOut(choices, 30, 3, 1)).toHaveLength(1);
    expect(greyedOut(choices, 30, 9, 1)).toHaveLength(2);
    expect(greyedOut(choices, 30, 9, 1)).not.toContain(30);
  });

  it('gives three stars for 32 of 36 first tries, two for 24', () => {
    expect(drumStars(32, 36)).toBe(3);
    expect(drumStars(31, 36)).toBe(2);
    expect(drumStars(24, 36)).toBe(2);
    expect(drumStars(23, 36)).toBe(1);
    expect(drumStars(27, 30)).toBe(3);
  });
});
