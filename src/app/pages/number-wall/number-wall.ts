/**
 * Pure number-wall puzzle logic. A wall is a pyramid of bricks: each brick above
 * holds the sum of the two bricks it rests on. Rows count from the bottom (row 0).
 */
export type WallLevel = 1 | 2 | 3 | 4;
export interface BrickId {
  readonly row: number;
  readonly col: number;
}
export interface Wall {
  readonly level: WallLevel;
  /** Rows from the bottom up; row 0 is the longest. */
  readonly rows: readonly (readonly number[])[];
  readonly missing: readonly BrickId[];
}
export type Random = () => number;
export const WALLS_PER_WORLD = 5;
export const levels: readonly WallLevel[] = [1, 2, 3, 4];
const MAX_ATTEMPTS = 500;

export function brickKey(brick: BrickId): string {
  return `${brick.row}-${brick.col}`;
}
export function sameBrick(a: BrickId, b: BrickId): boolean {
  return a.row === b.row && a.col === b.col;
}
export function isMissing(wall: Wall, brick: BrickId): boolean {
  return wall.missing.some((missing) => sameBrick(missing, brick));
}
export function valueOf(wall: Wall, brick: BrickId): number {
  return wall.rows[brick.row]![brick.col]!;
}
/** The two bricks a brick rests on, or undefined for the bottom row. */
export function children(brick: BrickId): readonly [BrickId, BrickId] | undefined {
  return brick.row === 0
    ? undefined
    : [
        { row: brick.row - 1, col: brick.col },
        { row: brick.row - 1, col: brick.col + 1 },
      ];
}
/** The brick resting on this brick together with its neighbour, or undefined for the top. */
export function parentOf(
  wall: Wall,
  brick: BrickId,
): { parent: BrickId; sibling: BrickId } | undefined {
  const rowAbove = wall.rows[brick.row + 1];
  if (!rowAbove) return undefined;
  const candidates = [
    {
      parent: { row: brick.row + 1, col: brick.col },
      sibling: { row: brick.row, col: brick.col + 1 },
    },
    {
      parent: { row: brick.row + 1, col: brick.col - 1 },
      sibling: { row: brick.row, col: brick.col - 1 },
    },
  ];
  return candidates.find(({ parent }) => parent.col >= 0 && parent.col < rowAbove.length);
}
function buildRows(bottom: readonly number[]): number[][] {
  const rows: number[][] = [[...bottom]];
  while (rows[rows.length - 1]!.length > 1) {
    const below = rows[rows.length - 1]!;
    rows.push(below.slice(1).map((value, index) => below[index]! + value));
  }
  return rows;
}
export function allBricks(wall: Wall): readonly BrickId[] {
  return wall.rows.flatMap((row, rowIndex) => row.map((_, col) => ({ row: rowIndex, col })));
}
/**
 * Fill unknown bricks by propagating the wall rule until nothing changes.
 * Returns the full wall values if every brick is determined, otherwise undefined.
 */
