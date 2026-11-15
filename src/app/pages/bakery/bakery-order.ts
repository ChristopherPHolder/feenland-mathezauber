import { BakeryStage, CutDir, Fact, product, Random } from './bakery-levels';
import { cutPieces, Piece } from './tray-geometry';

/**
 * One order, step by step: cut the tray (or add a ghost row), name each piece, then the total.
 * Pure rules with no timers or sounds, so the game, the specs and the hints share them.
 */
export type OrderPhase = 'cut' | 'ghost' | 'pieces' | 'total' | 'baked';

export interface OrderState {
  readonly fact: Fact;
  /** The tray was turned round: rows and columns swap, the cookies stay the same. */
  readonly turned: boolean;
  readonly dir: CutDir | null;
  readonly cuts: readonly number[];
  readonly ghost: CutDir | null;
  /** What the child named each piece, once right. */
  readonly values: readonly (number | null)[];
  /** The full ghost tray, once named. */
  readonly ghostValue: number | null;
  /** The piece the choices are for. */
  readonly active: number;
  readonly phase: OrderPhase;
  /** Every wrong answer on this order: none keeps it a first-try order. */
  readonly slips: number;
  readonly totalSlips: number;
  /** The first way, while the child tries to cut a baked tray another way. */
  readonly firstWay: string | null;
  readonly secondWay: boolean;
  /** The level's trick was used on the first way. */
  readonly trick: boolean;
}

export type HelpKey =
  | 'pieceOne'
  | 'pieceTwoRows'
  | 'pieceTwoCols'
  | 'pieceFiveRows'
  | 'pieceFiveCols'
  | 'pieceTenRows'
  | 'pieceTenCols'
  | 'pieceRows'
  | 'addedFactors'
  | 'ghostFull'
  | 'onePiece'
  | 'oneTwin'
  | 'ownPieces'
  | 'ownTwins'
  | 'ownGhost'
  | 'lookCard';

/** Help after a wrong answer: it points at the tray's structure, never at the answer. */
export interface Help {
  readonly key: HelpKey;
  readonly values?: Readonly<Record<string, number>>;
  /** The child's own, already right piece values, for "You have 35 and 7". */
  readonly list?: readonly number[];
  /** What pulses on the tray: one piece's rows as a skip-count, every piece, or one row. */
  readonly pulse?: 'rows' | 'pieces' | 'row' | 'ghost';
  readonly piece?: number;
  /** Show the picture card of the trick with other numbers. */
  readonly card?: boolean;
}

export const shownFact = (state: OrderState): Fact =>
  state.turned ? { rows: state.fact.cols, cols: state.fact.rows } : state.fact;

export function orderPieces(state: OrderState): Piece[] {
  const shown = shownFact(state);
  return state.cuts.length
    ? cutPieces(shown.rows, shown.cols, state.dir, state.cuts)
    : [{ rows: shown.rows, cols: shown.cols, row: 0, col: 0 }];
}

export function startOrder(stage: BakeryStage, fact: Fact): OrderState {
  return {
    fact,
    turned: false,
    dir: null,
    cuts: [],
    ghost: null,
    values: [],
    ghostValue: null,
    active: 0,
    phase: stage.cut ? 'cut' : 'total',
    slips: 0,
    totalSlips: 0,
    firstWay: null,
    secondWay: false,
    trick: false,
  };
}

/** Turning is allowed before the first cut: same cookies, rows and columns swap. */
export function canTurn(state: OrderState): boolean {
  return (
    (state.phase === 'cut' || (state.phase === 'total' && !state.cuts.length && !state.ghost)) &&
    !state.cuts.length &&
    !state.ghost &&
    state.fact.rows !== state.fact.cols
  );
}

export function turn(state: OrderState): OrderState {
  return canTurn(state) ? { ...state, turned: !state.turned } : state;
}

/** A cut must run along a gap, between two lines of cookies, in the same direction as any other. */
export function canCut(stage: BakeryStage, state: OrderState, dir: CutDir, at: number): boolean {
  const shown = shownFact(state);
  const size = dir === 'rows' ? shown.rows : shown.cols;
  return (
    state.phase === 'cut' &&
    !state.ghost &&
    Number.isInteger(at) &&
    at >= 1 &&
    at < size &&
    (state.dir === null || state.dir === dir) &&
    !state.cuts.includes(at) &&
    state.cuts.length < (stage.maxCuts || 0)
  );
}

/** The cut, written so that the same cut on a turned tray, or from the other end, matches. */
export function cutSignature(state: OrderState): string {
  if (state.ghost) {
    const dir = state.turned ? flip(state.ghost) : state.ghost;
    return `ghost-${dir}`;
  }
  const dir = state.dir && state.turned ? flip(state.dir) : state.dir;
  const parts = orderPieces(state)
    .map((piece) => (state.dir === 'cols' ? piece.cols : piece.rows))
    .sort((a, b) => a - b);
  return `${dir}-${parts.join('+')}`;
}

