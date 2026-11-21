import { describe, expect, it } from 'vite-plus/test';
import { compareFractions, equivalent, fractionOfSet, sameFraction } from './fractions';
import {
  antSeconds,
  bigger,
  createRound,
  dealChoices,
  nameChoices,
  NEAR_PAIRS,
  parsePicnicPace,
  picnicExample,
  picnicLevels,
  picnicStage,
  picnicStages,
  pickTask,
  ROUND_LENGTH,
  roundStars,
  SAME_PAIRS,
  sharePoints,
  Task,
} from './picnic-levels';

/** A seeded random so every round in the tests is a different one, and repeatable. */
function seeded(seed: number) {
  let value = seed;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function check(task: Task) {
  switch (task.kind) {
    case 'cut':
      expect(task.parts).toBeGreaterThanOrEqual(2);
      expect(12 % task.parts).toBe(0);
      break;
    case 'fair':
      expect(task.sizes.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
      break;
    case 'name':
      expect(task.choices).toHaveLength(4);
      expect(task.choices.filter((f) => sameFraction(f, task.share))).toHaveLength(1);
      for (const choice of task.choices)
        if (!sameFraction(choice, task.share)) expect(equivalent(choice, task.share)).toBe(false);
      break;
    case 'pick':
      expect(task.plates).toHaveLength(4);
      task.plates.forEach((plate, index) => {
        const equal = plate.sizes.every((size) => Math.abs(size - plate.sizes[0]) < 1e-9);
        const jam = plate.shaded.filter(Boolean).length;
        const right = equal && jam * task.share.d === task.share.n * plate.sizes.length;
        expect(right).toBe(index === task.answer);
      });
      break;
    case 'compare':
      if (!task.same) expect(compareFractions(task.left, task.right)).not.toBe(0);
      break;
    case 'deal': {
      const answer = fractionOfSet(task.share, task.total);
      expect(answer).not.toBeNull();
      expect(task.total).toBeLessThanOrEqual(60);
      expect(task.choices).toContain(answer);
      expect(new Set(task.choices).size).toBe(4);
      break;
    }
  }
}

describe('picnic levels', () => {
  it('has twelve levels in four topics and a master level', () => {
    expect(picnicLevels.map((level) => level.id)).toEqual(
      Array.from({ length: 12 }, (_, index) => `picnic-${index + 1}`),
    );
    expect(new Set(picnicStages.map((stage) => stage.group))).toEqual(
      new Set(['picnicHalves', 'picnicName', 'picnicMore', 'picnicGroups', 'picnicMaster']),
    );
    expect(picnicStage('picnic-12')?.masteryStars).toBe(3);
    expect(picnicStage('picnic-13')).toBeUndefined();
    expect(picnicStage('bakery-1')).toBeUndefined();
  });

  it('builds six shares and the big cake for every level, each one answerable', () => {
    for (const stage of picnicStages)
      for (let seed = 1; seed < 40; seed++) {
        const round = createRound(stage, seeded(seed * 97 + stage.stage));
        expect(round).toHaveLength(ROUND_LENGTH);
        round.forEach(check);
      }
  });

  it('leads with cutting and sharing, and names, compares and shares groups later', () => {
    const kinds = (n: number) =>
      new Set(createRound(picnicStage(`picnic-${n}`)!, seeded(n)).map((t) => t.kind));
    expect(kinds(1)).toEqual(new Set(['cut', 'fair']));
    expect(kinds(3)).toContain('cut');
    expect(kinds(4)).toEqual(new Set(['name', 'pick']));
    expect(kinds(7)).toEqual(new Set(['compare']));
    expect(kinds(9)).toEqual(new Set(['deal']));
  });

  it('halves the halves on the first quarters', () => {
    const [first] = createRound(picnicStage('picnic-2')!, seeded(3));
    expect(first).toMatchObject({ kind: 'cut', parts: 4, preset: [0, 6] });
  });

  it('keeps unit comparisons apart and offers "same" only for amounts', () => {
    for (let seed = 1; seed < 30; seed++) {
      for (const task of createRound(picnicStage('picnic-7')!, seeded(seed)))
        if (task.kind === 'compare') {
          expect(task.left.n).toBe(1);
          expect(task.right.n).toBe(1);
          expect(task.same).toBe(false);
        }
      const same = createRound(picnicStage('picnic-8')!, seeded(seed)).filter(
        (task) => task.kind === 'compare' && bigger(task) === 'same',
      );
      expect(same.length).toBeGreaterThanOrEqual(3);
    }
    for (const [a, b] of SAME_PAIRS) expect(equivalent(a, b)).toBe(true);
    for (const [a, b] of NEAR_PAIRS) expect(equivalent(a, b)).toBe(false);
  });

  it('chooses wrong names a child might give, never the same amount', () => {
    const random = seeded(5);
    const quarter = nameChoices(random, { n: 1, d: 4 });
    expect(quarter).toContainEqual({ n: 1, d: 4 });
    const half = nameChoices(random, { n: 2, d: 4 });
    expect(half.some((f) => f.n === 1 && f.d === 2)).toBe(false);
  });

  it('puts one fair plate among an unfair one, other pieces and other jam', () => {
    const task = pickTask(seeded(9), 'pie', { n: 1, d: 4 });
    check(task);
    const unequal = task.plates.filter(
      (plate) => !plate.sizes.every((size) => Math.abs(size - plate.sizes[0]) < 1e-9),
    );
    expect(unequal).toHaveLength(1);
  });

  it('offers deal answers that are real slips', () => {
    const choices = dealChoices(seeded(2), { n: 3, d: 4 }, 12);
    expect(choices).toContain(9);
    expect(choices.every((n) => n > 0 && n <= 12)).toBe(true);
  });

  it('lets the ants walk longer for cutting and big baskets, and not at all without a timer', () => {
    const cut = { kind: 'cut', food: 'pie', parts: 3, preset: [] } as const;
    const name = { kind: 'name', food: 'pie', share: { n: 1, d: 3 }, choices: [] } as const;
    expect(antSeconds('off', cut)).toBe(0);
    expect(antSeconds('normal', cut)).toBeGreaterThan(antSeconds('normal', name));
    expect(antSeconds('fast', cut)).toBeLessThan(antSeconds('relaxed', cut));
    expect(parsePicnicPace('fast')).toBe('fast');
    expect(parsePicnicPace('warp')).toBe('off');
  });

  it('doubles points for the cake and the golden spoon and gives three stars for six first tries', () => {
    expect(sharePoints({ firstTry: true, crumb: false, golden: false, cake: false })).toBe(20);
    expect(sharePoints({ firstTry: true, crumb: true, golden: true, cake: true })).toBe(95);
    expect(sharePoints({ firstTry: false, crumb: false, golden: false, cake: false })).toBe(10);
    expect(roundStars(6)).toBe(3);
    expect(roundStars(4)).toBe(2);
    expect(roundStars(3)).toBe(1);
  });

  it('words the hub example in the child’s language', () => {
    expect(picnicExample(picnicStage('picnic-9')!, 'von')).toBe('⅓ von 12 = 4');
  });
});
