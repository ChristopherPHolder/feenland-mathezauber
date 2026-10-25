import { DOCUMENT } from '@angular/common';
import { inject, Service, signal } from '@angular/core';
import { WallLevel } from './number-wall';
export interface WallSave {
  readonly version: 1;
  readonly stars: readonly WallLevel[];
  readonly bestStreak: number;
}
const STORAGE_KEY = 'feenland.number-wall.v1';
const empty: WallSave = { version: 1, stars: [], bestStreak: 0 };
/** Stars and the best streak stay on the device, separately from earned catalog progress. */
@Service()
export class NumberWallStore {
  private readonly document = inject(DOCUMENT);
  private readonly state = signal<WallSave>(this.load());
  readonly save = this.state.asReadonly();
  hasStar(level: WallLevel): boolean {
    return this.save().stars.includes(level);
  }
  unlocked(level: WallLevel): boolean {
    return level === 1 || this.hasStar((level - 1) as WallLevel);
  }
  earnStar(level: WallLevel) {
    if (this.hasStar(level)) return;
    this.state.update((save) => ({ ...save, stars: [...save.stars, level].sort() }));
    this.persist();
  }
  recordStreak(streak: number) {
    if (streak <= this.save().bestStreak) return;
    this.state.update((save) => ({ ...save, bestStreak: streak }));
    this.persist();
  }
  private persist() {
    try {
      this.document.defaultView?.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.save()));
    } catch {
      /* Stars remain in memory for this visit. */
    }
  }
  private load(): WallSave {
    try {
      const value: unknown = JSON.parse(
        this.document.defaultView?.localStorage.getItem(STORAGE_KEY) ?? 'null',
      );
      if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1)
        return empty;
      const stars =
        'stars' in value && Array.isArray(value.stars)
          ? [...new Set(value.stars.filter((s): s is WallLevel => [1, 2, 3, 4].includes(s)))]
          : [];
      const bestStreak =
        'bestStreak' in value && typeof value.bestStreak === 'number' && value.bestStreak >= 0
          ? Math.floor(value.bestStreak)
          : 0;
      return { version: 1, stars: stars.sort(), bestStreak };
    } catch {
      return empty;
    }
  }
}
