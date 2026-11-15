/**
 * The dragon hatchery: one egg at a time, warmed by every right answer in any game.
 * Pure state and rules live here so the store, the page and the tests share them.
 */
export type DragonElement = 'fire' | 'water' | 'leaf' | 'star' | 'cloud' | 'rainbow';

export interface Dragon {
  /** Stable id: part of the save, never rename. */
  readonly id: string;
  readonly element: DragonElement;
  /** Starlight dragons wake once all six everyday dragons are found. */
  readonly starlight: boolean;
  readonly body: string;
  readonly belly: string;
  readonly wing: string;
  readonly accent: string;
  /** The egg shell and its spots hint at the dragon inside. */
  readonly shell: string;
  readonly spots: string;
}

const day: readonly Dragon[] = [
  {
    id: 'ember',
    element: 'fire',
    starlight: false,
    body: '#f2703f',
    belly: '#ffd9a0',
    wing: '#ffb15e',
    accent: '#ffd43f',
    shell: '#ffe2c6',
    spots: '#f2703f',
  },
  {
    id: 'splash',
    element: 'water',
    starlight: false,
    body: '#3da5df',
    belly: '#cdf1ff',
    wing: '#86d3f6',
    accent: '#1d6fb3',
    shell: '#d9f2ff',
    spots: '#3da5df',
  },
  {
    id: 'fern',
    element: 'leaf',
    starlight: false,
    body: '#5bb860',
    belly: '#e6f7c8',
    wing: '#a3da72',
    accent: '#2f7d3a',
    shell: '#e4f6d6',
    spots: '#5bb860',
  },
  {
    id: 'twinkle',
    element: 'star',
    starlight: false,
    body: '#9068d8',
    belly: '#f2e6ff',
    wing: '#c8adf6',
    accent: '#ffd43f',
    shell: '#eee3ff',
    spots: '#ffc93c',
  },
  {
    id: 'puff',
    element: 'cloud',
    starlight: false,
    body: '#8fb4de',
    belly: '#fffefc',
    wing: '#fffefc',
    accent: '#d6e6f8',
    shell: '#f4f8fd',
    spots: '#a9c6e8',
  },
  {
    id: 'prism',
    element: 'rainbow',
    starlight: false,
    body: '#ff8cbf',
    belly: '#fff0f7',
    wing: '#ffc4dd',
    accent: '#7a51b0',
    shell: '#ffe8f2',
    spots: '#ff8cbf',
  },
];

/** Night-sky versions of the six, sprinkled with stars. */
const starlight: readonly Dragon[] = [
  { base: 'ember', body: '#b2362f', belly: '#ffc27a', wing: '#f07d4a', shell: '#4a2a55' },
  { base: 'splash', body: '#1f4f9e', belly: '#9fe3ff', wing: '#4b8fd8', shell: '#1d2f66' },
  { base: 'fern', body: '#226b4a', belly: '#c8f0a6', wing: '#4fae6c', shell: '#1d4a45' },
  { base: 'twinkle', body: '#4a2f8f', belly: '#e0cdff', wing: '#8c6ad8', shell: '#2b2160' },
  { base: 'puff', body: '#4f6690', belly: '#e9f1ff', wing: '#c9d8f2', shell: '#2c3a62' },
  { base: 'prism', body: '#b3367a', belly: '#ffd6ea', wing: '#ef7fb4', shell: '#4c2050' },
].map(({ base, ...palette }) => {
  const dragon = day.find((d) => d.id === base)!;
  return {
    ...dragon,
    ...palette,
    id: `${base}-starlight`,
    starlight: true,
    accent: '#ffe27a',
    spots: '#ffe27a',
  };
});

export const DRAGONS: readonly Dragon[] = [...day, ...starlight];
export const DAY_DRAGONS = day;
export const STARLIGHT_DRAGONS = starlight;

export function dragonById(id: string | null | undefined): Dragon | undefined {
  return DRAGONS.find((dragon) => dragon.id === id);
}

