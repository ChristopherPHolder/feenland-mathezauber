import type { Level } from '../../core/catalog';
import type { MessageKey } from '../../core/messages';
import type { DragonElement } from '../hatchery/dragons';
import { duelQuestion, DuelQuestion, DuelSkill, Random } from './duel-questions';

/**
 * Dragon Duels: a turn-based battle where every right answer is the dragon's attack. Pure rules
 * only: the page owns time, the scene only draws.
 */
export type SpriteId =
  | 'pebble'
  | 'puddle'
  | 'bramble'
  | 'gusty'
  | 'cinder'
  | 'moth'
  | 'frost'
  | 'grumble';

export interface Sprite {
  readonly id: SpriteId;
  /** The level number, part of the level id; never renumber. */
  readonly stage: number;
  readonly skill: DuelSkill;
  /** A sum of the kind this sprite asks, for the games hub. */
  readonly example: string;
  /** Energy to knock out of it. */
  readonly energy: number;
  /** A dragon of this element hits it harder. */
  readonly weakTo: DragonElement;
  /** Harder sums give the child more time: the charge and the quick window stretch by this. */
  readonly slow: number;
  readonly group: MessageKey;
  readonly boss?: boolean;
}

export const SPRITES: readonly Sprite[] = [
  {
    id: 'pebble',
    stage: 1,
    skill: 'add10',
    example: '3 + 4',
    energy: 20,
    weakTo: 'water',
    slow: 1,
    group: 'duelMeadow',
  },
  {
    id: 'puddle',
    stage: 2,
    skill: 'take10',
    example: '9 − 4',
    energy: 20,
    weakTo: 'leaf',
    slow: 1,
    group: 'duelMeadow',
  },
  {
    id: 'bramble',
    stage: 3,
    skill: 'plusMinus20',
    example: '15 − 7',
    energy: 22,
    weakTo: 'fire',
    slow: 1.2,
    group: 'duelMeadow',
  },
  {
    id: 'gusty',
    stage: 4,
    skill: 'doubles',
    example: '7 + 8',
    energy: 22,
    weakTo: 'star',
    slow: 1.2,
    group: 'duelSky',
  },
  {
    id: 'cinder',
    stage: 5,
    skill: 'tens100',
    example: '34 + 20',
    energy: 24,
    weakTo: 'cloud',
    slow: 1.4,
    group: 'duelSky',
  },
  {
    id: 'moth',
    stage: 6,
    skill: 'times',
    example: '5 × 4',
    energy: 24,
    weakTo: 'rainbow',
    slow: 1.4,
    group: 'duelSky',
  },
  {
    id: 'frost',
    stage: 7,
    skill: 'missing',
    example: '7 + ? = 12',
    energy: 24,
    weakTo: 'fire',
    slow: 1.4,
    group: 'duelNight',
  },
  {
    id: 'grumble',
    stage: 8,
    skill: 'mixed',
    example: '6 × 5',
    energy: 30,
    weakTo: 'star',
    slow: 1.4,
    group: 'duelNight',
    boss: true,
  },
];
export const TOTAL_DUELS = SPRITES.length;

export const duelLevels: readonly Level[] = SPRITES.map((sprite) => ({
  id: `dragon-duel-${sprite.stage}`,
  title: `duel${sprite.stage}` as MessageKey,
  description: `duel${sprite.stage}Help` as MessageKey,
  skills: ['dragon-duel', sprite.skill],
  format: 'dragon-duel',
  group: sprite.group,
}));

export function duelSprite(id: string | null | undefined): Sprite | undefined {
  const match = /^dragon-duel-([1-8])$/.exec(id ?? '');
  return match ? SPRITES.find((sprite) => sprite.stage === Number(match[1])) : undefined;
}

/** How fast the sprite charges its zap. `off` never charges: the child takes all the time. */
export type DuelPace = 'off' | 'relaxed' | 'normal' | 'fast';
export const DUEL_PACES: readonly DuelPace[] = ['off', 'relaxed', 'normal', 'fast'];
const PACE_SECONDS: Readonly<Record<DuelPace, number | null>> = {
  off: null,
  relaxed: 24,
  normal: 15,
  fast: 9,
};

export function parseDuelPace(value: unknown): DuelPace {
  return DUEL_PACES.find((pace) => pace === value) ?? 'off';
}

/** Seconds a full charge takes against this sprite, or null when the sprite never charges. */
export function chargeSeconds(pace: DuelPace, sprite: Sprite): number | null {
  const seconds = PACE_SECONDS[pace];
  return seconds === null ? null : Math.round(seconds * sprite.slow);
}

/** A first-try answer within this many seconds (times the sprite's `slow`) is a critical hit. */
export const QUICK_SECONDS = 6;
export const HEARTS = 3;
/** A wrong answer feeds the sprite's charge by this share, when it charges at all. */
export const WRONG_CHARGE = 0.34;
/** Warmth a won duel adds to the egg on top of each right answer. */
export const EGG_BONUS = 5;

