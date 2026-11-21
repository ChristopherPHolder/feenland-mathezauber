import type { Dragon } from '../hatchery/dragons';
import type { SpriteId } from './duel';

/** Day for the meadow sprites, a sunset for the sky sprites, a starry night for the last two. */
export type DuelSky = 'day' | 'dusk' | 'night';

/** What the arena shows; the page owns the duel. */
export interface ArenaFrame {
  readonly dragon: Dragon;
  /** The dragon's form: 0 the hatchling, 1 young, 2 final. */
  readonly form: number;
  readonly sprite: SpriteId;
  readonly sky: DuelSky;
  readonly phase: 'intro' | 'fighting' | 'won' | 'napping';
  /** The sprite's charge from 0 to 1. */
  readonly charge: number;
  /** Counters: each new value plays its effect once. */
  readonly hits: number;
  readonly zaps: number;
  readonly giggles: number;
  /** The last hit was a critical or weak-spot hit: a bigger blast. */
  readonly big: boolean;
}

export function skyFor(stage: number): DuelSky {
  return stage <= 3 ? 'day' : stage <= 6 ? 'dusk' : 'night';
}
