import { BrickId, parentOf, Wall } from './number-wall';

/**
 * Everything the 3D castle needs to draw one moment of the game. The page owns the game; the
 * world only draws this. Counters (`placed`, `misses`, `bonks`, `casts`) go up once per event so
 * the world can play each burst exactly once.
 */
export interface WallFrame {
  /** Goes up whenever a wall goes up, new or rebuilt: the world restacks its bricks. */
  readonly build: number;
  /** Brick values from the bottom row up. */
  readonly rows: readonly (readonly number[])[];
  readonly missing: readonly BrickId[];
  readonly filled: readonly BrickId[];
  readonly golden: readonly BrickId[];
  readonly selected: BrickId | undefined;
  /** The left brick of the two that make (or complete) the selected brick. */
  readonly pair: BrickId | undefined;
  /** Digits typed so far, shown on the glowing brick. */
  readonly entry: string;
  readonly hinting: boolean;
  readonly combo: boolean;
  readonly built: boolean;
  readonly crumbled: boolean;
  readonly wallsDone: number;
  readonly total: number;
  /** How far down the road the troll is (0..1); undefined when nobody is coming (Cozy). */
  readonly troll: number | undefined;
  readonly trollAsleep: boolean;
  readonly trollBump: boolean;
  readonly cracks: number;
  readonly justFilled: BrickId | undefined;
  readonly placed: number;
  readonly misses: number;
  readonly bonks: number;
  readonly casts: number;
}

/**
 * Where a brick sits in the scene, as percentages of the scene box (its centre and size), so
 * the page can lay a real button over every open brick.
 */
export interface BrickRect {
  readonly build: number;
  readonly row: number;
  readonly col: number;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** The event the world fires on its host whenever the bricks move on screen. */
export const BRICKS_EVENT = 'wallbricks';

/** The left brick of the pair to add for `selected`: below it, or beside it under its parent. */
export function pairFor(wall: Wall, selected: BrickId | undefined): BrickId | undefined {
  if (!selected) return undefined;
  if (selected.row > 0) return { row: selected.row - 1, col: selected.col };
  const above = parentOf(wall, selected);
  return above && { row: 0, col: Math.min(selected.col, above.sibling.col) };
}
