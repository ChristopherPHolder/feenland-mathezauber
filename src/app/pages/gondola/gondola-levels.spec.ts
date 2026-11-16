import { describe, expect, it } from 'vite-plus/test';
import { GondolaFrame, layoutTotal, sceneLayout } from './gondola-frame';
import {
  answerChoices,
  canExpress,
  canSwap,
  canTakeTen,
  checkSplit,
  classifyAnswer,
  cloudSeconds,
  createRound,
  crosses,
  expressMove,
  GondolaItem,
  gondolaLevels,
  gondolaStage,
  gondolaStages,
  isMastered,
  Move,
  roundStars,
  ruleCard,
  seeded,
  shapeOf,
  swapped,
  turnPoints,
} from './gondola-levels';
import { parseGondolaSave } from './gondola-scores';

const stage = (n: number) => gondolaStage(`gondola-${n}`)!;
const add = (a: number, b: number): GondolaItem => ({ kind: 'add', a, b });
const sub = (a: number, b: number): GondolaItem => ({ kind: 'sub', a, b });
const rounds = (n: number, count = 40) =>
  Array.from({ length: count }, (_, seed) => createRound(stage(n), seeded(seed + 1)));

function frameFor(item: GondolaItem, move: Move | null, phase: GondolaFrame['phase']) {
  const shape = shapeOf(item);
  const express = expressMove(item);
  return {
    turn: 0,
    kind: item.kind,
    tens: shape.tens,
    cabin: shape.cabin,
    groupTens: shape.groupTens,
    group: shape.group,
    split: 0,
    phase,
    move,
    expressCabins: express.cabins,
    fix: express.fix,
    representation: 'bunnies',
    tarp: false,
    golden: false,
    vip: false,
    big: false,
    cloud: 0,
    cocoa: 'none',
    lanterns: 0,
    village: 0,
    help: 'none',
    hops: 0,
    bounces: 0,
    jams: 0,
    cheers: 0,
    slips: 0,
    colds: 0,
  } satisfies GondolaFrame;
}

describe('gondola levels', () => {
  it('has twelve levels with stable ids in five topics', () => {
    expect(gondolaLevels.map((level) => level.id)).toEqual(
      Array.from({ length: 12 }, (_, index) => `gondola-${index + 1}`),
    );
    expect(new Set(gondolaLevels.map((level) => level.group)).size).toBe(4);
    expect(gondolaStage('gondola-13')).toBeUndefined();
    expect(gondolaStage('potion-1')).toBeUndefined();
  });

  it('makes every item cross a ten, with no repeats and the big cabin last', () => {
    for (const level of gondolaStages) {
      for (const round of rounds(level.stage, 25)) {
        expect(round.length).toBe(level.turns);
        expect(round.every(crosses)).toBe(true);
        const keys = round.map((item) => `${item.kind}${item.a},${item.b}`);
        expect(new Set(keys).size).toBe(keys.length);
        const big = round.at(-1)!;
        expect(level.bigPool().some((item) => item.kind === big.kind && item.a === big.a && item.b === big.b)).toBe(true);
      }
    }
  });

  it('starts from 9, then 8, then 7 and 6, and mixes the order on level 4', () => {
    for (const round of rounds(1)) expect(round.slice(0, -1).every((item) => item.a === 9)).toBe(true);
    for (const round of rounds(2)) expect(round.slice(0, -1).every((item) => item.a === 8)).toBe(true);
    for (const round of rounds(3))
      expect(round.slice(0, -1).every((item) => item.a === 7 || item.a === 6)).toBe(true);
    const level4 = rounds(4).flat();
    expect(level4.some((item) => item.a < item.b)).toBe(true);
    expect(level4.some((item) => item.a > item.b)).toBe(true);
    expect(level4.every((item) => item.a + item.b <= 20)).toBe(true);
  });

  it('keeps the bigger mountains in their ranges', () => {
    for (const item of rounds(5).flat()) expect(item).toMatchObject({ kind: 'sub' });
    for (const item of rounds(6).flat().slice(0, -1)) expect([7, 8, 9]).toContain(item.b);
    for (const item of rounds(7).flat()) expect(item.a >= 10 && item.b < 10 && item.kind === 'add').toBe(true);
    for (const item of rounds(8).flat()) expect(item.a >= 20 && item.b < 10 && item.kind === 'sub').toBe(true);
    for (const item of rounds(9).flat()) expect(item.b >= 12 && item.a + item.b <= 99).toBe(true);
    for (const item of rounds(10).flat()) expect([8, 9, 19]).toContain(item.b);
    for (const item of rounds(11).flat()) expect([9, 19, 29]).toContain(item.b);
    const master = rounds(12).flat();
    expect(master.some((item) => item.kind === 'sub')).toBe(true);
    expect(master.some((item) => item.a < 10)).toBe(true);
    expect(master.some((item) => item.b >= 12)).toBe(true);
    for (const round of rounds(12)) expect(round.at(-1)!.b).toBeGreaterThanOrEqual(12);
  });
});

