import type { ConstellationId } from './star-constellations';

/**
 * Where the bridge sits on the board, as shares of the board's box: its left and right posts,
 * and its walkway measured from the top. The 3D camera frames the bridge onto exactly these
 * spots and the flat fallback draws it there, so the DOM slider laid over the board lines up
 * with the bridge in both.
 */
export const BRIDGE = { left: 0.08, right: 0.92, y: 0.78 } as const;

/** A post on the bridge. `at` runs from 0 (left post) to 1 (right post). */
export interface FrameTick {
  readonly at: number;
  /** The number on the post, "?" on a mystery bridge's far post, or null for a plain post. */
  readonly label: string | null;
  /** A faded post the help card brings back for this star: no number, drawn faint. */
  readonly hint: boolean;
}

/** What the night-sky scene draws: plain state from the game, never decisions. */
export interface StarFrame {
  /** Which star of the round this is; a new value starts the next star fresh. */
  readonly item: number;
  readonly kind: 'place' | 'landed' | 'compare';
  readonly ticks: readonly FrameTick[];
  /** What the falling star carries ("63", "38 + 25", "40 ↔ 60"); empty for a landed star. */
  readonly label: string;
  /** The two labels of a "which is further?" pair. */
  readonly pair: readonly [string, string] | null;
  /** Where a landed star lies on the bridge, or the pair's spots once answered. */
  readonly landed: readonly number[];
  /** Where Nova's lantern net is on the bridge, from 0 to 1. */
  readonly net: number;
  /** How far the star has fallen, from 0 (top of the sky) to 1 (just above the bridge). */
  readonly fall: number;
  /** The falling star hovers instead (No rush). */
  readonly hover: boolean;
  /** Stardust left on the star, from 0 to 1: the trail is this long and bright. */
  readonly stardust: number;
  /** Something is happening between stars: the star is flying in, bouncing or done. */
  readonly phase: 'falling' | 'caught' | 'bounced' | 'complete';
  /** The last catch landed dead on: the star turned gold. */
  readonly golden: boolean;
  /** Three first-try catches in a row: the lantern has a comet trail. */
  readonly comet: boolean;
  /** One of the three shooting stars of the finale. */
  readonly finale: boolean;
  /** Shooting stars still waiting in the sky behind this one. */
  readonly queued: number;
  /** Points the last catch won, for the label that rises from the lantern. */
  readonly gain: number;
  /** This level's constellation and how many of its points are lit. */
  readonly constellation: ConstellationId;
  readonly lit: number;
  readonly complete: boolean;
  /** Constellations finished on earlier visits, drawn faintly around the sky. */
  readonly collection: readonly ConstellationId[];
  /** Counters that go up once per event, so the scene can play a burst. */
  readonly catches: number;
  readonly goldens: number;
  readonly bounces: number;
  /** The star's stardust ran out as it reached the bridge. */
  readonly drained: number;
  readonly completes: number;
}

/** Where `at` (0 to 1 along the bridge) is on the board, as a share of the board's width. */
export function boardX(at: number): number {
  return BRIDGE.left + (BRIDGE.right - BRIDGE.left) * at;
}
