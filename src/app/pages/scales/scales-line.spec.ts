import { describe, expect, it } from 'vite-plus/test';
import type { BalanceTask, CompareTask, DialTask, MissingTask, PourTask } from './scales-levels';
import {
  addWeight,
  answerCompare,
  canPour,
  checkPour,
  difference,
  emptyPot,
  lineTilt,
  pour,
  removeWeight,
  startLine,
  submitEntry,
  typeDigit,
  usedFewest,
  weigh,
} from './scales-line';

const pumpkin: BalanceTask = {
  kind: 'balance',
  unit: 'kg',
  left: [{ kind: 'item', item: 'pumpkin', amount: 7 }],
  right: [],
  side: 'right',
  sizes: [10, 5, 2, 1],
  need: 7,
  item: 'pumpkin',
  equation: false,
};

describe('balancing a line', () => {
  it('tips toward the pumpkin before any weight goes on', () => {
    const line = startLine(pumpkin);
    expect(difference(line)).toBe(7);
    expect(lineTilt(line)).toBeGreaterThan(0);
  });

  it('is held level while weights go on, and tips the heavy side down when weighed', () => {
    let line = addWeight(startLine(pumpkin), 5);
    expect(line.held).toBe(true);
    expect(lineTilt(line)).toBe(0);
    line = weigh(line);
    expect(line.verdict).toBe('leftDown');
    expect(line.slips).toBe(1);
    expect(lineTilt(line)).toBeGreaterThan(0);
    line = weigh(addWeight(addWeight(line, 10), 2));
    expect(line.verdict).toBe('rightDown');
    expect(lineTilt(line)).toBeLessThan(0);
  });

  it('cooks once both sides weigh the same, and knows the fewest weights', () => {
    const line = weigh(addWeight(addWeight(startLine(pumpkin), 5), 2));
    expect(line.done).toBe(true);
    expect(line.verdict).toBe('level');
    expect(usedFewest(line)).toBe(true);
    const slow = weigh(
      [1, 1, 5].reduce((state, size) => addWeight(state, size), startLine(pumpkin)),
    );
    expect(slow.done).toBe(true);
    expect(usedFewest(slow)).toBe(false);
  });

  it('takes a weight back off the pan', () => {
    const line = removeWeight(addWeight(addWeight(startLine(pumpkin), 5), 10), 1);
    expect(line.placed).toEqual([5]);
  });

  it('ignores weights the level does not offer', () => {
    const line = startLine(pumpkin);
    expect(addWeight(line, 3)).toBe(line);
  });

  it('fills the gap on either pan of an equation, 4 + 5 = 7 + □', () => {
    const task: BalanceTask = {
      ...pumpkin,
      left: [
        { kind: 'weight', amount: 4 },
        { kind: 'weight', amount: 5 },
      ],
      right: [{ kind: 'weight', amount: 7 }],
      side: 'right',
      need: 2,
      equation: true,
    };
    expect(weigh(addWeight(startLine(task), 2)).done).toBe(true);
  });
});

describe('a mystery box', () => {
  const task: MissingTask = {
    kind: 'missing',
    unit: 'kg',
    left: [
      { kind: 'weight', amount: 7 },
      { kind: 'mystery', amount: 2 },
    ],
    right: [
      { kind: 'weight', amount: 4 },
      { kind: 'weight', amount: 5 },
    ],
    answer: 2,
  };

  it('sits level, because the box already weighs the right amount', () => {
    expect(lineTilt(startLine(task))).toBe(0);
  });

  it('swaps a wrong number in for the box, so the beam shows which side is heavier', () => {
    let line = submitEntry(typeDigit(startLine(task), 5));
    expect(line.done).toBe(false);
    expect(line.guess).toBe(5);
    expect(line.verdict).toBe('leftDown');
    expect(lineTilt(line)).toBeGreaterThan(0);
    line = submitEntry(typeDigit(line, 1));
    expect(line.verdict).toBe('rightDown');
    line = submitEntry(typeDigit(line, 2));
    expect(line.done).toBe(true);
    expect(line.slips).toBe(2);
  });
});

describe('reading a dial', () => {
  const task: DialTask = {
    kind: 'dial',
    unit: 'g',
    dial: { max: 1000, step: 50, label: 250 },
    amount: 650,
    item: 'butter',
  };

  it('asks again after a wrong reading without saying more or less', () => {
    const line = submitEntry([6, 0, 0].reduce((s, d) => typeDigit(s, d), startLine(task)));
    expect(line.verdict).toBe('misread');
    expect(line.entry).toBe('');
    expect(submitEntry([6, 5, 0].reduce((s, d) => typeDigit(s, d), line)).done).toBe(true);
  });
});

describe('pouring', () => {
  const task: PourTask = {
    kind: 'pour',
    unit: 'l',
    target: 1500,
    jugs: [1000, 500],
    capacity: 3000,
    item: 'milk',
  };

  it('says under or over the line, and cooks right on it', () => {
    let line = checkPour(pour(startLine(task), 1000));
    expect(line.verdict).toBe('under');
    line = checkPour(pour(pour(line, 500), 500));
    expect(line.verdict).toBe('over');
    line = checkPour(pour(pour(emptyPot(line), 1000), 500));
    expect(line.done).toBe(true);
    expect(usedFewest(line)).toBe(true);
  });

  it('never pours past the rim of the pot', () => {
    const line = pour(pour(pour(startLine(task), 1000), 1000), 1000);
    expect(canPour(line, 500)).toBe(false);
  });
});

describe('heavier or lighter', () => {
  const task: CompareTask = {
    kind: 'compare',
    unit: 'kg',
    left: { kind: 'item', item: 'flour', amount: 4 },
    right: { kind: 'item', item: 'potatoes', amount: 11 },
    ask: 'heavier',
    claim: 'left',
    labelled: true,
  };

  it('holds a labelled beam until the child picks the right one', () => {
    let line = answerCompare(startLine(task), 'left');
    expect(line.verdict).toBe('wrongPick');
    expect(lineTilt(line)).toBe(0);
    line = answerCompare(line, 'right');
    expect(line.done).toBe(true);
    expect(lineTilt(line)).toBeLessThan(0);
  });
});
