import {
  checkShare,
  extremes,
  Fraction,
  fractionOfSet,
  pieceSizes,
  sameFraction,
  TICKS,
} from './fractions';
import { bigger, roundFood, Task } from './picnic-levels';

/**
 * Help after a slip. It names what to look at, never the answer: no cut positions, no counts
 * of berries, no "the left one".
 */
export type Help =
  /** Too many or too few pieces for the friends. */
  | { readonly key: 'helpCount' }
  /** Uneven pieces: the smallest and biggest are shown side by side (shares of the whole). */
  | { readonly key: 'helpSame'; readonly pieces: readonly [number, number] }
  | { readonly key: 'helpFair'; readonly pieces: readonly [number, number] }
  /** Naming: the bottom number counts the equal pieces, the top the friend's pieces. */
  | { readonly key: 'helpBottom' }
  | { readonly key: 'helpTop' }
  /** Picking a plate. */
  | { readonly key: 'helpPlateEqual' }
  | { readonly key: 'helpPlateParts' }
  | { readonly key: 'helpPlateJam' }
  /** Comparing: "More friends, so each slice is …" for the child to finish. */
  | { readonly key: 'helpMoreFriends' }
  /** Comparing amounts: look at how much has jam, not how many pieces. */
  | { readonly key: 'helpHowMuch' }
  /** Sharing a group: count the berries on one plate, or on the friends' plates. */
  | { readonly key: 'helpOnePlate' }
  | { readonly key: 'helpSomePlates' };

export type Side = 'left' | 'right' | 'same';
export type Phase = 'work' | 'answer' | 'done';

export interface TaskState {
  readonly task: Task;
  /** Cut marks so far (cut tasks), including the given ones. */
  readonly cuts: readonly number[];
  /** Berries dealt onto each plate (deal tasks). */
  readonly dealt: number;
  readonly phase: Phase;
  /** Wrong answers on this share. */
  readonly slips: number;
  /** Answers already tried, so they grey out (choices, plates, sides). */
  readonly tried: readonly string[];
}

export interface Step {
  readonly right: boolean;
  readonly state: TaskState;
  readonly help?: Help;
}

export function startTask(task: Task): TaskState {
  return {
    task,
    cuts: task.kind === 'cut' ? [...task.preset] : [],
    dealt: 0,
    phase: 'work',
    slips: 0,
    tried: [],
  };
}

/** Pieces of a cut task as they lie now, in marks. */
export function cutSizes(state: TaskState): number[] {
  const task = state.task;
  if (task.kind !== 'cut') return [];
  return pieceSizes(roundFood(task.food) ? 'round' : 'strip', state.cuts);
}

/** The marks a child may cut at: round foods keep their top cut, given cuts stay. */
export function cutMarks(state: TaskState): number[] {
  const task = state.task;
  if (task.kind !== 'cut') return [];
  return Array.from({ length: TICKS - 1 }, (_, index) => index + 1).filter(
    (mark) => !task.preset.includes(mark),
  );
}

/** Cuts at a mark, or takes the cut away again. Given cuts and the top of a pie stay. */
export function toggleCut(state: TaskState, mark: number): TaskState {
  const task = state.task;
  if (task.kind !== 'cut' || state.phase !== 'work') return state;
  if (task.preset.includes(mark) || mark <= 0 || mark >= TICKS) return state;
  const cuts = state.cuts.includes(mark)
    ? state.cuts.filter((cut) => cut !== mark)
    : [...state.cuts, mark].sort((a, b) => a - b);
  return { ...state, cuts };
}

/** Takes away every cut the child made. */
export function clearCuts(state: TaskState): TaskState {
  const task = state.task;
  if (task.kind !== 'cut' || state.phase !== 'work') return state;
  return { ...state, cuts: [...task.preset] };
}

const slip = (state: TaskState, tried?: string): TaskState => ({
  ...state,
  slips: state.slips + 1,
  tried: tried && !state.tried.includes(tried) ? [...state.tried, tried] : state.tried,
});
const done = (state: TaskState): TaskState => ({ ...state, phase: 'done' });

