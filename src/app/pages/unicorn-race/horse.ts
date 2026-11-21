/**
 * The horse a child races with: its name, what kind of horse it is, its colours and markings. Lumi, the
 * white unicorn with the rainbow mane, is the horse every child starts with.
 */
export type HorseKind = 'unicorn' | 'pegasus' | 'alicorn' | 'pony';
export const horseKinds: readonly HorseKind[] = ['unicorn', 'pegasus', 'alicorn', 'pony'];

/**
 * A coat colour, the darker shade for the far legs, the muzzle and the hooves, and the colour
 * of its markings: white on every coat but white, where they are a soft lilac grey.
 */
export interface CoatPaint {
  readonly coat: string;
  readonly shade: string;
  readonly mark: string;
}
const WHITE_MARK = '#fffdfd';
export const COATS = {
  snow: { coat: '#fffdfd', shade: '#e7d8ee', mark: '#cbb7e3' },
  blush: { coat: '#ffd9e6', shade: '#f2abc6', mark: WHITE_MARK },
  lilac: { coat: '#e3d3ff', shade: '#bda6ef', mark: WHITE_MARK },
  mint: { coat: '#cdf3dd', shade: '#9fd9b6', mark: WHITE_MARK },
  sky: { coat: '#cfe8ff', shade: '#9fc6ef', mark: WHITE_MARK },
  peach: { coat: '#ffd8bb', shade: '#f0b48e', mark: WHITE_MARK },
  butter: { coat: '#fff0b0', shade: '#e6cc78', mark: WHITE_MARK },
  caramel: { coat: '#e3ac78', shade: '#b97c4c', mark: '#fff6ea' },
  cocoa: { coat: '#8f5f48', shade: '#674232', mark: '#fff6ea' },
  midnight: { coat: '#48437a', shade: '#2f2b58', mark: '#f4f0ff' },
} as const satisfies Record<string, CoatPaint>;
export type CoatId = keyof typeof COATS;
export const coatIds = Object.keys(COATS) as CoatId[];

/** Three colours a mane and tail are woven from, lock by lock. */
export type ManePaint = readonly [string, string, string];
export const MANES = {
  rainbow: ['#ff8fb8', '#ffd36b', '#8fd3ff'],
  candy: ['#ff9ed1', '#ffc3e3', '#ff7bbd'],
  ocean: ['#5fb8ff', '#9be6ff', '#3f86e0'],
  sunset: ['#ff8a5c', '#ffc65c', '#ff5f8f'],
  meadow: ['#6fd690', '#c6f28a', '#45b872'],
  berry: ['#b06ce8', '#e5a0ff', '#7d4bd1'],
  snow: ['#ffffff', '#eef2ff', '#d9d2ff'],
  night: ['#4b3a70', '#6d4a9a', '#2f2650'],
} as const satisfies Record<string, ManePaint>;
export type ManeId = keyof typeof MANES;
export const maneIds = Object.keys(MANES) as ManeId[];

/** White patches a real horse can have: a star or a blaze on the face, socks, or spots. */
export type Marking = 'none' | 'star' | 'blaze' | 'socks' | 'spots';
export const markings: readonly Marking[] = ['none', 'star', 'blaze', 'socks', 'spots'];

/** A horn's colour and the darker groove that winds round it. */
export type HornPaint = readonly [string, string];
export const HORNS = {
  gold: ['#ffd54a', '#e2a400'],
  silver: ['#eceff7', '#a3abc4'],
  rose: ['#ffb8d2', '#e0709c'],
  crystal: ['#c4f4ff', '#62bfe0'],
} as const satisfies Record<string, HornPaint>;
export type HornId = keyof typeof HORNS;
export const hornIds = Object.keys(HORNS) as HornId[];

export interface Horse {
  /** What the child called it; empty means the default name in the child's language. */
  readonly name: string;
  readonly kind: HorseKind;
  readonly coat: CoatId;
  readonly mane: ManeId;
  readonly marking: Marking;
  /** Only shows on a horse with a horn, but is kept when the kind changes. */
  readonly horn: HornId;
}
export const LUMI: Horse = {
  name: '',
  kind: 'unicorn',
  coat: 'snow',
  mane: 'rainbow',
  marking: 'none',
  horn: 'gold',
};
/** Long enough for any first name, short enough for the name tag over the track. */
export const NAME_MAX = 12;

/** Spots read best dark on a pale coat and white on a dark one. */
export function spotColour(coat: CoatId): string {
  const paint: CoatPaint = COATS[coat];
  return paint.mark === WHITE_MARK ? paint.shade : paint.mark;
}

export function hasHorn(kind: HorseKind): boolean {
  return kind === 'unicorn' || kind === 'alicorn';
}
export function hasWings(kind: HorseKind): boolean {
  return kind === 'pegasus' || kind === 'alicorn';
}

/** Trims a typed name, folds runs of spaces and stops at `NAME_MAX` characters. */
export function cleanName(name: string): string {
  const folded = name.replace(/\s+/g, ' ').replace(/\p{C}/gu, '').trim();
  return [...folded].slice(0, NAME_MAX).join('').trim();
}

export function sameHorse(a: Horse, b: Horse): boolean {
  return (
    a.name === b.name &&
    a.kind === b.kind &&
    a.coat === b.coat &&
    a.mane === b.mane &&
    a.marking === b.marking &&
    a.horn === b.horn
  );
}

/** A random look; the name stays, so "surprise me" never wipes a typed name. */
export function randomHorse(name: string, random: () => number = Math.random): Horse {
  const pick = <T>(items: readonly T[]) => items[Math.floor(random() * items.length)];
  return {
    name,
    kind: pick(horseKinds),
    coat: pick(coatIds),
    mane: pick(maneIds),
    marking: pick(markings),
    horn: pick(hornIds),
  };
}

/** Reads a stored horse, keeping every valid part and falling back to Lumi's for the rest. */
export function readHorse(value: unknown): Horse {
  if (!value || typeof value !== 'object') return LUMI;
  const saved = value as Record<string, unknown>;
  const name = typeof saved['name'] === 'string' ? cleanName(saved['name']) : LUMI.name;
  const kind = horseKinds.find((kind) => kind === saved['kind']) ?? LUMI.kind;
  const coat = coatIds.find((coat) => coat === saved['coat']) ?? LUMI.coat;
  const mane = maneIds.find((mane) => mane === saved['mane']) ?? LUMI.mane;
  const marking = markings.find((marking) => marking === saved['marking']) ?? LUMI.marking;
  const horn = hornIds.find((horn) => horn === saved['horn']) ?? LUMI.horn;
  return { name, kind, coat, mane, marking, horn };
}