export function solve(
  rows: readonly (readonly number[])[],
  missing: readonly BrickId[],
): readonly (readonly number[])[] | undefined {
  const known: (number | undefined)[][] = rows.map((row, rowIndex) =>
    row.map((value, col) =>
      missing.some((m) => m.row === rowIndex && m.col === col) ? undefined : value,
    ),
  );
  let changed = true;
  while (changed) {
    changed = false;
    for (let row = 1; row < known.length; row++)
      for (let col = 0; col < known[row]!.length; col++) {
        const top = known[row]![col];
        const left = known[row - 1]![col];
        const right = known[row - 1]![col + 1];
        if (top === undefined && left !== undefined && right !== undefined) {
          known[row]![col] = left + right;
          changed = true;
        } else if (left === undefined && top !== undefined && right !== undefined) {
          known[row - 1]![col] = top - right;
          changed = true;
        } else if (right === undefined && top !== undefined && left !== undefined) {
          known[row - 1]![col + 1] = top - left;
          changed = true;
        }
      }
  }
  return known.every((row) => row.every((value) => value !== undefined))
    ? known.map((row) => row.map((value) => value!))
    : undefined;
}
export function isSolvable(wall: Wall): boolean {
  return solve(wall.rows, wall.missing) !== undefined;
}
function randomInt(random: Random, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}
function pick<T>(random: Random, items: readonly T[]): T {
  return items[Math.min(items.length - 1, Math.floor(random() * items.length))]!;
}
export interface LevelRules {
  readonly rowCount: 2 | 3;
  readonly maxBottom: number;
  readonly maxTop: number;
  readonly missingCount: 1 | 2;
}
export function rulesFor(level: WallLevel): LevelRules {
  return level <= 2
    ? { rowCount: 2, maxBottom: 10, maxTop: 20, missingCount: 1 }
    : { rowCount: 3, maxBottom: 10, maxTop: 30, missingCount: level === 3 ? 1 : 2 };
}
function chooseMissing(
  level: WallLevel,
  rows: readonly (readonly number[])[],
  random: Random,
): BrickId[] {
  const top = { row: rows.length - 1, col: 0 };
  if (level === 1) return [top];
  if (level === 2) return [{ row: 0, col: randomInt(random, 0, 1) }];
  const bricks = rows.flatMap((row, rowIndex) => row.map((_, col) => ({ row: rowIndex, col })));
  if (level === 3) return [pick(random, bricks)];
  const bottom = pick(
    random,
    bricks.filter((brick) => brick.row === 0),
  );
  const other = pick(
    random,
    bricks.filter((brick) => !sameBrick(brick, bottom)),
  );
  return [bottom, other];
}
/** Deterministic for a given random source; always returns a uniquely solvable wall. */
export function generateWall(level: WallLevel, random: Random = Math.random): Wall {
  const rules = rulesFor(level);
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const bottom = Array.from({ length: rules.rowCount }, () =>
      randomInt(random, 0, rules.maxBottom),
    );
    if (bottom.filter((value) => value === 0).length > 1 || bottom.every((value) => value < 2))
      continue;
    const rows = buildRows(bottom);
    if (rows[rows.length - 1]![0]! > rules.maxTop) continue;
    const wall: Wall = { level, rows, missing: chooseMissing(level, rows, random) };
    if (isSolvable(wall)) return wall;
  }
  // Every level has plenty of valid walls; this fallback keeps the type honest.
  const rows = buildRows(rules.rowCount === 2 ? [4, 7] : [3, 4, 5]);
  return { level, rows, missing: [{ row: rows.length - 1, col: 0 }] };
}
/** Avoid showing the same wall twice in a row within a world. */
export function generateWorld(level: WallLevel, random: Random = Math.random): readonly Wall[] {
  const walls: Wall[] = [];
  while (walls.length < WALLS_PER_WORLD) {
    const wall = generateWall(level, random);
    const previous = walls[walls.length - 1];
    if (previous && previous.rows[0]!.join() === wall.rows[0]!.join()) continue;
    walls.push(wall);
  }
  return walls;
}
export type Hint =
  | { readonly kind: 'add'; readonly left: number; readonly right: number; readonly sum: number }
  | {
      readonly kind: 'complete';
      readonly known: number;
      readonly target: number;
      readonly answer: number;
    }
  | { readonly kind: 'fillOther' };
/**
 * Explain how to find one brick from the bricks that are currently visible.
 * `filled` lists missing bricks the player has already solved.
 */
export function hintFor(wall: Wall, brick: BrickId, filled: readonly BrickId[]): Hint {
  const visible = (id: BrickId) => !isMissing(wall, id) || filled.some((f) => sameBrick(f, id));
  const below = children(brick);
  if (below && visible(below[0]) && visible(below[1]))
    return {
      kind: 'add',
      left: valueOf(wall, below[0]),
      right: valueOf(wall, below[1]),
      sum: valueOf(wall, brick),
    };
  const above = parentOf(wall, brick);
  if (above && visible(above.parent) && visible(above.sibling))
    return {
      kind: 'complete',
      known: valueOf(wall, above.sibling),
      target: valueOf(wall, above.parent),
      answer: valueOf(wall, brick),
    };
  return { kind: 'fillOther' };
}
/** Missing bricks in the order a child would naturally fill them: bottom row first. */
export function fillOrder(wall: Wall): readonly BrickId[] {
  return [...wall.missing].sort((a, b) => a.row - b.row || a.col - b.col);
}
export function seededRandom(seed: number): Random {
  let state = seed >>> 0 || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/* Game pacing and rewards */
export type Pace = 'relaxed' | 'steady' | 'quick';
export const paces: readonly Pace[] = ['relaxed', 'steady', 'quick'];
export const DUST_EVERY = 3;
export const MAX_DUST = 3;
export const FREEZE_MS = 8000;
/** Seconds until the troll reaches the wall, or undefined when nobody is coming. */
export function trollSeconds(pace: Pace, missingCount: number): number | undefined {
  if (pace === 'relaxed') return undefined;
  const base = pace === 'steady' ? 40 : 20;
  return base + (missingCount - 1) * base * 0.5;
}
export interface WallOutcome {
  readonly misses: number;
  /** Troll progress (0..1) when the wall was finished; ignored when untimed. */
  readonly trollProgress?: number;
}
/** 1 gem for building, +1 for no misses, +1 for beating the troll to the halfway mark. */
export function gemsFor(outcome: WallOutcome): number {
  let gems = 1;
  if (outcome.misses === 0) gems++;
  if (outcome.trollProgress !== undefined && outcome.trollProgress < 0.5) gems++;
  return gems;
}
export function isFast(outcome: WallOutcome): boolean {
  return outcome.trollProgress !== undefined && outcome.trollProgress < 0.5;
}
export function maxGems(timed: boolean): number {
  return WALLS_PER_WORLD * (timed ? 3 : 2);
}
export type Rating = 1 | 2 | 3;
export function ratingFor(gems: number, timed: boolean): Rating {
  const ratio = gems / maxGems(timed);
  return ratio >= 0.8 ? 3 : ratio >= 0.5 ? 2 : 1;
}
