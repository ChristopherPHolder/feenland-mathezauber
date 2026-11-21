/**
 * The picnic friends. Each level finished for the first time brings the next one, in this order,
 * and they stay on the blanket. Guests at the blanket during play come from all of them.
 */
export const FRIENDS = [
  'hedgehog',
  'bunny',
  'frog',
  'mouse',
  'fox',
  'duck',
  'bear',
  'owl',
  'squirrel',
  'lamb',
  'cat',
  'badger',
] as const;

export type FriendKind = (typeof FRIENDS)[number];

export type Ears = 'round' | 'long' | 'pointy' | 'tiny' | 'none' | 'tufts';
export type Snout = 'nose' | 'beak' | 'wide' | 'button';

export interface FriendLook {
  readonly fur: string;
  readonly light: string;
  readonly dark: string;
  readonly ears: Ears;
  readonly snout: Snout;
}

export const FRIEND_LOOKS: Record<FriendKind, FriendLook> = {
  hedgehog: { fur: '#c9a57e', light: '#f1dcc0', dark: '#5b4031', ears: 'tiny', snout: 'nose' },
  bunny: { fur: '#ece4dc', light: '#fffaf6', dark: '#e8a3b4', ears: 'long', snout: 'button' },
  frog: { fur: '#6cbf4f', light: '#d8f0a8', dark: '#2f6b2a', ears: 'none', snout: 'wide' },
  mouse: { fur: '#b9b2ad', light: '#f2e6e2', dark: '#e79aa8', ears: 'round', snout: 'button' },
  fox: { fur: '#e5793b', light: '#fff4e6', dark: '#3a2418', ears: 'pointy', snout: 'nose' },
  duck: { fur: '#ffe066', light: '#fff6c4', dark: '#f39a2b', ears: 'none', snout: 'beak' },
  bear: { fur: '#a8703f', light: '#e3c39a', dark: '#6b4224', ears: 'round', snout: 'nose' },
  owl: { fur: '#9b7653', light: '#efdcc0', dark: '#f0a830', ears: 'tufts', snout: 'beak' },
  squirrel: { fur: '#c0622d', light: '#f4dcc0', dark: '#7a3a17', ears: 'pointy', snout: 'button' },
  lamb: { fur: '#fbf8f1', light: '#f3e6d8', dark: '#4a3a33', ears: 'long', snout: 'button' },
  cat: { fur: '#8b8f9c', light: '#eef0f4', dark: '#3c3f4a', ears: 'pointy', snout: 'button' },
  badger: { fur: '#6f6a66', light: '#f4f1ec', dark: '#2a2624', ears: 'tiny', snout: 'nose' },
};

/** The friend a level brings to the picnic the first time it is finished. */
export const friendForStage = (stage: number): FriendKind =>
  FRIENDS[(Math.max(1, stage) - 1) % FRIENDS.length];

/** The friends at the blanket for one share: `count` in a row, a different set each share. */
export function guestsFor(index: number, stage: number, count: number): FriendKind[] {
  const start = (index * 5 + stage * 3) % FRIENDS.length;
  return Array.from({ length: count }, (_, at) => FRIENDS[(start + at) % FRIENDS.length]);
}