export type DuelPhase = 'fighting' | 'won' | 'napping';

export interface Hit {
  readonly damage: number;
  /** A quick first try. */
  readonly critical: boolean;
  /** The dragon's element is the sprite's weak spot. */
  readonly weakSpot: boolean;
}

export interface Duel {
  readonly sprite: Sprite;
  readonly element: DragonElement;
  readonly question: DuelQuestion;
  /** Choices already tried and wrong on this sum. */
  readonly struck: readonly number[];
  /** Energy the sprite has left. */
  readonly energy: number;
  readonly hearts: number;
  /** From 0 to 1; at 1 the sprite zaps the dragon. */
  readonly charge: number;
  /** Sums that needed more than one try. */
  readonly mistakes: number;
  readonly answered: number;
  readonly criticals: number;
  readonly phase: DuelPhase;
  /** Counters the scene plays an effect for once each. */
  readonly hits: number;
  readonly zaps: number;
  readonly giggles: number;
  /** What the last hit was, for the callout and a bigger blast. */
  readonly lastHit: Hit | null;
}

export function startDuel(
  sprite: Sprite,
  element: DragonElement,
  random: Random = Math.random,
): Duel {
  return {
    sprite,
    element,
    question: duelQuestion(sprite.skill, random),
    struck: [],
    energy: sprite.energy,
    hearts: HEARTS,
    charge: 0,
    mistakes: 0,
    answered: 0,
    criticals: 0,
    phase: 'fighting',
    hits: 0,
    zaps: 0,
    giggles: 0,
    lastHit: null,
  };
}

/**
 * Damage for a right answer: 2 on the first try, 1 after a miss; a quick first try is a
 * critical hit (+1) and the sprite's weak spot takes +1 more.
 */
export function damageFor(firstTry: boolean, quick: boolean, weakSpot: boolean): Hit {
  const critical = firstTry && quick;
  return {
    damage: (firstTry ? 2 : 1) + (critical ? 1 : 0) + (weakSpot ? 1 : 0),
    critical,
    weakSpot,
  };
}

/** The child picks an answer; `seconds` is how long they thought about this sum. */
export function answer(
  state: Duel,
  value: number,
  seconds: number,
  pace: DuelPace,
  random: Random = Math.random,
): Duel {
  if (state.phase !== 'fighting' || state.struck.includes(value)) return state;
  if (value !== state.question.answer) {
    // Without a charge the sprite only giggles; otherwise a wrong pick feeds its charge.
    const charges = chargeSeconds(pace, state.sprite) !== null;
    const charge = charges ? Math.min(1, state.charge + WRONG_CHARGE) : 0;
    const missed: Duel = {
      ...state,
      struck: [...state.struck, value],
      mistakes: state.mistakes + (state.struck.length === 0 ? 1 : 0),
      charge,
      giggles: state.giggles + 1,
      lastHit: null,
    };
    return charge >= 1 ? zap(missed) : missed;
  }
  const hit = damageFor(
    state.struck.length === 0,
    seconds <= QUICK_SECONDS * state.sprite.slow,
    state.sprite.weakTo === state.element,
  );
  const energy = Math.max(0, state.energy - hit.damage);
  const won = energy === 0;
  return {
    ...state,
    energy,
    answered: state.answered + 1,
    criticals: state.criticals + (hit.critical ? 1 : 0),
    struck: [],
    charge: 0,
    hits: state.hits + 1,
    lastHit: hit,
    phase: won ? 'won' : 'fighting',
    question: won ? state.question : duelQuestion(state.sprite.skill, random, state.question.text),
  };
}

/** The sprite charges while the child thinks. */
export function charge(state: Duel, seconds: number, pace: DuelPace): Duel {
  const full = chargeSeconds(pace, state.sprite);
  if (state.phase !== 'fighting' || full === null || seconds <= 0) return state;
  const next = Math.min(1, state.charge + seconds / full);
  return next >= 1 ? zap(state) : { ...state, charge: next };
}

/** A full charge zaps the dragon: one heart gone, the same sum stays for another try. */
export function zap(state: Duel): Duel {
  if (state.phase !== 'fighting') return state;
  const hearts = state.hearts - 1;
  return {
    ...state,
    hearts,
    charge: 0,
    zaps: state.zaps + 1,
    phase: hearts <= 0 ? 'napping' : 'fighting',
  };
}

/** Stars for a won duel: no heart lost and at most one slip earns three. */
export function duelStars(state: Duel): number {
  if (state.phase !== 'won') return 0;
  const lost = HEARTS - state.hearts;
  if (lost === 0 && state.mistakes <= 1) return 3;
  if (lost <= 1 && state.mistakes <= 3) return 2;
  return 1;
}
