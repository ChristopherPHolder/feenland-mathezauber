import type { GondolaKind, Move, Representation } from './gondola-levels';

export type GondolaPhase = 'split' | 'moving' | 'answer' | 'solved' | 'complete';

/**
 * What the gondola scenes draw: plain state from the game, never decisions. The 3D mountain
 * and the flat fallback both read it, and both lay out the cabins with `sceneLayout`.
 */
export interface GondolaFrame {
  /** Which turn of the round this is, so a scene starts each turn fresh. */
  readonly turn: number;
  readonly kind: GondolaKind;
  /** Full tens of the first number: up the cable (adding) or parked full cabins (taking away). */
  readonly tens: number;
  /** Bunnies in the boarding cabin (adding) or standing loose on the platform (taking away). */
  readonly cabin: number;
  /** Full tens of the second number, which ride whole. */
  readonly groupTens: number;
  /** The group being split: waiting bunnies (adding) or bunnies needed below (taking away). */
  readonly group: number;
  /** Where the split handle stands: how many of the group go first (0 = not split yet). */
  readonly split: number;
  readonly phase: GondolaPhase;
  /** The accepted move once the split is done. */
  readonly move: Move | null;
  /** Express: full cabins sent, and bunnies who hop off (−) or back on (+). */
  readonly expressCabins: number;
  readonly fix: number;
  /** How the cabins look on this turn, with "Show the bunnies" already applied. */
  readonly representation: Representation;
  /** The snow tarp hides the bunnies; numbers and seats stay visible. */
  readonly tarp: boolean;
  /** The golden express streak is on: the cabin is gold with its own bell. */
  readonly golden: boolean;
  /** This turn's group has the crowned VIP bunny. */
  readonly vip: boolean;
  /** The big summit cabin that ends the round. */
  readonly big: boolean;
  /** How far the snow cloud has drifted toward the platform, 0 to 1 (0 without a pace). */
  readonly cloud: number;
  readonly cocoa: 'none' | 'warm' | 'cold';
  /** Lanterns lit along the path this round: one per delivered turn. */
  readonly lanterns: number;
  /** Buildings in the summit village, one per finished level; they stay. */
  readonly village: number;
  /** Help on screen: the empty seats glow, or both cabins pulse. */
  readonly help: 'none' | 'seats' | 'pulse';
  /** Counters that go up once per event, so a scene can play it once. */
  readonly hops: number;
  readonly bounces: number;
  readonly jams: number;
  readonly cheers: number;
  readonly slips: number;
  readonly colds: number;
}

/** Where every cabin and bunny stands right now. */
export interface SceneLayout {
  /** Full "10" cabins up the cable toward the summit. */
  readonly up: number;
  /** How many of `up` left on this turn: they wear the golden edge. */
  readonly freshUp: number;
  /** Full cabins standing at the station (the group's tens, or the tens to take from). */
  readonly parked: number;
  /** Cabins sent down the mountain on this turn. */
  readonly down: number;
  /** Bunnies in the boarding cabin at the platform, or null when there is none. */
  readonly boarding: number | null;
  /** Taking away: bunnies left in the full cabin that was opened. */
  readonly opened: number | null;
  /** Taking away: bunnies standing loose on the platform. */
  readonly loose: number;
  /** Adding: the group still waiting on the platform, split at `split`. */
  readonly waiting: number;
  /** Taking away: how many bunnies the valley still needs (before the move). */
  readonly ticket: number;
  /** Express: bunnies who hopped off (adding) or back on (taking away). */
  readonly hopped: number;
  /** Is the move done, so the scene shows the result to read? */
  readonly moved: boolean;
}

export function sceneLayout(frame: GondolaFrame): SceneLayout {
  const moved = frame.move !== null && frame.phase !== 'split';
  const base: SceneLayout = {
    up: 0,
    freshUp: 0,
    parked: 0,
    down: 0,
    boarding: null,
    opened: null,
    loose: 0,
    waiting: 0,
    ticket: 0,
    hopped: 0,
    moved,
  };
  const { tens, cabin, groupTens, group } = frame;
  if (frame.kind === 'add') {
    if (!moved) return { ...base, up: tens, parked: groupTens, boarding: cabin, waiting: group };
    if (frame.move === 'express') {
      const cabins = frame.expressCabins;
      return { ...base, up: tens + cabins, freshUp: cabins, boarding: cabin, hopped: -frame.fix };
    }
    return {
      ...base,
      up: tens + groupTens + 1,
      freshUp: groupTens + 1,
      boarding: cabin + group - 10,
    };
  }
  if (!moved) return { ...base, parked: tens, loose: cabin, ticket: 10 * groupTens + group };
  if (frame.move === 'express') {
    const cabins = frame.expressCabins;
    return { ...base, parked: tens - cabins, down: cabins, loose: cabin + frame.fix, hopped: frame.fix };
  }
  if (frame.move === 'takeTen') {
    return {
      ...base,
      parked: tens - 1 - groupTens,
      down: groupTens + 1,
      opened: 10 - group,
      loose: cabin,
    };
  }
  return {
    ...base,
    parked: tens - 1 - groupTens,
    down: groupTens + 1,
    opened: 10 - (group - cabin),
  };
}

/** The number the cabins show once the move is done: what the child reads off the scene. */
export function layoutTotal(layout: SceneLayout, kind: GondolaKind): number {
  return kind === 'add'
    ? 10 * layout.up + (layout.boarding ?? 0) - layout.hopped
    : 10 * layout.parked + (layout.opened ?? 0) + layout.loose;
}

/** Cabin colours along the cable, picked by position so a cabin keeps its colour. */
export const CABIN_COLORS = ['#e0457b', '#3d8fe0', '#3fa65a', '#e89a1c', '#8a5cc7', '#1f9e95'];
/** The colour change after five seats, paired with a gap between the rows (never colour alone). */
export const SEAT_FIRST = '#ffd9e6';
export const SEAT_SECOND = '#d6ecff';
export const GOLDEN = '#ffcf33';