export interface Hatchery {
  readonly version: 1;
  /** The dragon waiting inside the current egg. */
  readonly egg: string;
  readonly warmth: number;
  /** Every dragon found, in hatching order, each once. */
  readonly hatched: readonly string[];
  /** How many eggs have hatched, repeats included. */
  readonly hatches: number;
  readonly favorite: string | null;
  /** Right answers given across every game, ever. */
  readonly answers: number;
}

/**
 * Right answers an egg needs. The first one hatches after about two games so the idea
 * lands quickly; later eggs ask a little more and level off.
 */
export function warmthNeeded(hatches: number): number {
  return [20, 30, 40][hatches] ?? 50;
}

export type Random = () => number;

/** The next egg holds a dragon not found yet: everyday ones first, then starlight ones. */
export function nextEgg(hatched: readonly string[], random: Random): string {
  const missingDay = day.filter((dragon) => !hatched.includes(dragon.id));
  const pool = missingDay.length
    ? missingDay
    : starlight.filter((dragon) => !hatched.includes(dragon.id));
  const choices = pool.length ? pool : DRAGONS;
  return choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))].id;
}

export function freshHatchery(random: Random): Hatchery {
  return {
    version: 1,
    egg: nextEgg([], random),
    warmth: 0,
    hatched: [],
    hatches: 0,
    favorite: null,
    answers: 0,
  };
}

export function isReady(state: Hatchery): boolean {
  return state.warmth >= warmthNeeded(state.hatches);
}

/** A right answer warms the egg; once it is ready, it waits to be hatched. */
export function warm(state: Hatchery, amount = 1): Hatchery {
  const step = Math.max(0, Math.floor(amount));
  return {
    ...state,
    warmth: Math.min(warmthNeeded(state.hatches), state.warmth + step),
    answers: state.answers + step,
  };
}

export interface HatchResult {
  readonly state: Hatchery;
  readonly dragon: Dragon;
  /** False when this dragon had hatched before. */
  readonly isNew: boolean;
}

export function hatch(state: Hatchery, random: Random): HatchResult | undefined {
  const dragon = dragonById(state.egg);
  if (!dragon || !isReady(state)) return undefined;
  const isNew = !state.hatched.includes(dragon.id);
  const hatched = isNew ? [...state.hatched, dragon.id] : state.hatched;
  return {
    dragon,
    isNew,
    state: {
      ...state,
      hatched,
      hatches: state.hatches + 1,
      warmth: 0,
      favorite: state.favorite ?? dragon.id,
      egg: nextEgg(hatched, random),
    },
  };
}

export function chooseFavorite(state: Hatchery, id: string): Hatchery {
  return state.hatched.includes(id) ? { ...state, favorite: id } : state;
}

/** Starlight dragons appear in the book once every everyday dragon is found. */
export function starlightAwake(state: Hatchery): boolean {
  return day.every((dragon) => state.hatched.includes(dragon.id));
}

const count = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;

/** Restores a save, dropping anything unknown, so a damaged save never breaks a game. */
export function parseHatchery(value: unknown, random: Random): Hatchery {
  if (!value || typeof value !== 'object') return freshHatchery(random);
  const raw = value as Record<string, unknown>;
  if (raw['version'] !== 1) return freshHatchery(random);
  const hatched = Array.isArray(raw['hatched'])
    ? [
        ...new Set(
          raw['hatched'].filter((id): id is string => typeof id === 'string' && !!dragonById(id)),
        ),
      ]
    : [];
  const hatches = Math.max(count(raw['hatches']), hatched.length);
  const egg =
    typeof raw['egg'] === 'string' && dragonById(raw['egg'])
      ? raw['egg']
      : nextEgg(hatched, random);
  const favorite =
    typeof raw['favorite'] === 'string' && hatched.includes(raw['favorite'])
      ? raw['favorite']
      : (hatched[0] ?? null);
  return {
    version: 1,
    egg,
    warmth: Math.min(count(raw['warmth']), warmthNeeded(hatches)),
    hatched,
    hatches,
    favorite,
    answers: count(raw['answers']),
  };
}