describe('splitting the group', () => {
  it('accepts only the split that fills the cabin, and says which way a wrong one is off', () => {
    const shape = shapeOf(add(8, 5));
    expect(shape.fill).toBe(2);
    expect(checkSplit(shape, 2)).toBe('fill');
    expect(checkSplit(shape, 3)).toBe('tooMany');
    expect(checkSplit(shape, 1)).toBe('tooFew');
  });

  it('accepts a fill-to-ten split for either group', () => {
    expect(checkSplit(shapeOf(add(5, 8)), 5)).toBe('fill');
    expect(checkSplit(shapeOf(swapped(add(5, 8))), 2)).toBe('fill');
    expect(canSwap(stage(4), add(5, 8))).toBe(true);
    expect(canSwap(stage(3), add(7, 6))).toBe(false);
    expect(canSwap(stage(12), add(47, 6))).toBe(false);
  });

  it('goes down to ten first when taking away', () => {
    const shape = shapeOf(sub(13, 5));
    expect(shape.fill).toBe(3);
    expect(checkSplit(shape, 3)).toBe('fill');
    expect(checkSplit(shape, 4)).toBe('tooMany');
    expect(checkSplit(shape, 2)).toBe('tooFew');
  });

  it('offers taking from the ten from level 6, and the express on levels 10 to 12', () => {
    expect(canTakeTen(stage(5), sub(13, 5))).toBe(false);
    expect(canTakeTen(stage(6), sub(13, 9))).toBe(true);
    expect(canTakeTen(stage(8), sub(43, 6))).toBe(true);
    expect(canTakeTen(stage(7), add(47, 6))).toBe(false);
    expect(canExpress(stage(9), add(38, 29))).toBe(false);
    expect(canExpress(stage(10), add(34, 9))).toBe(true);
    expect(canExpress(stage(10), add(56, 8))).toBe(true);
    expect(canExpress(stage(11), sub(63, 9))).toBe(true);
    expect(canExpress(stage(12), add(38, 25))).toBe(false);
    expect(expressMove(add(34, 9))).toEqual({ cabins: 1, fix: -1 });
    expect(expressMove(add(56, 8))).toEqual({ cabins: 1, fix: -2 });
    expect(expressMove(add(46, 19))).toEqual({ cabins: 2, fix: -1 });
    expect(expressMove(sub(63, 9))).toEqual({ cabins: 1, fix: 1 });
    expect(expressMove(sub(63, 19))).toEqual({ cabins: 2, fix: 1 });
  });

  it('leaves the cabins showing exactly the answer after every accepted move', () => {
    for (const level of gondolaStages) {
      for (const item of level.pool()) {
        const answer = shapeOf(item).answer;
        const moves: Move[] = ['fill'];
        if (canTakeTen(level, item)) moves.push('takeTen');
        if (canExpress(level, item)) moves.push('express');
        for (const move of moves) {
          const layout = sceneLayout(frameFor(item, move, 'answer'));
          expect(layoutTotal(layout, item.kind), `${item.a} ${item.kind} ${item.b} by ${move}`).toBe(answer);
          expect(layout.parked).toBeGreaterThanOrEqual(0);
          expect(layout.boarding ?? 0).toBeGreaterThanOrEqual(0);
          expect(layout.opened ?? 0).toBeGreaterThanOrEqual(0);
        }
        // Before the move the scene shows the sum's parts, nothing worked out.
        const before = sceneLayout(frameFor(item, null, 'split'));
        expect(before.moved).toBe(false);
      }
    }
  });
});

