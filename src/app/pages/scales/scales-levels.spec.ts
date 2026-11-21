import { describe, expect, it } from 'vite-plus/test';
import {
  compareAnswer,
  cookPoints,
  createRound,
  fewestFor,
  LINES,
  MAX_PIECES,
  POINTS,
  ROUND_LENGTH,
  roundStars,
  scalesLevels,
  scalesStage,
  scalesStages,
  solvable,
  soupSeconds,
  taskKey,
  type Task,
} from './scales-levels';
import { fewestWeights, sum } from './scales-math';

/** A seeded random, so every failure can be replayed. */
function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

const rounds = (stage: number, count = 150) =>
  Array.from({ length: count }, (_, seed) =>
    createRound(scalesStage(`scales-${stage}`)!, seeded(seed + 1)),
  );

describe('scales levels', () => {
  it('has twelve levels with stable ids in six topics', () => {
    expect(scalesLevels.map((level) => level.id)).toEqual(
      Array.from({ length: 12 }, (_, index) => `scales-${index + 1}`),
    );
    expect(new Set(scalesStages.map((stage) => stage.group)).size).toBe(6);
    expect(scalesStage('scales-13')).toBeUndefined();
    expect(scalesStage('bakery-1')).toBeUndefined();
  });

  it('only asks the feast level for three stars', () => {
    expect(scalesStages.filter((stage) => stage.masteryStars === 3).map((s) => s.stage)).toEqual([
      12,
    ]);
  });
});

describe('every round', () => {
  for (const stage of scalesStages)
    it(`on level ${stage.stage} has seven lines, all solvable and none twice`, () => {
      for (const round of rounds(stage.stage)) {
        expect(round).toHaveLength(ROUND_LENGTH);
        for (const task of round) expect(solvable(task), JSON.stringify(task)).toBe(true);
        expect(new Set(round.map(taskKey)).size).toBe(ROUND_LENGTH);
      }
    });
});

const ofKind = <K extends Task['kind']>(tasks: readonly Task[], kind: K) =>
  tasks.filter((task): task is Extract<Task, { kind: K }> => task.kind === kind);

describe('balancing', () => {
  it('can always be levelled with the weights on offer, with room on the pan', () => {
    for (const stage of [2, 3, 5, 7, 12])
      for (const task of ofKind(rounds(stage).flat(), 'balance')) {
        const pieces = fewestWeights(task.need, task.sizes);
        expect(pieces).not.toBeNull();
        expect(pieces!.length).toBeLessThanOrEqual(MAX_PIECES);
        expect(sum(pieces!)).toBe(task.need);
      }
  });

  it('keeps level 2 and the equations within 20', () => {
    for (const stage of [2, 7])
      for (const task of ofKind(rounds(stage).flat(), 'balance')) {
        const left = sum(task.left.map((load) => load.amount));
        const right = sum(task.right.map((load) => load.amount));
        expect(Math.max(left, right)).toBeLessThanOrEqual(20);
        expect(task.need).toBeLessThanOrEqual(20);
      }
  });

  it('weighs grams with 100, 200 and 500 g, and asks for a whole kilogram once', () => {
    for (const round of rounds(5, 30)) {
      const tasks = ofKind(round, 'balance');
      expect(tasks.every((task) => task.unit === 'g' && task.sizes.join() === '500,200,100')).toBe(
        true,
      );
      expect(tasks.some((task) => task.need === 1000)).toBe(true);
    }
  });

  it('writes the equation levels with weights on both pans', () => {
    for (const task of ofKind(rounds(7).flat(), 'balance')) {
      expect(task.equation).toBe(true);
      expect(task.left.length && task.right.length).toBeTruthy();
    }
  });
});

describe('mystery boxes', () => {
  it('balance once every box weighs the answer, all within 40 kg', () => {
    for (const stage of [8, 9])
      for (const task of ofKind(rounds(stage).flat(), 'missing')) {
        const side = (loads: typeof task.left) => sum(loads.map((l) => l.amount));
        expect(side(task.left)).toBe(side(task.right));
        expect(side(task.left)).toBeLessThanOrEqual(40);
        expect(task.answer).toBeGreaterThan(0);
      }
  });

  it('puts sacks on the times level, like 3 × 4 = □ + 2', () => {
    const tasks = ofKind(rounds(9, 20).flat(), 'missing');
    const lines = tasks.filter((task) => task.left.some((load) => load.kind === 'sack'));
    expect(lines.length).toBeGreaterThan(0);
    for (const task of lines) {
      const sacks = task.left.filter((load) => load.kind === 'sack');
      expect(new Set(sacks.map((s) => s.amount)).size).toBe(1);
    }
  });
});