const flip = (dir: CutDir): CutDir => (dir === 'rows' ? 'cols' : 'rows');

export type CutResult = 'cut' | 'more' | 'same' | 'invalid';

/**
 * Cuts the tray. It moves on to the pieces once the level's cuts are used up; with cuts left
 * (doubling twice) the child may cut again or go on. A second way must differ from the first.
 */
export function cut(
  stage: BakeryStage,
  state: OrderState,
  dir: CutDir,
  at: number,
): { state: OrderState; result: CutResult } {
  if (!canCut(stage, state, dir, at)) return { state, result: 'invalid' };
  const cutState: OrderState = { ...state, dir, cuts: [...state.cuts, at] };
  if (cutState.cuts.length < stage.maxCuts && cutState.cuts.length < sizeOf(cutState, dir) - 1)
    return { state: cutState, result: 'more' };
  return toPieces(cutState);
}

const sizeOf = (state: OrderState, dir: CutDir) => {
  const shown = shownFact(state);
  return dir === 'rows' ? shown.rows : shown.cols;
};

/** Done cutting: on to naming the pieces. */
export function doneCutting(state: OrderState): { state: OrderState; result: CutResult } {
  if (state.phase !== 'cut' || !state.cuts.length) return { state, result: 'invalid' };
  return toPieces(state);
}

function toPieces(state: OrderState): { state: OrderState; result: CutResult } {
  if (state.firstWay && cutSignature(state) === state.firstWay)
    return { state: { ...state, dir: null, cuts: [] }, result: 'same' };
  const pieces = orderPieces(state);
  return {
    state: { ...state, phase: 'pieces', values: pieces.map(() => null), active: 0 },
    result: 'cut',
  };
}

/** Puts the tray back together before any piece is named, to try another cut. */
export function uncut(state: OrderState): OrderState {
  if ((state.phase !== 'pieces' && state.phase !== 'cut') || state.values.some((v) => v !== null))
    return state;
  return { ...state, phase: 'cut', dir: null, cuts: [], values: [], active: 0 };
}

/** Which line Bruno's ghost row extends: a tray of 4 or 9 becomes a friendly 5 or 10. */
export function ghostDir(stage: BakeryStage, state: OrderState): CutDir | null {
  if (!stage.ghost || state.phase !== 'cut' || state.cuts.length) return null;
  const shown = shownFact(state);
  if (shown.rows === 9 || shown.rows === 4) return 'rows';
  if (shown.cols === 9 || shown.cols === 4) return 'cols';
  return null;
}

export function addGhost(stage: BakeryStage, state: OrderState): OrderState {
  const dir = ghostDir(stage, state);
  if (!dir || state.firstWay === `ghost-${state.turned ? flip(dir) : dir}`) return state;
  return { ...state, ghost: dir, phase: 'ghost' };
}

export function removeGhost(state: OrderState): OrderState {
  return state.phase === 'ghost' ? { ...state, ghost: null, phase: 'cut' } : state;
}

/** The full tray with the ghost line: 10 rows of 6 for a tray of 9 rows of 6. */
export function ghostFact(state: OrderState): Fact | null {
  if (!state.ghost) return null;
  const shown = shownFact(state);
  return state.ghost === 'rows'
    ? { rows: shown.rows + 1, cols: shown.cols }
    : { rows: shown.rows, cols: shown.cols + 1 };
}

/** The line the dragon nibbles: one row (or column) of the tray. */
export function ghostLine(state: OrderState): number {
  const shown = shownFact(state);
  return state.ghost === 'cols' ? shown.rows : shown.cols;
}

export interface Answer {
  readonly state: OrderState;
  readonly right: boolean;
  readonly help?: Help;
  /** Pieces that were named together with this one because they are twins. */
  readonly twins?: number;
}

export function answerGhost(state: OrderState, value: number): Answer {
  const full = ghostFact(state);
  if (state.phase !== 'ghost' || !full) return { state, right: false };
  if (value === product(full))
    return { state: { ...state, ghostValue: value, phase: 'total' }, right: true };
  return {
    state: { ...state, slips: state.slips + 1 },
    right: false,
    help: { ...pieceHelp(full, value)!, pulse: 'ghost' },
  };
}

