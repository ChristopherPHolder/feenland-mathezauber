import type { Customer, GoodId } from './market-levels';
import type { Denomination } from './market-money';

/**
 * Where the shop is in a turn: the treat waits on the counter (`shop`), the purchase went
 * through (`solved`), or the round is over (`complete`). `intro` is the level card's calm view.
 */
export type MarketPhase = 'intro' | 'shop' | 'solved' | 'complete';

/**
 * What the market scenes draw: plain state from the game, never decisions. The 3D shop and
 * the flat fallback both read it.
 */
export interface MarketFrame {
  /** Which turn of the round this is, so a scene starts each turn fresh. */
  readonly turn: number;
  readonly phase: MarketPhase;
  /** The treat on the counter and its price, in cents and as the reader writes it ("€6"). */
  readonly good: GoodId;
  readonly price: number;
  readonly priceText: string;
  /**
   * More treats on the counter beside the main one (a two- or three-treat shopping list), each
   * with its own price tag. Empty on single-treat levels.
   */
  readonly extras: readonly { readonly good: GoodId; readonly priceText: string }[];
  /** Who stands behind the till: Olli (Lumi shops) or Lumi herself (Olli watches). */
  readonly role: 'shopper' | 'till';
  /** The animal buying from Lumi when she works the till. */
  readonly customer: Customer | null;
  /** The note or notes handed over to pay, lying on the counter by the till. */
  readonly paid: readonly Denomination[];
  /** The change Olli counts out once Lumi's purchase went through (shopper role only). */
  readonly change: readonly Denomination[];
  /** Coins and notes the child has put on the counter tray, in the order they went down. */
  readonly tray: readonly Denomination[];
  /** How the turn ended: the treat went into Lumi's basket, or Olli put it back on the shelf. */
  readonly outcome: 'none' | 'bought' | 'putBack';
  /** Treats bought this round, in order: they fill Lumi's basket. */
  readonly basket: readonly GoodId[];
  /** Different treats ever bought, 0 to 12: they fill Lumi's shelf by the window. */
  readonly shelf: number;
  /** How far the sun has gone down, 0 (midday) to 1 (set). Always 0 without a timer. */
  readonly sunset: number;
  /** Lucky Shopper is on: golden coins and lit lanterns. */
  readonly golden: boolean;
  /** The big buy that ends the round. */
  readonly big: boolean;
  /** Counters that go up once per event, so a scene can play it once. */
  readonly coins: number;
  /** The till rang: a purchase went through. */
  readonly pays: number;
  /** A wrong answer: Olli shakes his head kindly. */
  readonly slips: number;
  /** The round is over: Olli and Lumi cheer. */
  readonly cheers: number;
}

/** A calm frame for the level card and the finish card. */
export function stillFrame(partial: Partial<MarketFrame> = {}): MarketFrame {
  return {
    turn: 0,
    phase: 'intro',
    good: 'honey',
    price: 0,
    priceText: '',
    extras: [],
    role: 'shopper',
    customer: null,
    paid: [],
    change: [],
    tray: [],
    outcome: 'none',
    basket: [],
    shelf: 0,
    sunset: 0,
    golden: false,
    big: false,
    coins: 0,
    pays: 0,
    slips: 0,
    cheers: 0,
    ...partial,
  };
}

/** Coin and note colours shared by the 3D shop, the flat shop and the purse buttons. */
export const MONEY_LOOK: Record<
  Denomination,
  { readonly fill: string; readonly rim: string; readonly ink: string }
> = {
  10: { fill: '#e7c25a', rim: '#b8902c', ink: '#5a4210' },
  20: { fill: '#e7c25a', rim: '#b8902c', ink: '#5a4210' },
  50: { fill: '#efcd62', rim: '#b8902c', ink: '#5a4210' },
  100: { fill: '#f2d46b', rim: '#c9cdd3', ink: '#4a3a10' },
  200: { fill: '#dfe3e8', rim: '#e5bd4f', ink: '#2c3440' },
  500: { fill: '#cfd8cf', rim: '#8a9b8a', ink: '#243324' },
  1000: { fill: '#f4b3b8', rim: '#c8606b', ink: '#5a1820' },
  2000: { fill: '#b8d3f2', rim: '#5d88c0', ink: '#14305a' },
};

/** A picture for each treat in the DOM (receipt, shelf) and the flat shop. */
export const GOOD_EMOJI: Record<GoodId, string> = {
  apple: '🍎',
  cookie: '🍪',
  flower: '🌷',
  cupcake: '🧁',
  ribbon: '🎀',
  honey: '🍯',
  ball: '⚽',
  book: '📕',
  teddy: '🧸',
  wand: '🪄',
  kite: '🪁',
  dragon: '🐉',
};
