import type { Comparison } from './comparison';
import type { HatId, SnackKind } from './crocodile-score';

/** The heron's run at the current snack, as the page times it. */
export interface PondHeron {
  /** Where the snack is: the heron only swoops there once it has won the race. */
  readonly target: 'left' | 'right' | 'center';
  readonly state: 'flying' | 'stole' | 'shooed';
  /** Milliseconds from arriving to snatching the snack. */
  readonly duration: number;
  /** When it snatches the snack, as `Date.now()`: the heron's place on its loop follows it. */
  readonly due: number;
  readonly paused: boolean;
}

/**
 * Everything the 3D pond draws, as plain values. The page owns the game; the world only shows
 * it. The world finds where to put the pads and Kiki by measuring the page's real buttons
 * (`[data-side="left" | "center" | "right"]` inside the pond), so taps always land on them.
 */
export interface PondFrame {
  /** Which snack of the round is up; a new one floats in fresh tiles. */
  readonly snack: number;
  readonly left: string;
  readonly right: string;
  readonly kind: SnackKind;
  readonly phase: 'ready' | 'chomping' | 'stolen' | 'complete';
  /** The answer Kiki acted on, once she has. */
  readonly chosen: Comparison | null;
  /** Where Kiki looks: the hovered or focused choice before an answer, the answer after. */
  readonly pose: Comparison | null;
  /** The wrong pick she is shaking her head at, briefly. */
  readonly wrong: Comparison | null;
  /** Wrong picks at this snack; each new one plays the head shake once. */
  readonly tries: number;
  /** 1, 2 or 3: a combo of 3 is a feeding frenzy. */
  readonly combo: number;
  readonly hat: HatId | 'none';
  readonly heron: PondHeron | null;
}
