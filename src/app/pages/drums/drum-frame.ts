/**
 * What the mushroom drums scene draws, as plain data. The game decides everything; the 3D world
 * and the flat SVG path only show it. Times are seconds on the game clock (`now()`), the same
 * clock the music is scheduled on, so Pom's bounce and the drum hits stay together.
 */

/** One drum-mushroom on Pom's path. */
export interface FrameMushroom {
  readonly value: number;
  /** The band plays it (a demo hop or a call): its number shows from the start. */
  readonly given: boolean;
  /** The first mushroom of a new run: a verse, a call or the drum solo starts here. */
  readonly fresh: boolean;
  /** The signed step from the mushroom before it in its run, like 10 or −2; 0 when fresh. */
  readonly step: number;
  /** A drum-solo mushroom, worth double. */
  readonly solo: boolean;
}

/** A jump from one mushroom to another. Pom stands until `start` and lands at `end`. */
export interface FrameHop {
  readonly from: number;
  readonly to: number;
  readonly start: number;
  readonly end: number;
}

export interface DrumFrame {
  /** Goes up when a new round starts, so a world rebuilds its path. */
  readonly round: number;
  readonly mushrooms: readonly FrameMushroom[];
  /** The mushroom Pom stands on, or jumps from while `hop` runs. */
  readonly at: number;
  readonly hop: FrameHop | null;
  /** The mushroom showing a glowing "?": its number stays hidden until it is answered. */
  readonly ask: number | null;
  /** The countdown ring on the "?" mushroom; null in free play and while the beat holds. */
  readonly ring: { readonly start: number; readonly end: number } | null;
  /** The beat grid, for pulsing: beats fall at `origin + k * period`. Null without a beat. */
  readonly beat: { readonly origin: number; readonly period: number } | null;
  /** The game clock in seconds. */
  readonly now: () => number;
  /** The answer is late: Pom waits on the mushroom's edge with a drumroll. */
  readonly waiting: boolean;
  /** A wrong answer: the beat holds on a chord until the right one. */
  readonly held: boolean;
  /** After a first miss, the step arc to the "?" glows with this label, like "+10". */
  readonly stepHint: string | null;
  /** Instrument layers playing: 1 (drums) to 5 (the whole forest band). */
  readonly layers: number;
  /** Goes up once per right landing: a drum-hit ring, the step arc flashes. */
  readonly hits: number;
  /** Goes up once per wrong answer: the cap squishes, spores puff, Pom wobbles. */
  readonly bonks: number;
  /** The drum solo is on. */
  readonly solo: boolean;
  /** The round is over: Pom drums a final roll. */
  readonly finished: boolean;
  /** The game is paused: everything holds still. */
  readonly paused: boolean;
}

/** The band in the order its instruments join the song. */
export const BAND = ['drums', 'bass', 'flute', 'bells', 'choir'] as const;
export type BandLayer = (typeof BAND)[number];
export const MAX_LAYERS = BAND.length;

/** The step as the arc above the path writes it: "+10", "−2". */
export function stepLabel(step: number): string {
  return step < 0 ? `−${-step}` : `+${step}`;
}

/** Colours of the glowing mushroom caps, shared by the 3D world and the flat path. */
export const CAP_COLORS = ['#ff7ab8', '#4fd6c4', '#ffc24d', '#a98bff', '#7fd36b'] as const;
export const SOLO_COLOR = '#ffd23f';

export function capColor(index: number, mushroom: FrameMushroom): string {
  return mushroom.solo ? SOLO_COLOR : CAP_COLORS[index % CAP_COLORS.length];
}
