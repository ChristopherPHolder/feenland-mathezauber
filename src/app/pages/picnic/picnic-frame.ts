import type { Food, TaskKind } from './picnic-levels';
import type { FriendKind } from './picnic-friends';

/** One food on the blanket: its pieces as shares of the whole, and which have jam. */
export interface FoodOnBlanket {
  readonly food: Food;
  readonly sizes: readonly number[];
  readonly shaded: readonly boolean[];
  /** Under a cloth: the child reasons from the friends and the fraction. */
  readonly covered: boolean;
}

/** What the picnic scene draws: plain state from the game, never decisions. */
export interface PicnicFrame {
  /** Which share of the round this is, so the scene sets the blanket afresh. */
  readonly share: number;
  readonly kind: TaskKind;
  /** The food in the middle; two on a comparison (left and right); none for berries. */
  readonly foods: readonly FoodOnBlanket[];
  /** Berries: in the basket, on each plate, and how many of the last plates are for later. */
  readonly berries: {
    readonly basket: number;
    readonly plates: readonly number[];
    readonly later: number;
  } | null;
  /** The friends at the blanket, left to right. */
  readonly guests: readonly FriendKind[];
  /** How far the ant line has walked toward the blanket, 0 to 1; null without ants. */
  readonly ants: number | null;
  /** The ants reached the blanket and carry off a crumb. */
  readonly crumbGone: boolean;
  readonly golden: boolean;
  readonly cake: boolean;
  /** The share is made: the pieces sit on the plates and the friends munch. */
  readonly served: boolean;
  /** Friends who joined the picnic for good, on the back blanket. */
  readonly joined: readonly FriendKind[];
  readonly finished: boolean;
  /** Counters that go up once per event, so the scene can play a burst. */
  readonly rights: number;
  readonly wrongs: number;
  readonly cuts: number;
  readonly deals: number;
}
