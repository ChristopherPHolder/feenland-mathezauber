import type { RaceMessageKey } from './race-messages';
import type { RaceCup } from './race-questions';
/** One keepsake per cup; the child's horse wears the chosen one in every race. */
export type Outfit = 'wreath' | 'wings' | 'tiara' | 'crown' | 'cape';
export const outfits: readonly Outfit[] = ['wreath', 'wings', 'tiara', 'crown', 'cape'];
export const OUTFIT_CUP: Readonly<Record<Outfit, RaceCup>> = {
  wreath: 'meadow',
  wings: 'sky',
  tiara: 'star',
  crown: 'castle',
  cape: 'rainbow',
};
/** The picture for each cup keepsake, shown beside its name. */
const OUTFIT_EMBLEM: Readonly<Record<Outfit, string>> = {
  wreath: '🌸',
  wings: '🕊️',
  tiara: '✨',
  crown: '👑',
  cape: '🌈',
};
const capital = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);
export function outfitEmblem(outfit: Outfit): string {
  return OUTFIT_EMBLEM[outfit];
}
/** The message key for a keepsake's name; no keepsake is "Just Lumi". */
export function outfitNameKey(outfit: Outfit | null): RaceMessageKey {
  return outfit ? (`outfit${capital(outfit)}` as RaceMessageKey) : 'outfitNone';
}
export function cupTitleKey(cup: RaceCup): RaceMessageKey {
  return `cup${capital(cup)}` as RaceMessageKey;
}