describe('dials', () => {
  it('point at a mark between the numbers, never at a written number', () => {
    for (const stage of [4, 6])
      for (const task of ofKind(rounds(stage).flat(), 'dial')) {
        expect(task.amount % task.dial.step).toBe(0);
        expect(task.amount % task.dial.label).not.toBe(0);
        expect(task.amount).toBeLessThan(task.dial.max);
      }
  });

  it('read kilograms on level 4 and grams on level 6', () => {
    expect(ofKind(rounds(4, 10).flat(), 'dial').every((task) => task.unit === 'kg')).toBe(true);
    expect(ofKind(rounds(6, 10).flat(), 'dial').every((task) => task.unit === 'g')).toBe(true);
  });
});

describe('pouring', () => {
  it('fills half litres from 1 l and 0.5 l jugs on level 10', () => {
    for (const task of ofKind(rounds(10).flat(), 'pour')) {
      expect(task.target % 500).toBe(0);
      expect(task.jugs).toEqual([1000, 500]);
      expect(task.target).toBeLessThan(task.capacity);
    }
  });

  it('fills to 250 ml steps from three jugs on level 11', () => {
    for (const task of ofKind(rounds(11).flat(), 'pour')) {
      expect(task.target % 250).toBe(0);
      expect(task.jugs).toEqual([1000, 500, 250]);
      expect(fewestFor(task)).toBeGreaterThan(0);
    }
  });
});

describe('heavier or lighter', () => {
  it('never compares two things that weigh the same', () => {
    for (const task of ofKind(rounds(1).flat(), 'compare'))
      expect(task.left.amount).not.toBe(task.right.amount);
  });

  it('wants the side that goes down for heavier, the side that goes up for lighter', () => {
    const pumpkin = { kind: 'item', item: 'pumpkin', amount: 9 } as const;
    const pillow = { kind: 'item', item: 'pillow', amount: 1 } as const;
    const base = {
      kind: 'compare',
      unit: 'kg',
      left: pumpkin,
      right: pillow,
      labelled: false,
    } as const;
    expect(compareAnswer({ ...base, ask: 'heavier', claim: 'left' })).toBe('left');
    expect(compareAnswer({ ...base, ask: 'lighter', claim: 'left' })).toBe('right');
    expect(compareAnswer({ ...base, ask: 'claim', claim: 'left' })).toBe('yes');
    expect(compareAnswer({ ...base, ask: 'claim', claim: 'right' })).toBe('no');
  });

  it('ends on a tricky sentence where big is light', () => {
    for (const round of rounds(1, 20)) {
      const feast = round[LINES];
      expect(feast.kind === 'compare' && feast.ask).toBe('claim');
    }
  });
});

describe('points, stars and the timer', () => {
  it('pays for first tries, fewest weights and finishing in time', () => {
    const plain = { firstTry: false, fewest: false, inTime: false, hearty: false, feast: false };
    expect(cookPoints(plain)).toBe(POINTS.line);
    expect(cookPoints({ ...plain, firstTry: true, fewest: true })).toBe(30);
    expect(cookPoints({ ...plain, firstTry: true, hearty: true })).toBe(40);
    expect(cookPoints({ ...plain, firstTry: true, feast: true, inTime: true })).toBe(55);
  });

  it('gives three stars for six first tries out of seven', () => {
    expect(roundStars(7)).toBe(3);
    expect(roundStars(6)).toBe(3);
    expect(roundStars(4)).toBe(2);
    expect(roundStars(3)).toBe(1);
  });

  it('gives no timer when it is off, and less time to compare than to balance', () => {
    expect(soupSeconds('off', 'balance')).toBe(0);
    expect(soupSeconds('normal', 'compare')).toBeLessThan(soupSeconds('normal', 'balance'));
  });
});