export function answerPiece(state: OrderState, index: number, value: number): Answer {
  const pieces = orderPieces(state);
  const piece = pieces[index];
  if (state.phase !== 'pieces' || !piece || state.values[index] !== null)
    return { state, right: false };
  if (value !== piece.rows * piece.cols) {
    return {
      state: { ...state, slips: state.slips + 1 },
      right: false,
      help: { ...pieceHelp(piece, value)!, piece: index },
    };
  }
  // Twins share the answer: name one, and its twin lights up too.
  let twins = 0;
  const values = state.values.map((current, at) => {
    if (at === index) return value;
    const other = pieces[at];
    if (current === null && other.rows === piece.rows && other.cols === piece.cols) {
      twins++;
      return value;
    }
    return current;
  });
  const next = values.findIndex((current) => current === null);
  const done = next === -1;
  return {
    state: {
      ...state,
      values,
      active: done ? index : next,
      phase: done ? (state.firstWay ? 'baked' : 'total') : 'pieces',
      secondWay: done && !!state.firstWay ? true : state.secondWay,
    },
    right: true,
    twins,
  };
}

/** Help for naming one piece: it names the rows' pattern, never the number. */
function pieceHelp(piece: { rows: number; cols: number }, value: number): Help | null {
  const { rows, cols } = piece;
  const pulse = 'rows' as const;
  if (rows > 1 && cols > 1 && value === rows + cols && rows + cols !== rows * cols)
    return { key: 'addedFactors', values: { sum: value, a: rows, b: cols }, pulse: 'row' };
  if (rows === 1 || cols === 1) return { key: 'pieceOne', pulse };
  if (cols === 10) return { key: 'pieceTenCols', pulse };
  if (cols === 5) return { key: 'pieceFiveCols', pulse };
  if (cols === 2) return { key: 'pieceTwoCols', pulse };
  if (rows === 10) return { key: 'pieceTenRows', values: { n: cols }, pulse };
  if (rows === 5) return { key: 'pieceFiveRows', values: { n: cols }, pulse };
  if (rows === 2) return { key: 'pieceTwoRows', pulse };
  return { key: 'pieceRows', values: { n: cols }, pulse };
}

export function answerTotal(state: OrderState, value: number): Answer {
  if (state.phase !== 'total') return { state, right: false };
  const shown = shownFact(state);
  if (value === product(shown)) return { state: { ...state, phase: 'baked' }, right: true };
  const help = totalHelp(state, value);
  // Only slips the game cannot explain move the help on to the recipe card.
  const known = ['addedFactors', 'ghostFull', 'onePiece', 'oneTwin'].includes(help.key);
  const slipped: OrderState = {
    ...state,
    slips: state.slips + 1,
    totalSlips: state.totalSlips + (known ? 0 : 1),
  };
  return { state: slipped, right: false, help };
}

/**
 * Escalating help for a wrong total. Known mistakes get their own prompt: adding the factors,
 * giving only one piece, or forgetting the nibbled row. Otherwise the first slip restates the
 * child's own piece values and the next ones show the picture card with other numbers.
 */
function totalHelp(state: OrderState, value: number): Help {
  const shown = shownFact(state);
  const values = state.values.filter((v): v is number => v !== null);
  if (
    shown.rows > 1 &&
    shown.cols > 1 &&
    value === shown.rows + shown.cols &&
    shown.rows + shown.cols !== product(shown)
  )
    return {
      key: 'addedFactors',
      values: { sum: value, a: shown.rows, b: shown.cols },
      pulse: 'row',
    };
  if (state.ghost && value === state.ghostValue) return { key: 'ghostFull', pulse: 'ghost' };
  if (values.length > 1 && values.includes(value)) {
    const twins = values.every((v) => v === values[0]);
    return { key: twins ? 'oneTwin' : 'onePiece', pulse: 'pieces' };
  }
  if (state.totalSlips === 0) {
    if (state.ghost && state.ghostValue !== null)
      return {
        key: 'ownGhost',
        values: { full: state.ghostValue, line: ghostLine(state) },
        pulse: 'ghost',
      };
    if (values.length > 1) {
      const twins = values.every((v) => v === values[0]);
      return twins
        ? { key: 'ownTwins', values: { n: values.length, v: values[0] }, pulse: 'pieces' }
        : { key: 'ownPieces', list: values, pulse: 'pieces' };
    }
    return { ...pieceHelp(shown, value)!, piece: 0 };
  }
  return { key: 'lookCard', card: true };
}

/** Starts cutting a baked tray another way, for the flexibility bonus. */
export function tryAnotherWay(state: OrderState): OrderState {
  if (state.phase !== 'baked' || state.firstWay || (!state.cuts.length && !state.ghost))
    return state;
  return {
    ...state,
    firstWay: cutSignature(state),
    phase: 'cut',
    dir: null,
    cuts: [],
    ghost: null,
    values: [],
    active: 0,
  };
}

