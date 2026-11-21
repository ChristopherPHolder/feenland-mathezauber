import { DOCUMENT } from '@angular/common';
import { inject, Service, signal } from '@angular/core';
import { Pace, paces } from './race';
import {
  cupTracks,
  KEEPSAKE_TRACKS,
  HeatNumber,
  heatNumbers,
  RaceCup,
  raceCups,
  RaceLevel,
  raceLevels,
} from './race-questions';
import { Horse, LUMI, readHorse, SpecialId, specialIds, specialPrice, specialsOf } from './horse';
import { Outfit, OUTFIT_CUP, outfits } from './outfits';
import { RACE_SAVE_KEY } from './saved-look';
export { type Outfit, OUTFIT_CUP, outfits } from './outfits';
export type Cup = 'gold' | 'silver' | 'bronze';
export interface RaceRecord {
  readonly cup: Cup;
  /** Fastest race in milliseconds; absent for races saved before every race was timed. */
  readonly bestMs?: number;
}
/** Records are keyed "track:heat". Version 1 saves kept one record per track. */
export type RecordKey = `${RaceLevel}:${HeatNumber}`;
export interface RaceSave {
  readonly version: 2;
  readonly records: Readonly<Partial<Record<RecordKey, RaceRecord>>>;
  readonly sparkles: number;
  readonly pace: Pace;
  readonly outfit: Outfit | null;
  /**
   * The horse the child races with. It came after version 2 and stays inside it, so a tab still
   * running an older build reads the save instead of wiping it as unknown.
   */
  readonly horse: Horse;
  /** The Stable opens by itself once, the first time a child comes to the race. */
  readonly stableSeen: boolean;
  /** Sparkle specials bought in the Stable, and the sparkles spent on them. */
  readonly owned: readonly SpecialId[];
  readonly spent: number;
}
const empty: RaceSave = {
  version: 2,
  records: {},
  sparkles: 0,
  pace: 'normal',
  outfit: null,
  horse: LUMI,
  stableSeen: false,
  owned: [],
  spent: 0,
};
const CUP_RANK: Readonly<Record<Cup, number>> = { gold: 3, silver: 2, bronze: 1 };
export function cupFor(place: 1 | 2 | 3 | 4): Cup {
  return place === 1 ? 'gold' : place === 2 ? 'silver' : 'bronze';
}
/** Cups, best times and sparkles stay on the device, apart from earned catalog progress. */
@Service()
export class RaceStore {
  private readonly document = inject(DOCUMENT);
  private readonly state = signal<RaceSave>(this.load());
  readonly save = this.state.asReadonly();
  readonly saveFailed = signal(false);
  record(level: RaceLevel, heat: HeatNumber): RaceRecord | undefined {
    return this.save().records[`${level}:${heat}`];
  }
  /** How many of a track's heats have been finished. */
  heatsDone(level: RaceLevel): number {
    return heatNumbers.filter((heat) => !!this.record(level, heat)).length;
  }
  /** The best cup earned on any heat of a track. */
  bestCup(level: RaceLevel): Cup | undefined {
    return heatNumbers
      .map((heat) => this.record(level, heat)?.cup)
      .filter((cup): cup is Cup => !!cup)
      .sort((a, b) => CUP_RANK[b] - CUP_RANK[a])[0];
  }
  /** The first heat not yet finished, or the last one once all are. */
  nextHeat(level: RaceLevel): HeatNumber {
    return (
      heatNumbers.find((heat) => !this.record(level, heat)) ?? heatNumbers[heatNumbers.length - 1]
    );
  }
  /** Keeps the better cup and the faster time; returns true when the time is a new best. */
  recordRace(level: RaceLevel, heat: HeatNumber, cup: Cup, sparkles: number, ms?: number): boolean {
    const previous = this.record(level, heat);
    const bestCup = previous && CUP_RANK[previous.cup] >= CUP_RANK[cup] ? previous.cup : cup;
    const newBest = ms !== undefined && (previous?.bestMs === undefined || ms < previous.bestMs);
    const bestMs = newBest ? ms : previous?.bestMs;
    this.state.update((save) => ({
      ...save,
      records: {
        ...save.records,
        [`${level}:${heat}`]: { cup: bestCup, ...(bestMs !== undefined ? { bestMs } : {}) },
      },
      sparkles: save.sparkles + sparkles,
    }));
    this.persist();
    return newBest;
  }
  setPace(pace: Pace) {
    this.state.update((save) => ({ ...save, pace }));
    this.persist();
  }
  /**
   * A cup is complete once three of its tracks have a finished heat. Cups grew to four tracks,
   * and a keepsake Lumi already wears must never be taken away again.
   */
  cupComplete(cup: RaceCup): boolean {
    const done = cupTracks(cup).filter((track) => this.heatsDone(track.stage) > 0).length;
    return done >= Math.min(KEEPSAKE_TRACKS, cupTracks(cup).length);
  }
  completedCups(): number {
    return raceCups.filter((cup) => this.cupComplete(cup)).length;
  }
  earned(outfit: Outfit): boolean {
    return this.cupComplete(OUTFIT_CUP[outfit]);
  }
  /** Dresses Lumi in an earned outfit, or in nothing; an unearned one is ignored. */
  wear(outfit: Outfit | null) {
    if (outfit && !this.earned(outfit)) return;
    this.state.update((save) => ({ ...save, outfit }));
    this.persist();
  }
  /** Sparkles earned and not yet spent in the Stable. */
  balance(): number {
    return Math.max(0, this.save().sparkles - this.save().spent);
  }
  owns(id: SpecialId): boolean {
    return this.save().owned.includes(id);
  }
  /** Saves the horse the child made in the Stable; a special not bought yet is not taken on. */
  setHorse(horse: Horse) {
    const clean = readHorse(horse);
    if (specialsOf(clean).some((id) => !this.owns(id))) return;
    this.state.update((save) => ({ ...save, horse: clean }));
    this.persist();
  }
  /** Buys a special once; false when it is not for sale, already owned, or too dear. */
  buy(id: SpecialId): boolean {
    const price = specialPrice(id);
    if (price === undefined || this.owns(id) || this.balance() < price) return false;
    this.state.update((save) => ({
      ...save,
      owned: [...save.owned, id],
      spent: save.spent + price,
    }));
    this.persist();
    return true;
  }
  /** Remembers that the child has been to the Stable, so it no longer opens by itself. */
  leaveStable() {
    if (this.save().stableSeen) return;
    this.state.update((save) => ({ ...save, stableSeen: true }));
    this.persist();
  }
  private persist() {
    try {
      this.document.defaultView?.localStorage.setItem(RACE_SAVE_KEY, JSON.stringify(this.save()));
      this.saveFailed.set(false);
    } catch {
      this.saveFailed.set(true);
    }
  }
  private load(): RaceSave {
    try {
      const value: unknown = JSON.parse(
        this.document.defaultView?.localStorage.getItem(RACE_SAVE_KEY) ?? 'null',
      );
      if (
        !value ||
        typeof value !== 'object' ||
        !('version' in value) ||
        (value.version !== 1 && value.version !== 2)
      )
        return empty;
      const record = value as Record<string, unknown>;
      const records: Partial<Record<RecordKey, RaceRecord>> = {};
      const saved = record['records'];
      if (saved && typeof saved === 'object')
        for (const level of raceLevels)
          for (const heat of heatNumbers) {
            // A version 1 record covered the whole track; it now counts as its first heat.
            const key =
              value.version === 1 ? (heat === 1 ? String(level) : '') : `${level}:${heat}`;
            const entry = key ? (saved as Record<string, unknown>)[key] : undefined;
            if (!entry || typeof entry !== 'object') continue;
            const cup = (entry as Record<string, unknown>)['cup'];
            const bestMs = (entry as Record<string, unknown>)['bestMs'];
            if (cup !== 'gold' && cup !== 'silver' && cup !== 'bronze') continue;
            records[`${level}:${heat}`] = {
              cup,
              ...(typeof bestMs === 'number' && bestMs > 0 ? { bestMs: Math.floor(bestMs) } : {}),
            };
          }
      const sparkles =
        typeof record['sparkles'] === 'number' && record['sparkles'] >= 0
          ? Math.floor(record['sparkles'])
          : 0;
      const pace = paces.find((pace) => pace === record['pace']) ?? empty.pace;
      const outfit = outfits.find((outfit) => outfit === record['outfit']) ?? null;
      const bought = record['owned'];
      const owned = specialIds.filter((id) => Array.isArray(bought) && bought.includes(id));
      const spent =
        typeof record['spent'] === 'number' && record['spent'] >= 0
          ? Math.min(sparkles, Math.floor(record['spent']))
          : 0;
      // A horse wearing a special the save does not own goes back to Lumi's coat or mane.
      const read = readHorse(record['horse']);
      const horse = {
        ...read,
        coat:
          owned.includes(`coat:${read.coat}`) || !specialPrice(`coat:${read.coat}`)
            ? read.coat
            : LUMI.coat,
        mane:
          owned.includes(`mane:${read.mane}`) || !specialPrice(`mane:${read.mane}`)
            ? read.mane
            : LUMI.mane,
      };
      const stableSeen = record['stableSeen'] === true;
      return { version: 2, records, sparkles, pace, outfit, horse, stableSeen, owned, spent };
    } catch {
      return empty;
    }
  }
}
