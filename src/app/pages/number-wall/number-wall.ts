/**
 * Pure number-wall puzzle logic. A wall is a pyramid of bricks: each brick above
 * holds the sum of the two bricks it rests on. Rows count from the bottom (row 0).
 */
/** Level numbers are saved with star ratings, so a level keeps its number when the list grows. */
export type WallLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;
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
/** The usual number of walls in a level; quick small walls come in longer runs. */
export const WALLS_PER_WORLD = 5;
export type WallGroup = 'wallsSmall' | 'wallsThree' | 'wallsFour';
/** Which bricks are hidden: the top, one bottom brick, any one brick, everything above the
 * bottom row (build it up), or one bottom brick plus others (work up and down). */
export type MissingPattern = 'top' | 'bottom' | 'any' | 'buildUp' | 'mixed';
export interface LevelRules {
  /** Bricks in the bottom row, which is also the number of rows. */
  readonly rowCount: 2 | 3 | 4;
  readonly minBottom: number;
  readonly maxBottom: number;
  readonly maxTop: number;
  /** Bottom bricks are whole tens: 30 and 40 make 70. */
  readonly tens?: boolean;
  readonly pattern: MissingPattern;
  /** Hidden bricks for the `any` and `mixed` patterns. */
  readonly missingCount: number;
  /** Walls in one run of this level: about two to four minutes of building. */
  readonly walls: number;
  readonly group: WallGroup;
}
const RULES: Readonly<Record<WallLevel, LevelRules>> = {
  5: {
    rowCount: 2,
    minBottom: 0,
    maxBottom: 5,
    maxTop: 10,
    pattern: 'top',
    missingCount: 1,
    walls: 8,
    group: 'wallsSmall',
  },
  1: {
    rowCount: 2,
    minBottom: 0,
    maxBottom: 10,
    maxTop: 20,
    pattern: 'top',
    missingCount: 1,
    walls: 8,
    group: 'wallsSmall',
  },
  2: {
    rowCount: 2,
    minBottom: 0,
    maxBottom: 10,
    maxTop: 20,
    pattern: 'bottom',
    missingCount: 1,
    walls: 8,
    group: 'wallsSmall',
  },
  6: {
    rowCount: 2,
    minBottom: 1,
    maxBottom: 9,
    maxTop: 100,
    tens: true,
    pattern: 'any',
    missingCount: 1,
    walls: 8,
    group: 'wallsSmall',
  },
  7: {
    rowCount: 3,
    minBottom: 0,
    maxBottom: 5,
    maxTop: 20,
    pattern: 'buildUp',
    missingCount: 3,
    walls: 6,
    group: 'wallsThree',
  },
  3: {
    rowCount: 3,
    minBottom: 0,
    maxBottom: 10,
    maxTop: 30,
    pattern: 'any',
    missingCount: 1,
    walls: 6,
    group: 'wallsThree',
  },
  4: {
    rowCount: 3,
    minBottom: 0,
    maxBottom: 10,
    maxTop: 30,
    pattern: 'mixed',
    missingCount: 2,
    walls: 5,
    group: 'wallsThree',
  },
  8: {
    rowCount: 3,
    minBottom: 2,
    maxBottom: 30,
    maxTop: 100,
    pattern: 'mixed',
    missingCount: 2,
    walls: 5,
    group: 'wallsThree',
  },
  9: {
    rowCount: 4,
    minBottom: 0,
    maxBottom: 5,
    maxTop: 40,
    pattern: 'buildUp',
    missingCount: 6,
    walls: 4,
    group: 'wallsFour',
  },
  10: {
    rowCount: 4,
    minBottom: 0,
    maxBottom: 6,
    maxTop: 50,
    pattern: 'mixed',
    missingCount: 3,
    walls: 4,
    group: 'wallsFour',
  },
  11: {
    rowCount: 4,
    minBottom: 1,
    maxBottom: 15,
    maxTop: 100,
    pattern: 'mixed',
    missingCount: 3,
    walls: 4,
    group: 'wallsFour',
  },
};
/** Every level in play order, easiest first. Levels 1 to 4 are the original four. */
export const levels: readonly WallLevel[] = [5, 1, 2, 6, 7, 3, 4, 8, 9, 10, 11];
/** Where a level sits in the list, from 1. */
export function levelPosition(level: WallLevel): number {
  return levels.indexOf(level) + 1;
}
/** The level after this one in play order, if there is one. */
export function levelAfter(level: WallLevel): WallLevel | undefined {
  return levels[levels.indexOf(level) + 1];
}
export function wallsFor(level: WallLevel): number {
  return RULES[level].walls;
}
export function isWallLevel(value: unknown): value is WallLevel {
  return typeof value === 'number' && levels.includes(value as WallLevel);
}
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
export function rulesFor(level: WallLevel): LevelRules {
  return RULES[level];
}
function chooseMissing(
  rules: LevelRules,
  rows: readonly (readonly number[])[],
  random: Random,
): BrickId[] {
  const bricks = rows.flatMap((row, rowIndex) => row.map((_, col) => ({ row: rowIndex, col })));
  switch (rules.pattern) {
    case 'top':
      return [{ row: rows.length - 1, col: 0 }];
    case 'bottom':
      return [{ row: 0, col: randomInt(random, 0, rows[0]!.length - 1) }];
    case 'buildUp':
      return bricks.filter((brick) => brick.row > 0);
    case 'any':
      return [pick(random, bricks)];
    case 'mixed': {
      const chosen = [
        pick(
          random,
          bricks.filter((brick) => brick.row === 0),
        ),
      ];
      while (chosen.length < rules.missingCount) {
        const other = pick(
          random,
          bricks.filter((brick) => !chosen.some((taken) => sameBrick(taken, brick))),
        );
        chosen.push(other);
      }
      return chosen;
    }
  }
}
/** Deterministic for a given random source; always returns a uniquely solvable wall. */
export function generateWall(level: WallLevel, random: Random = Math.random): Wall {
  const rules = rulesFor(level);
  const scale = rules.tens ? 10 : 1;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const bottom = Array.from(
      { length: rules.rowCount },
      () => randomInt(random, rules.minBottom, rules.maxBottom) * scale,
    );
    if (
      bottom.filter((value) => value === 0).length > 1 ||
      bottom.every((value) => value < 2 * scale)
    )
      continue;
    const rows = buildRows(bottom);
    if (rows[rows.length - 1]![0]! > rules.maxTop) continue;
    const wall: Wall = { level, rows, missing: chooseMissing(rules, rows, random) };
    if (isSolvable(wall)) return wall;
  }
  // Every level has plenty of valid walls; this fallback keeps the type honest.
  const rows = buildRows([3, 4, 5, 2].slice(0, rules.rowCount));
  return { level, rows, missing: [{ row: rows.length - 1, col: 0 }] };
}
/** Avoid showing the same wall twice in a row within a world. */
export function generateWorld(level: WallLevel, random: Random = Math.random): readonly Wall[] {
  const walls: Wall[] = [];
  while (walls.length < wallsFor(level)) {
    const wall = generateWall(level, random);
    const previous = walls[walls.length - 1];
    if (previous && previous.rows[0]!.join() === wall.rows[0]!.join()) continue;
    walls.push(wall);
  }
  return walls;
}
export type Hint =
  | { readonly kind: 'add'; readonly left: number; readonly right: number }
  | { readonly kind: 'complete'; readonly known: number; readonly target: number }
  | { readonly kind: 'fillOther' };
/**
 * Explain how to find one brick from the bricks that are currently visible. A hint names the
 * rule and the two bricks it uses, never the brick's own value: the child does the maths.
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
    };
  const above = parentOf(wall, brick);
  if (above && visible(above.parent) && visible(above.sibling))
    return {
      kind: 'complete',
      known: valueOf(wall, above.sibling),
      target: valueOf(wall, above.parent),
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
/** Head-butts the wall survives before it tumbles and has to be rebuilt. */
export const MAX_HEARTS = 3;
/** How long the troll stays stunned after a head-butt while he staggers back to the road's start. */
export const STAGGER_MS = 1400;
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
export function maxGems(timed: boolean, walls = WALLS_PER_WORLD): number {
  return walls * (timed ? 3 : 2);
}
export type Rating = 1 | 2 | 3;
export function ratingFor(gems: number, timed: boolean, walls = WALLS_PER_WORLD): Rating {
  const ratio = gems / maxGems(timed, walls);
  return ratio >= 0.8 ? 3 : ratio >= 0.5 ? 2 : 1;
}
