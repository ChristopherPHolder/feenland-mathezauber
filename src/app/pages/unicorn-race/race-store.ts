import { DOCUMENT } from '@angular/common';
import { inject, Service, signal } from '@angular/core';
import { Pace, paces } from './race';
import { RaceLevel, raceLevels } from './race-questions';
export type Cup = 'gold' | 'silver' | 'bronze';
export interface RaceRecord {
  readonly cup: Cup;
  /** Fastest race in milliseconds; absent for turn-based races. */
  readonly bestMs?: number;
}
export interface RaceSave {
  readonly version: 1;
  readonly records: Readonly<Partial<Record<RaceLevel, RaceRecord>>>;
  readonly sparkles: number;
  readonly pace: Pace;
}
const STORAGE_KEY = 'feenland.unicorn-race.v1';
const empty: RaceSave = { version: 1, records: {}, sparkles: 0, pace: 'off' };
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
  record(level: RaceLevel): RaceRecord | undefined {
    return this.save().records[level];
  }
  /** Keeps the better cup and the faster time; returns true when the time is a new best. */
  recordRace(level: RaceLevel, cup: Cup, sparkles: number, ms?: number): boolean {
    const previous = this.record(level);
    const bestCup = previous && CUP_RANK[previous.cup] >= CUP_RANK[cup] ? previous.cup : cup;
    const newBest = ms !== undefined && (previous?.bestMs === undefined || ms < previous.bestMs);
    const bestMs = newBest ? ms : previous?.bestMs;
    this.state.update((save) => ({
      ...save,
      records: {
        ...save.records,
        [level]: { cup: bestCup, ...(bestMs !== undefined ? { bestMs } : {}) },
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
      if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1)
        return empty;
      const record = value as Record<string, unknown>;
      const records: Partial<Record<RaceLevel, RaceRecord>> = {};
      const saved = record['records'];
      if (saved && typeof saved === 'object')
        for (const level of raceLevels) {
          const entry = (saved as Record<string, unknown>)[String(level)];
          if (!entry || typeof entry !== 'object') continue;
          const cup = (entry as Record<string, unknown>)['cup'];
          const bestMs = (entry as Record<string, unknown>)['bestMs'];
          if (cup !== 'gold' && cup !== 'silver' && cup !== 'bronze') continue;
          records[level] = {
            cup,
            ...(typeof bestMs === 'number' && bestMs > 0 ? { bestMs: Math.floor(bestMs) } : {}),
          };
        }
      const sparkles =
        typeof record['sparkles'] === 'number' && record['sparkles'] >= 0
          ? Math.floor(record['sparkles'])
          : 0;
      const pace = paces.find((pace) => pace === record['pace']) ?? empty.pace;
      return { version: 1, records, sparkles, pace };
    } catch {
      return empty;
    }
  }
}
