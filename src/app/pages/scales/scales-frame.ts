import type { ItemId } from './scales-levels';
import type { Dial } from './scales-math';

/** One thing drawn on a pan. Labels arrive already written in the child's language. */
export interface PanThing {
  readonly kind: 'item' | 'weight' | 'mystery' | 'sack';
  readonly item: ItemId | null;
  /** 0 to 1: how big a weight looks next to the biggest one on offer. */
  readonly size: number;
  /** "5 kg", "?" or empty for an ingredient whose weight is the question. */
  readonly label: string;
  /** Put there by the child, so it can drop in with a little bounce. */
  readonly added: boolean;
}

export interface DialView {
  readonly dial: Dial;
  readonly value: number;
  /** The numbers round the face, one per labelled mark, with the unit on the last. */
  readonly labels: readonly string[];
  readonly unit: string;
  readonly item: ItemId;
}

export interface PotView {
  readonly capacity: number;
  readonly target: number;
  readonly filled: number;
  /** The line's label, like "1,5 l". */
  readonly line: string;
  readonly item: ItemId;
  readonly jugs: readonly { readonly amount: number; readonly label: string }[];
  /** The jug that poured last, so the world can tip it. */
  readonly lastJug: number;
}

/** What Bramble's kitchen draws: plain state from the game, never decisions. */
export interface ScalesFrame {
  /** Which recipe line this is, so the scene starts each line fresh. */
  readonly line: number;
  readonly mode: 'balance' | 'dial' | 'pour';
  readonly left: readonly PanThing[];
  readonly right: readonly PanThing[];
  /** Where the beam settles, in radians: positive tips the left pan down. */
  readonly tilt: number;
  /** Bramble's hand steadies the beam. */
  readonly held: boolean;
  readonly dial: DialView | null;
  readonly pot: PotView | null;
  /** How full the giant pot is: one share per cooked line. */
  readonly soup: number;
  /** The soup's colour for this level's dish. */
  readonly soupColor: string;
  /** Share of the soup timer left, or null with no timer. */
  readonly timer: number | null;
  /** The timer ran out: the soup bubbled over. */
  readonly bubbling: boolean;
  /** Three first tries in a row: the pot glows gold. */
  readonly golden: boolean;
  /** The last line of the round, the feast dish. */
  readonly feast: boolean;
  /** The feast table: one plate per level, true once that level's dish was cooked. */
  readonly dishes: readonly boolean[];
  readonly finished: boolean;
  /** Bramble's face: waiting, pleased with a level beam, or "oops" when it tipped. */
  readonly mood: 'wait' | 'happy' | 'oops';
  /** Counters that go up once per event, so the scene can play a burst. */
  readonly cooks: number;
  readonly slips: number;
  readonly adds: number;
  readonly pours: number;
}

/** Each level's dish on the feast table, and the colour its soup turns. */
export const DISHES: readonly { readonly color: string; readonly top: string }[] = [
  { color: '#c0392b', top: '#f6d3a1' },
  { color: '#e8892b', top: '#f6b26b' },
  { color: '#a0703c', top: '#d9b27c' },
  { color: '#e2b93b', top: '#fff1b8' },
  { color: '#d4a017', top: '#ffd76a' },
  { color: '#c98a45', top: '#f3d29b' },
  { color: '#58a55c', top: '#b6e3a8' },
  { color: '#8d6e63', top: '#d7c2b0' },
  { color: '#e67e22', top: '#fbe0c3' },
  { color: '#f3eadb', top: '#ffffff' },
  { color: '#8e2c6f', top: '#d67ab1' },
  { color: '#e2467c', top: '#ffd1e1' },
];

/** What each ingredient looks like, for the 3D world and the flat picture alike. */
export const ITEM_LOOKS: Readonly<
  Record<ItemId, { readonly color: string; readonly size: number }>
> = {
  pumpkin: { color: '#e8892b', size: 1 },
  melon: { color: '#5c9e3d', size: 0.85 },
  cabbage: { color: '#8cc06a', size: 0.8 },
  potatoes: { color: '#a77b4b', size: 0.9 },
  cheese: { color: '#f2c23a', size: 0.75 },
  flour: { color: '#efe6d2', size: 0.85 },
  carrots: { color: '#ef7d23', size: 0.75 },
  apples: { color: '#d6372f', size: 0.8 },
  butter: { color: '#f7dc6f', size: 0.55 },
  berries: { color: '#4b4fa6', size: 0.6 },
  honey: { color: '#e3a018', size: 0.55 },
  nuts: { color: '#9c6a3a', size: 0.6 },
  pillow: { color: '#f4f1fb', size: 1 },
  rock: { color: '#7d8590', size: 0.5 },
  salt: { color: '#b98ee0', size: 0.6 },
  water: { color: '#7fc4ef', size: 0.8 },
  milk: { color: '#fbfaf5', size: 0.8 },
  juice: { color: '#c2357a', size: 0.8 },
};

/** Where one thing sits on a pan 100 units wide: its centre, its bottom and its size. */
export interface Placed {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** How big a thing is on a pan 100 units wide. */
export function thingSize(thing: PanThing): { w: number; h: number } {
  switch (thing.kind) {
    case 'item': {
      const size = thing.item ? ITEM_LOOKS[thing.item].size : 0.8;
      return { w: 30 + 26 * size, h: 24 + 22 * size };
    }
    case 'weight':
      return { w: 19 + 17 * thing.size, h: 17 + 15 * thing.size };
    case 'mystery':
      return { w: 24, h: 22 };
    case 'sack':
      return { w: 22, h: 24 };
  }
}

/**
 * Lays things on a pan in rows from the bottom up, each row centred, so the 3D pans and the flat
 * picture stack the same way.
 */
export function stackPan(things: readonly PanThing[], width = 96): Placed[] {
  const sizes = things.map(thingSize);
  const placed: Placed[] = [];
  let row: { w: number; h: number; index: number }[] = [];
  let bottom = 0;
  const flush = () => {
    const total = row.reduce((sum, item) => sum + item.w, 0);
    let x = -total / 2;
    for (const item of row) {
      placed[item.index] = { x: x + item.w / 2, y: bottom, w: item.w, h: item.h };
      x += item.w;
    }
    bottom += Math.max(0, ...row.map((item) => item.h)) * 0.92;
    row = [];
  };
  sizes.forEach((size, index) => {
    const used = row.reduce((sum, item) => sum + item.w, 0);
    if (row.length && used + size.w > width) flush();
    row.push({ ...size, index });
  });
  if (row.length) flush();
  return placed;
}
