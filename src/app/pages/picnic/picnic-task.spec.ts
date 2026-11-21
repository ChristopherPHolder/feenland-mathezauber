import { describe, expect, it } from 'vite-plus/test';
import { frac } from './fractions';
import type { CompareTask, CutTask, DealTask, NameTask, PickTask } from './picnic-levels';
import {
  answerCompare,
  answerDeal,
  answerFair,
  answerName,
  answerPick,
  basketLeft,
  canDeal,
  clearCuts,
  cutSizes,
  deal,
  share,
  startTask,
  toggleCut,
} from './picnic-task';

const pie = (parts: number, preset: number[] = []): CutTask => ({
  kind: 'cut',
  food: 'pie',
  parts,
  preset,
});

describe('cutting a share', () => {
  it('shares a pie in halves with one cut opposite the top', () => {
    let state = startTask(pie(2));
    expect(cutSizes(state)).toEqual([12]);
    state = toggleCut(state, 6);
    expect(share(state)).toMatchObject({ right: true, state: { phase: 'done', slips: 0 } });
  });

  it('frowns at uneven pieces and shows the smallest and biggest side by side', () => {
    const state = toggleCut(startTask(pie(2)), 5);
    const step = share(state);
    expect(step.right).toBe(false);
    expect(step.help).toEqual({ key: 'helpSame', pieces: [5 / 12, 7 / 12] });
    expect(step.state.slips).toBe(1);
  });

  it('asks to count the friends when the pieces are fair but too many', () => {
    const state = [4, 8].reduce(toggleCut, startTask(pie(2)));
    expect(share(state).help).toEqual({ key: 'helpCount' });
  });

  it('keeps the given cuts when halving the halves, and can start over', () => {
    let state = startTask({ kind: 'cut', food: 'bar', parts: 4, preset: [6] });
    expect(toggleCut(state, 6)).toBe(state);
    state = toggleCut(toggleCut(state, 3), 9);
    expect(cutSizes(state)).toEqual([3, 3, 3, 3]);
    expect(toggleCut(state, 3).cuts).toEqual([6, 9]);
    expect(clearCuts(state).cuts).toEqual([6]);
    expect(share(state).right).toBe(true);
  });
});

describe('naming, picking and comparing', () => {
  const name: NameTask = {
    kind: 'name',
    food: 'pie',
    share: frac(3, 4),
    choices: [frac(3, 4), frac(1, 4), frac(3, 5), frac(2, 4)],
  };

  it('points at the bottom number when the pieces are miscounted, else at the jam', () => {
    expect(answerName(startTask(name), frac(3, 5)).help).toEqual({ key: 'helpBottom' });
    expect(answerName(startTask(name), frac(1, 4)).help).toEqual({ key: 'helpTop' });
    const wrong = answerName(startTask(name), frac(1, 4)).state;
    expect(wrong.tried).toEqual(['1/4']);
    expect(answerName(wrong, frac(3, 4))).toMatchObject({ right: true, state: { slips: 1 } });
  });

  it('says why a plate is not the share without saying which one is', () => {
    const task: PickTask = {
      kind: 'pick',
      share: frac(1, 4),
      answer: 0,
      plates: [
        { food: 'pie', sizes: [0.25, 0.25, 0.25, 0.25], shaded: [true, false, false, false] },
        { food: 'pie', sizes: [0.4, 0.1, 0.25, 0.25], shaded: [true, false, false, false] },
        {
          food: 'pie',
          sizes: [0.2, 0.2, 0.2, 0.2, 0.2],
          shaded: [true, false, false, false, false],
        },
        { food: 'pie', sizes: [0.25, 0.25, 0.25, 0.25], shaded: [true, true, false, false] },
      ],
    };
    const state = startTask(task);
    expect(answerPick(state, 1).help).toEqual({ key: 'helpPlateEqual' });
    expect(answerPick(state, 2).help).toEqual({ key: 'helpPlateParts' });
    expect(answerPick(state, 3).help).toEqual({ key: 'helpPlateJam' });
    expect(answerPick(state, 0).right).toBe(true);
  });

  it('asks the child to finish "more friends, so each slice is …" after a unit slip', () => {
    const task: CompareTask = {
      kind: 'compare',
      food: 'pie',
      left: frac(1, 3),
      right: frac(1, 6),
      covered: false,
      same: false,
    };
    expect(answerCompare(startTask(task), 'right').help).toEqual({ key: 'helpMoreFriends' });
    expect(answerCompare(startTask(task), 'left').right).toBe(true);
    const same = { ...task, left: frac(1, 2), right: frac(2, 4), same: true };
    expect(answerCompare(startTask(same), 'left').help).toEqual({ key: 'helpHowMuch' });
    expect(answerCompare(startTask(same), 'same').right).toBe(true);
  });

  it('judges fair and unfair cuts', () => {
    const task = { kind: 'fair', food: 'bar', sizes: [0.7, 0.3], fair: false } as const;
    expect(answerFair(startTask(task), true).help).toEqual({ key: 'helpFair', pieces: [0.3, 0.7] });
    expect(answerFair(startTask(task), false).right).toBe(true);
  });
});

describe('sharing a group', () => {
  const task: DealTask = {
    kind: 'deal',
    share: frac(3, 4),
    total: 12,
    handfuls: [1, 2],
    choices: [3, 8, 9, 10],
  };

  it('deals handfuls to every plate until the basket is empty, then asks', () => {
    let state = startTask(task);
    expect(canDeal(state, 2)).toBe(true);
    expect(canDeal(state, 5)).toBe(false);
    state = deal(state, 2);
    expect(basketLeft(state)).toBe(4);
    expect(canDeal(state, 2)).toBe(false);
    expect(answerDeal(state, 9).right).toBe(false);
    state = deal(state, 1);
    expect(state.phase).toBe('answer');
    expect(answerDeal(state, 3).help).toEqual({ key: 'helpSomePlates' });
    expect(answerDeal(state, 9).right).toBe(true);
  });
});
