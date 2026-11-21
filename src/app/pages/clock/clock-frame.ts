import type { EventId } from './clock-levels';
import { hourOf, minuteOf, wrapDay } from './clock-time';

/**
 * What the clock scenes draw: plain state from the game, never decisions. The 3D tower and the
 * flat fallback both read it, and both put the clock face where `dialBox` says, so the DOM
 * handles for dragging the hands sit right over it.
 */
export interface ClockFrame {
  /** Which turn of the round this is, so a scene starts each turn fresh. */
  readonly turn: number;
  /** Where the hands point on the 12-hour face (0 … 719 minutes). */
  readonly dial: number;
  /** The time of day the sky follows (0 … 1439). */
  readonly sky: number;
  /** Help on screen: the short hand pulses, or the five-minute marks light up in turn. */
  readonly help: 'none' | 'hour' | 'fives';
  /** Golden Hour: the face glows. */
  readonly golden: boolean;
  /** The midnight bell turn. */
  readonly midnight: boolean;
  /** The event of this turn, shown as its creature waiting on the village roof. */
  readonly event: EventId;
  /** Creatures already living on the balcony, in the order they came. */
  readonly friends: readonly EventId[];
  /** The creature woken by the last right time, flying up now (or null). */
  readonly arriving: EventId | null;
  /** Village windows lit this round: one per right time. */
  readonly lights: number;
  /** Counters that go up once per event, so a scene can play it once. */
  readonly rings: number;
  readonly wobbles: number;
  /** The round is over: the scene shows the balcony with everyone on it. */
  readonly complete: boolean;
}

/**
 * Where the clock face sits on the board: its centre as shares of the board's width and height,
 * and its radius as a share of the shorter side. The 3D camera frames the face to exactly this
 * spot, the SVG fallback draws it there, and the hand handles are laid over it.
 */
export const DIAL = { cx: 0.5, cy: 0.4, r: 0.27, maxShare: 0.23 } as const;

export interface DialBox {
  readonly left: number;
  readonly top: number;
  readonly size: number;
}

export function dialBox(width: number, height: number): DialBox {
  const size = 2 * dialRadius(width, height);
  return { left: DIAL.cx * width - size / 2, top: DIAL.cy * height - size / 2, size };
}

/**
 * The face's radius in pixels: a share of the shorter side, but never wider than a share of the
 * width, so the bell and Pip beside the face stay in view on wide boards.
 */
export function dialRadius(width: number, height: number): number {
  return Math.min(DIAL.r * Math.min(width, height), DIAL.maxShare * width);
}

/** Sky colours (top, horizon) through the day, blended between these stops. */
const SKY_STOPS: readonly (readonly [number, string, string])[] = [
  [0, '#0d1240', '#27306b'],
  [4.5, '#141a52', '#33377a'],
  [6, '#5a5aa6', '#ffb27a'],
  [7.5, '#79b8ef', '#ffe2b8'],
  [11, '#5aa7ee', '#cfe9ff'],
  [16, '#62a8ea', '#d8ecff'],
  [18.5, '#6f6fc0', '#ffb07a'],
  [20, '#2e2f7a', '#c5658a'],
  [21.5, '#141a52', '#33377a'],
  [24, '#0d1240', '#27306b'],
];

function mix(a: string, b: string, t: number): string {
  const channel = (hex: string, index: number) =>
    parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16);
  const out = [0, 1, 2].map((index) =>
    Math.round(channel(a, index) + (channel(b, index) - channel(a, index)) * t)
      .toString(16)
      .padStart(2, '0'),
  );
  return `#${out.join('')}`;
}

/** The sky for a time of day: a top colour, a horizon colour and how many stars show (0 … 1). */
export function skyAt(time: number): { top: string; horizon: string; stars: number } {
  const hours = hourOf(wrapDay(time)) + minuteOf(time) / 60;
  let index = SKY_STOPS.findIndex(([at]) => at > hours) - 1;
  if (index < 0) index = SKY_STOPS.length - 2;
  const [from, top1, horizon1] = SKY_STOPS[index];
  const [to, top2, horizon2] = SKY_STOPS[index + 1];
  const t = (hours - from) / (to - from);
  const stars =
    hours < 5 || hours >= 21
      ? 1
      : hours < 6.5
        ? (6.5 - hours) / 1.5
        : hours > 19.5
          ? (hours - 19.5) / 1.5
          : 0;
  return { top: mix(top1, top2, t), horizon: mix(horizon1, horizon2, t), stars };
}

/** How each event's creature looks: a body colour, an accent and its shape. */
export type CritterShape =
  | 'chick'
  | 'mouse'
  | 'owlet'
  | 'hedgehog'
  | 'bird'
  | 'bunny'
  | 'dragon'
  | 'frog'
  | 'cat'
  | 'duck'
  | 'firefly'
  | 'bat'
  | 'owl';

export interface Critter {
  readonly shape: CritterShape;
  readonly body: string;
  readonly accent: string;
}

export const CRITTERS: Readonly<Record<EventId, Critter>> = {
  rooster: { shape: 'chick', body: '#ffd84a', accent: '#e8572e' },
  bakery: { shape: 'mouse', body: '#c9b8ad', accent: '#f6a6c1' },
  school: { shape: 'owlet', body: '#a77a52', accent: '#ffd36b' },
  market: { shape: 'hedgehog', body: '#8a5a3c', accent: '#f1d3b0' },
  post: { shape: 'bird', body: '#5aa7e8', accent: '#ffb347' },
  lunch: { shape: 'bunny', body: '#f4f0ea', accent: '#f6a6c1' },
  nap: { shape: 'dragon', body: '#5cc28a', accent: '#ffd36b' },
  swim: { shape: 'frog', body: '#7ccd52', accent: '#f6f2c8' },
  tea: { shape: 'cat', body: '#f2a65a', accent: '#fff3e0' },
  bath: { shape: 'duck', body: '#ffe066', accent: '#ff9933' },
  fireworks: { shape: 'firefly', body: '#6f5aa8', accent: '#fff07a' },
  stars: { shape: 'bat', body: '#5a4a7a', accent: '#d9c8ff' },
  midnight: { shape: 'owl', body: '#7a5ac0', accent: '#ffd36b' },
};

export const BRONZE = '#c98a3a';
export const GOLD = '#ffcf33';
export const FACE = '#fff8e6';
export const INK = '#2a2350';
