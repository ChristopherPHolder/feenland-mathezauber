import type { CutDir, TrayLook } from './bakery-levels';
import type { OrderPhase } from './bakery-order';

/** Who comes to the counter. A dragon is one the child hatched, as a cameo. */
export type Customer = 'fox' | 'rabbit' | 'hedgehog' | 'squirrel' | `dragon:${string}`;

export const ANIMALS: readonly Customer[] = ['fox', 'rabbit', 'hedgehog', 'squirrel'];

/** What the bakery scene draws: plain state from the game, never decisions. */
export interface BakeryFrame {
  /** Which order of the round this is, so the scene starts each tray fresh. */
  readonly order: number;
  /** The tray as it lies now: rows and columns swap when it is turned. */
  readonly rows: number;
  readonly cols: number;
  readonly dir: CutDir | null;
  readonly cuts: readonly number[];
  readonly ghost: CutDir | null;
  readonly look: TrayLook;
  /** The area model's "Show the cookies" switch. */
  readonly cookies: boolean;
  /** Each piece's number once the child named it; null while it is still a question. */
  readonly values: readonly (number | null)[];
  readonly ghostValue: number | null;
  /** The piece the choices are about. */
  readonly active: number | null;
  readonly phase: OrderPhase;
  /** Where the knife rests, and the gaps that glow for the level's trick. */
  readonly knife: { readonly dir: CutDir; readonly at: number } | null;
  readonly guide: { readonly dir: CutDir; readonly gaps: readonly number[] } | null;
  /** How brown the raw cookies are from the oven timer, 0 to 1. */
  readonly browning: number;
  /** The timer ran out: the cookies came out a bit crispy. */
  readonly crispy: boolean;
  /** Share of the oven timer left, or null with no timer. */
  readonly timer: number | null;
  readonly golden: boolean;
  readonly cake: boolean;
  readonly customer: Customer;
  /** Menu board squares, 100 of them for 1 × 1 … 10 × 10: 0 empty, 1 cookie, 2 cookie and star. */
  readonly board: readonly number[];
  /** Treats in the shop window, one per bakery level finished. */
  readonly treats: number;
  readonly finished: boolean;
  /** Counters that go up once per event, so the scene can play a burst. */
  readonly chops: number;
  readonly turns: number;
  readonly rights: number;
  readonly wrongs: number;
  readonly twins: number;
  readonly bakes: number;
  readonly nibbles: number;
  readonly pulses: number;
  /** What the last pulse was about: one piece's rows, every piece, one row, or the ghost row. */
  readonly pulse: { readonly kind: 'rows' | 'pieces' | 'row' | 'ghost'; readonly piece: number };
}

/** The menu board square for a fact, counting from the top left. */
export const boardIndex = (rows: number, cols: number) => (rows - 1) * 10 + (cols - 1);

/** Raw dough, golden, baked and crispy cookie colours. */
export const DOUGH = ['#f7deaf', '#e9b56a', '#d08f45', '#a9692c'] as const;

/** Blends two #rrggbb colours. */
export function mixColor(from: string, to: string, share: number): string {
  const a = parseInt(from.slice(1), 16);
  const b = parseInt(to.slice(1), 16);
  const channel = (shift: number) =>
    Math.round(((a >> shift) & 255) * (1 - share) + ((b >> shift) & 255) * share);
  return `#${((channel(16) << 16) | (channel(8) << 8) | channel(0)).toString(16).padStart(6, '0')}`;
}

/** The cookie colour for a frame: it browns with the timer, and bakes golden. */
export function cookieColor(frame: Pick<BakeryFrame, 'phase' | 'browning' | 'crispy'>): string {
  if (frame.crispy) return DOUGH[3];
  if (frame.phase === 'baked') return DOUGH[2];
  return mixColor(DOUGH[0], DOUGH[1], Math.min(1, frame.browning));
}