/** Whether the cut made is the level's trick. */
export function usedTrick(stage: BakeryStage, state: OrderState): boolean {
  if (stage.trick === 'turn') return state.turned;
  if (stage.trick === 'read') return false;
  if (state.ghost) return stage.trick === 'ghost' || stage.trick === 'free';
  if (!state.dir || !state.cuts.length) return false;
  const shown = shownFact(state);
  const size = state.dir === 'rows' ? shown.rows : shown.cols;
  const parts = orderPieces(state)
    .map((piece) => (state.dir === 'rows' ? piece.rows : piece.cols))
    .sort((a, b) => a - b);
  const equal = parts.every((part) => part === parts[0]);
  if (stage.trick === 'free')
    return (equal && parts.length > 1) || parts.every((part) => [1, 2, 5, 10].includes(part));
  if (size !== stage.table) return false;
  if (stage.trick === 'oneMore') return parts.length === 2 && parts[0] === 1;
  if (stage.trick === 'fiveSplit') return parts.length === 2 && parts.includes(5);
  if (stage.trick === 'double')
    return (
      (equal && (parts.length === 2 || parts.length === 4)) ||
      (parts.length === 3 &&
        parts[0] === size / 4 &&
        parts[1] === size / 4 &&
        parts[2] === size / 2)
    );
  return false;
}

/** The gaps that glow for the level's trick: a suggestion, any cut along a gap is fine. */
export function guideGaps(
  stage: BakeryStage,
  state: OrderState,
): { dir: CutDir; gaps: number[] } | null {
  if (state.phase !== 'cut' || !stage.table || state.firstWay) return null;
  const shown = shownFact(state);
  const dir: CutDir | null =
    shown.rows === stage.table ? 'rows' : shown.cols === stage.table ? 'cols' : null;
  if (!dir || (state.dir && state.dir !== dir)) return null;
  const t = stage.table;
  const gaps =
    stage.trick === 'oneMore'
      ? [t - 1]
      : stage.trick === 'fiveSplit'
        ? [5]
        : stage.trick === 'double'
          ? state.cuts.length
            ? [t / 4, (3 * t) / 4].filter(Number.isInteger)
            : [t / 2]
          : [];
  const open = gaps.filter((gap) => !state.cuts.includes(gap));
  return open.length ? { dir, gaps: open } : null;
}

/** Four big choices for a piece: the product, a row too many or few, and the added factors. */
export function pieceChoices(piece: Fact, random: Random = Math.random): number[] {
  const { rows, cols } = piece;
  const answer = rows * cols;
  const near = [
    rows > 1 && cols > 1 ? rows + cols : 0,
    answer + cols,
    answer - cols,
    answer + rows,
    answer - rows,
    answer + 1,
    answer - 1,
    answer + 10,
    answer * 2,
  ];
  const picked: number[] = [];
  for (const value of near) {
    if (picked.length === 3) break;
    if (value > 0 && value !== answer && !picked.includes(value) && value <= 120)
      picked.push(value);
  }
  // Keep the added factors and one near miss, and shuffle where the answer sits.
  const choices = [answer, ...picked];
  for (let index = choices.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [choices[index], choices[other]] = [choices[other], choices[index]];
  }
  return choices;
}

/** The picture card: the level's trick worked through with other numbers than the order's. */
export interface TrickCard {
  readonly rows: number;
  readonly cols: number;
  /** Row parts the card's tray is cut into; a negative part is a nibbled ghost row. */
  readonly parts: readonly number[];
}

export function trickCard(stage: BakeryStage, state: OrderState): TrickCard {
  const shown = shownFact(state);
  const avoid = new Set([shown.rows, shown.cols]);
  const total = product(shown);
  const rowsFor = (): number => {
    if (stage.table)
      return stage.table === shown.rows || stage.table === shown.cols ? stage.table : shown.rows;
    return shown.rows >= 3 ? shown.rows : 6;
  };
  let rows =
    stage.trick === 'read' || stage.trick === 'turn' ? (shown.rows === 4 ? 3 : 4) : rowsFor();
  if (state.ghost) rows = shownFact(state).rows === 4 || shownFact(state).cols === 4 ? 4 : 9;
  const cols =
    [4, 3, 6, 8, 7, 2, 9, 5].find((value) => !avoid.has(value) && rows * value !== total) ?? 4;
  const parts: number[] =
    state.ghost || stage.trick === 'ghost'
      ? [rows + 1, -1]
      : stage.trick === 'read' || stage.trick === 'turn'
        ? [rows]
        : stage.trick === 'oneMore'
          ? [rows - 1, 1]
          : stage.trick === 'double' && rows % 2 === 0
            ? [rows / 2, rows / 2]
            : rows > 5
              ? [5, rows - 5]
              : rows > 2
                ? [2, rows - 2]
                : [1, rows - 1];
  return { rows, cols, parts };
}
