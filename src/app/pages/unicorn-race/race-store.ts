import { DOCUMENT } from '@angular/common';
import { inject, Service, signal } from '@angular/core';
import { Pace, paces } from './race';
import {
  cupTracks,
  HeatNumber,
  heatNumbers,
  RaceCup,
  raceCups,
  RaceLevel,
  raceLevels,
} from './race-questions';
/** One keepsake per cup; Lumi wears the chosen one in every race. */
export type Outfit = 'wreath' | 'wings' | 'tiara' | 'crown' | 'cape';
export const outfits: readonly Outfit[] = ['wreath', 'wings', 'tiara', 'crown', 'cape'];
export const OUTFIT_CUP: Readonly<Record<Outfit, RaceCup>> = {
  wreath: 'meadow',
  wings: 'sky',
  tiara: 'star',
  crown: 'castle',
  cape: 'rainbow',
};
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
}
const STORAGE_KEY = 'feenland.unicorn-race.v1';
const empty: RaceSave = { version: 2, records: {}, sparkles: 0, pace: 'normal', outfit: null };
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
  /** A cup is complete once every track in it has at least one finished heat. */
  cupComplete(cup: RaceCup): boolean {
    return cupTracks(cup).every((track) => this.heatsDone(track.stage) > 0);
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
  private persist() {
    try {
      this.document.defaultView?.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.save()));
      this.saveFailed.set(false);
    } catch {
      this.saveFailed.set(true);
    }
  }
  private load(): RaceSave {
    try {
      const value: unknown = JSON.parse(
        this.document.defaultView?.localStorage.getItem(STORAGE_KEY) ?? 'null',
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
      return { version: 2, records, sparkles, pace, outfit };
    } catch {
      return empty;
    }
  }
}
