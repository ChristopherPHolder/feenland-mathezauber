/** One bottle on Olli's shelf. The id stays the same while the bottle is on the shelf. */
export interface FrameBottle {
  readonly id: number;
  readonly value: number;
}

/** What the cauldron scene draws: plain state from the game, never decisions. */
export interface PotionFrame {
  /** Which potion of the round this is, so the scene can start each potion fresh. */
  readonly potion: number;
  readonly target: number;
  readonly bottles: readonly FrameBottle[];
  /** The bottle picked to pour first, if any. */
  readonly picked: number | null;
  readonly brewed: boolean;
  readonly fizzing: boolean;
  readonly big: boolean;
  readonly fever: boolean;
  readonly sparkle: 'none' | 'shining' | 'faded';
  /** Counters that go up once per event, so the scene can play a burst. */
  readonly mixes: number;
  readonly fizzles: number;
  readonly brews: number;
}

/** Liquid colours for the bottles, picked by bottle id so a bottle keeps its colour. */
export const LIQUIDS = ['#e0457b', '#3d8fe0', '#3fa65a', '#e89a1c', '#8a5cc7', '#1f9e95'];

export function liquid(id: number): string {
  return LIQUIDS[id % LIQUIDS.length];
}

/** Where bottle `index` of `count` stands along the shelf, from 0 (left) to 1 (right). */
export function shelfSpot(index: number, count: number): number {
  return count <= 1 ? 0.5 : 0.14 + (0.72 * index) / (count - 1);
}
