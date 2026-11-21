import { compareAnswer, fewestFor, Load, MAX_PIECES, Side, Task } from './scales-levels';
import { sum, tiltFor } from './scales-math';

/**
 * What the last check said. The beam (or the pot) is the feedback: which side went down, or
 * whether the pot is over or under its line. It never says by how much.
 */
export type Verdict =
  | 'level'
  | 'leftDown'
  | 'rightDown'
  | 'over'
  | 'under'
  | 'misread'
  | 'wrongPick'
  | null;

export type Pick = Side | 'yes' | 'no';

/** One recipe line as the child works on it. */
export interface LineState {
  readonly task: Task;
  /** Weights the child put on the pan, or what they poured, in order. */
  readonly placed: readonly number[];
  /** The number typed for a dial or a mystery box. */
  readonly entry: string;
  /**
   * Bramble steadies the beam while the child changes the pan, so it only tips when they let go
   * and weigh. Before the first weight the beam shows what is on it.
   */
  readonly held: boolean;
  /** A wrong number for a mystery box: Bramble swaps the box for a weight of that number. */
  readonly guess: number | null;
  readonly slips: number;
  readonly verdict: Verdict;
  readonly done: boolean;
}

export function startLine(task: Task): LineState {
  return {
    task,
    placed: [],
    entry: '',
    held: task.kind === 'compare' && task.labelled,
    guess: null,
    slips: 0,
    verdict: null,
    done: false,
  };
}

const sideWeight = (loads: readonly Load[], box: number) =>
  sum(loads.map((load) => (load.kind === 'mystery' ? box : load.amount)));

/** Left pan minus right pan as things stand, with the child's weights and any guessed box. */
export function difference(line: LineState): number {
  const task = line.task;
  switch (task.kind) {
    case 'compare':
      return task.left.amount - task.right.amount;
    case 'balance': {
      const added = sum(line.placed);
      return (
        sum(task.left.map((l) => l.amount)) +
        (task.side === 'left' ? added : 0) -
        sum(task.right.map((l) => l.amount)) -
        (task.side === 'right' ? added : 0)
      );
    }
    case 'missing': {
      const box = line.guess ?? task.answer;
      return sideWeight(task.left, box) - sideWeight(task.right, box);
    }
    default:
      return 0;
  }
}

/** How big the amounts on the scale are, so the tilt grows sensibly. */
function tiltRange(task: Task): number {
  if (task.kind === 'balance') return Math.max(task.need, ...task.sizes);
  if (task.kind === 'missing') return Math.max(4, task.answer);
  return 6;
}

/** Where the beam settles now: level while Bramble holds it. */
export function lineTilt(line: LineState): number {
  if (line.held || line.task.kind === 'dial' || line.task.kind === 'pour') return 0;
  return tiltFor(difference(line), tiltRange(line.task));
}

/** The pieces on the pan or poured so far. */
export const pieces = (line: LineState) => line.placed.length;

export function poured(line: LineState): number {
  return line.task.kind === 'pour' ? sum(line.placed) : 0;
}

/** Puts one more weight on the pan. Bramble takes hold of the beam again. */
export function addWeight(line: LineState, size: number): LineState {
  const task = line.task;
  if (line.done || task.kind !== 'balance' || !task.sizes.includes(size)) return line;
  if (line.placed.length >= MAX_PIECES) return line;
  return { ...line, placed: [...line.placed, size], held: true, verdict: null };
}

/** Takes one weight off the pan. */
export function removeWeight(line: LineState, index: number): LineState {
  if (line.done || index < 0 || index >= line.placed.length) return line;
  return {
    ...line,
    placed: line.placed.filter((_, at) => at !== index),
    held: true,
    verdict: null,
  };
}

/** Bramble lets go: level cooks the line, anything else tips the beam and counts a slip. */
export function weigh(line: LineState): LineState {
  if (line.done || line.task.kind !== 'balance' || !line.placed.length) return line;
  const diff = difference(line);
  if (diff === 0) return { ...line, held: false, verdict: 'level', done: true };
  return {
    ...line,
    held: false,
    slips: line.slips + 1,
    verdict: diff > 0 ? 'leftDown' : 'rightDown',
  };
}

/** Pours one jug into the pot, as long as the pot does not run over its rim. */
export function pour(line: LineState, jug: number): LineState {
  const task = line.task;
  if (line.done || task.kind !== 'pour' || !task.jugs.includes(jug)) return line;
  if (line.placed.length >= MAX_PIECES || poured(line) + jug > task.capacity) return line;
  return { ...line, placed: [...line.placed, jug], verdict: null };
}

export function canPour(line: LineState, jug: number): boolean {
  return pour(line, jug) !== line;
}

/** Tips the pot out to start again. */
export function emptyPot(line: LineState): LineState {
  if (line.done || !line.placed.length) return line;
  return { ...line, placed: [], verdict: null };
}

/** "Done pouring": right on the line cooks it; over or under counts a slip. */
export function checkPour(line: LineState): LineState {
  const task = line.task;
  if (line.done || task.kind !== 'pour' || !line.placed.length) return line;
  const filled = poured(line);
  if (filled === task.target) return { ...line, verdict: 'level', done: true };
  return { ...line, slips: line.slips + 1, verdict: filled > task.target ? 'over' : 'under' };
}

/** Digits for a dial reading or a mystery box: up to four (2000 g), no leading zero. */
export function typeDigit(line: LineState, digit: number): LineState {
  if (line.done || (line.task.kind !== 'dial' && line.task.kind !== 'missing')) return line;
  if (line.entry.length >= 4) return line;
  const entry = line.entry === '0' ? String(digit) : line.entry + digit;
  return { ...line, entry, guess: null, verdict: null };
}

export function eraseDigit(line: LineState): LineState {
  if (line.done || !line.entry) return line;
  return { ...line, entry: line.entry.slice(0, -1), guess: null, verdict: null };
}

/**
 * Checks a typed number. A wrong mystery box turns into a weight of that number on the pan,
 * so the beam shows which side is now heavier; a wrong dial reading just asks again.
 */
export function submitEntry(line: LineState): LineState {
  const task = line.task;
  if (line.done || !line.entry) return line;
  const value = Number(line.entry);
  if (task.kind === 'dial') {
    return value === task.amount
      ? { ...line, verdict: 'level', done: true }
      : { ...line, entry: '', slips: line.slips + 1, verdict: 'misread' };
  }
  if (task.kind !== 'missing') return line;
  if (value === task.answer) return { ...line, guess: null, verdict: 'level', done: true };
  const tried = { ...line, guess: value };
  return {
    ...tried,
    entry: '',
    slips: line.slips + 1,
    verdict: difference(tried) > 0 ? 'leftDown' : 'rightDown',
  };
}

/** Heavier, lighter or ✓/✗. Once right, Bramble lets go of a held beam. */
export function answerCompare(line: LineState, choice: Pick): LineState {
  const task = line.task;
  if (line.done || task.kind !== 'compare') return line;
  if (compareAnswer(task) === choice) return { ...line, held: false, verdict: 'level', done: true };
  return { ...line, slips: line.slips + 1, verdict: 'wrongPick' };
}

/** Cooked with as few weights or pours as possible. */
export function usedFewest(line: LineState): boolean {
  const fewest = fewestFor(line.task);
  return fewest > 0 && line.done && line.placed.length === fewest;
}