/** "Share!": every friend gets one piece, and every piece is the same size. */
export function share(state: TaskState): Step {
  const task = state.task;
  if (task.kind !== 'cut' || state.phase !== 'work') return { right: false, state };
  const sizes = cutSizes(state);
  const check = checkShare(sizes, task.parts);
  if (check.fair) return { right: true, state: done(state) };
  if (!check.equal) {
    const [small, big] = extremes(sizes);
    return {
      right: false,
      state: slip(state),
      help: { key: 'helpSame', pieces: [small / TICKS, big / TICKS] },
    };
  }
  return { right: false, state: slip(state), help: { key: 'helpCount' } };
}

/** "Is it fair?" */
export function answerFair(state: TaskState, fair: boolean): Step {
  const task = state.task;
  if (task.kind !== 'fair' || state.phase !== 'work') return { right: false, state };
  if (fair === task.fair) return { right: true, state: done(state) };
  return {
    right: false,
    state: slip(state, String(fair)),
    help: { key: 'helpFair', pieces: extremes(task.sizes) },
  };
}

export const fractionKey = (f: Fraction) => `${f.n}/${f.d}`;

/** Names the friend's share. A wrong bottom number points at the pieces, else at the jam. */
export function answerName(state: TaskState, answer: Fraction): Step {
  const task = state.task;
  if (task.kind !== 'name' || state.phase !== 'work') return { right: false, state };
  if (sameFraction(answer, task.share)) return { right: true, state: done(state) };
  return {
    right: false,
    state: slip(state, fractionKey(answer)),
    help: { key: answer.d !== task.share.d ? 'helpBottom' : 'helpTop' },
  };
}

/** Picks the plate that shows the share. */
export function answerPick(state: TaskState, index: number): Step {
  const task = state.task;
  if (task.kind !== 'pick' || state.phase !== 'work') return { right: false, state };
  if (index === task.answer) return { right: true, state: done(state) };
  const plate = task.plates[index];
  const equal = plate ? plate.sizes.every((size) => Math.abs(size - plate.sizes[0]) < 1e-9) : true;
  const key: Help['key'] = !equal
    ? 'helpPlateEqual'
    : plate && plate.sizes.length !== task.share.d
      ? 'helpPlateParts'
      : 'helpPlateJam';
  return { right: false, state: slip(state, String(index)), help: { key } as Help };
}

/** Who gets more? Unit fractions get the friends hint; others are about the amount with jam. */
export function answerCompare(state: TaskState, side: Side): Step {
  const task = state.task;
  if (task.kind !== 'compare' || state.phase !== 'work') return { right: false, state };
  if (side === bigger(task)) return { right: true, state: done(state) };
  const units = task.left.n === 1 && task.right.n === 1;
  return {
    right: false,
    state: slip(state, side),
    help: { key: units ? 'helpMoreFriends' : 'helpHowMuch' },
  };
}

/** Berries still in the basket. */
export function basketLeft(state: TaskState): number {
  const task = state.task;
  return task.kind === 'deal' ? task.total - state.dealt * task.share.d : 0;
}

/** Whether a handful for every plate still fits in the basket. */
export function canDeal(state: TaskState, handful: number): boolean {
  return (
    state.task.kind === 'deal' &&
    state.phase === 'work' &&
    handful > 0 &&
    handful * state.task.share.d <= basketLeft(state)
  );
}

/** Deals a handful onto every plate; once the basket is empty, the question comes. */
export function deal(state: TaskState, handful: number): TaskState {
  if (!canDeal(state, handful)) return state;
  const next = { ...state, dealt: state.dealt + handful };
  return basketLeft(next) === 0 ? { ...next, phase: 'answer' } : next;
}

/** "n⁄d of the berries is …" once they are dealt out. */
export function answerDeal(state: TaskState, value: number): Step {
  const task = state.task;
  if (task.kind !== 'deal' || state.phase !== 'answer') return { right: false, state };
  if (value === fractionOfSet(task.share, task.total)) return { right: true, state: done(state) };
  return {
    right: false,
    state: slip(state, String(value)),
    help: { key: task.share.n === 1 ? 'helpOnePlate' : 'helpSomePlates' },
  };
}
