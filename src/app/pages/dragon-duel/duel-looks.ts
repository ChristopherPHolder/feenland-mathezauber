import type { DragonElement } from '../hatchery/dragons';
import type { SpriteId } from './duel';

/** Each sprite's colours, shared by the 3D model, the flat arena and the loader. */
export interface SpriteLook {
  readonly body: string;
  readonly belly: string;
  /** Its hair, crown, wings or crystals. */
  readonly trim: string;
  /** Sprites that float bob in the air instead of standing. */
  readonly floats: boolean;
}

export const SPRITE_LOOKS: Readonly<Record<SpriteId, SpriteLook>> = {
  pebble: { body: '#a89a8a', belly: '#e6ddd0', trim: '#6f9c4e', floats: false },
  puddle: { body: '#5fb0e6', belly: '#d4efff', trim: '#cdf1ff', floats: false },
  bramble: { body: '#6e9e48', belly: '#dcefc4', trim: '#e0567a', floats: false },
  gusty: { body: '#c9dcf2', belly: '#f7fbff', trim: '#8fb4de', floats: true },
  cinder: { body: '#e0623a', belly: '#ffd6a8', trim: '#ffb347', floats: false },
  moth: { body: '#7a68b8', belly: '#e4dcff', trim: '#c8b8ff', floats: true },
  frost: { body: '#a9e2f3', belly: '#f0fbff', trim: '#e8fbff', floats: true },
  grumble: { body: '#5d5f86', belly: '#c9cbe8', trim: '#ffd43f', floats: true },
};

/** The colours each element's attack flies in. */
export const ATTACK_COLORS: Readonly<Record<DragonElement, readonly string[]>> = {
  fire: ['#ff7a2f', '#ffd43f', '#ff5a1f'],
  water: ['#3da5df', '#cdf1ff', '#86d3f6'],
  leaf: ['#5bb860', '#a3da72', '#2f7d3a'],
  star: ['#ffd43f', '#fff3b0', '#c8adf6'],
  cloud: ['#fffefc', '#d6e6f8', '#a9c6e8'],
  rainbow: ['#ff6f91', '#ffb347', '#ffe066', '#7ddf9b', '#7cc7ff', '#b79bff'],
};