describe('answers and help', () => {
  it('spots the usual slips', () => {
    expect(classifyAnswer(add(8, 5), 'fill', 10)).toBe('stopAtTen');
    expect(classifyAnswer(sub(13, 5), 'fill', 10)).toBe('stopAtTen');
    expect(classifyAnswer(add(34, 9), 'express', 45)).toBe('wrongWay');
    expect(classifyAnswer(sub(63, 9), 'express', 52)).toBe('wrongWay');
    expect(classifyAnswer(sub(43, 6), 'fill', 43)).toBe('keptTens');
    expect(classifyAnswer(add(8, 5), 'fill', 12)).toBe('other');
  });

  it('offers four answers in counting order, the stop-at-ten slip among them', () => {
    for (let seed = 1; seed < 30; seed++) {
      const choices = answerChoices(add(8, 5), seeded(seed));
      expect(choices).toHaveLength(4);
      expect(new Set(choices).size).toBe(4);
      expect(choices).toContain(13);
      expect(choices).toContain(10);
      expect([...choices].sort((x, y) => x - y)).toEqual(choices);
      expect(choices.every((n) => n >= 1)).toBe(true);
    }
  });

  it('draws the picture card with other numbers than the turn', () => {
    for (const level of gondolaStages) {
      for (const item of level.pool()) {
        const { answer, fill } = shapeOf(item);
        const split = ruleCard(item, 'split');
        if (split.kind === 'fill') {
          expect(split.a + split.b).not.toBe(answer);
          expect(10 - split.a).not.toBe(fill);
        } else {
          expect(split.a - split.b).not.toBe(answer);
          expect(split.a % 10).not.toBe(fill);
        }
        const card = ruleCard(item, 'answer');
        expect(card.a + card.b).not.toBe(answer);
      }
    }
  });
});

describe('scoring', () => {
  const base = {
    firstTry: false,
    oneMove: false,
    cocoa: false,
    clever: false,
    vip: false,
    golden: false,
    big: false,
  };
  it('rewards the strategy, not only the answer', () => {
    expect(turnPoints(base)).toBe(10);
    expect(turnPoints({ ...base, firstTry: true })).toBe(20);
    expect(turnPoints({ ...base, firstTry: true, oneMove: true })).toBe(25);
    expect(turnPoints({ ...base, cocoa: true })).toBe(25);
    expect(turnPoints({ ...base, clever: true, vip: true })).toBe(40);
    expect(turnPoints({ ...base, firstTry: true, golden: true })).toBe(40);
    expect(turnPoints({ ...base, firstTry: true, golden: true, big: true, cocoa: true })).toBe(95);
  });

  it('gives stars for first-try splits and asks three for the master level', () => {
    expect(roundStars(8, 10)).toBe(3);
    expect(roundStars(7, 10)).toBe(2);
    expect(roundStars(6, 8)).toBe(3);
    expect(roundStars(4, 8)).toBe(2);
    expect(roundStars(3, 8)).toBe(1);
    expect(isMastered(stage(3), 2)).toBe(true);
    expect(isMastered(stage(12), 2)).toBe(false);
    expect(isMastered(stage(12), 3)).toBe(true);
  });

  it('gives the cloud longer on two-digit levels, and none without a pace', () => {
    expect(cloudSeconds('off', stage(1))).toBe(0);
    expect(cloudSeconds('relaxed', stage(1))).toBe(30);
    expect(cloudSeconds('normal', stage(1))).toBe(18);
    expect(cloudSeconds('fast', stage(1))).toBe(10);
    expect(cloudSeconds('fast', stage(9))).toBeGreaterThan(10);
  });

  it('reads saved scores and the village defensively', () => {
    expect(parseGondolaSave(null)).toEqual({ best: {}, built: [] });
    expect(
      parseGondolaSave({
        version: 1,
        best: { 'gondola-2': 120, 'potion-1': 5, 'gondola-3': -1 },
        built: ['gondola-2', 'gondola-2', 7, 'gondola-5'],
      }),
    ).toEqual({ best: { 'gondola-2': 120 }, built: ['gondola-2', 'gondola-5'] });
  });
});
