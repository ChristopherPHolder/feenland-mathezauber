import { Horse, LUMI, readHorse } from './horse';
import { Outfit, outfits } from './outfits';
/** Where the race keeps its save on the device. */
export const RACE_SAVE_KEY = 'feenland.unicorn-race.v1';
/**
 * The child's horse and keepsake straight from the save, for the loading scene, which runs
 * before the race page (and its store) has downloaded. Anything unreadable is Lumi.
 */
export function savedLook(storage: Pick<Storage, 'getItem'> | undefined): {
  horse: Horse;
  outfit: Outfit | null;
} {
  try {
    const save: unknown = JSON.parse(storage?.getItem(RACE_SAVE_KEY) ?? 'null');
    if (!save || typeof save !== 'object') return { horse: LUMI, outfit: null };
    const record = save as Record<string, unknown>;
    return {
      horse: readHorse(record['horse']),
      outfit: outfits.find((outfit) => outfit === record['outfit']) ?? null,
    };
  } catch {
    return { horse: LUMI, outfit: null };
  }
}
