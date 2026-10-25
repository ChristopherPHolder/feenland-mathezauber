import { DOCUMENT } from '@angular/common';
import { inject, Service, signal } from '@angular/core';
import { levels, Pace, paces, Rating, WallLevel } from './number-wall';
export interface WallSave {
  readonly version: 1;
  /** Best star rating per level, 1–3; absent until the level's first world is built. */
  readonly ratings: Readonly<Partial<Record<WallLevel, Rating>>>;
  readonly bestStreak: number;
  readonly gems: number;
  readonly pace: Pace;
}
const STORAGE_KEY = 'feenland.number-wall.v1';
const empty: WallSave = { version: 1, ratings: {}, bestStreak: 0, gems: 0, pace: 'steady' };
/** Stars, gems and the best streak stay on the device, separately from earned catalog progress. */
@Service()
export class NumberWallStore {
  private readonly document = inject(DOCUMENT);
  private readonly state = signal<WallSave>(this.load());
  readonly save = this.state.asReadonly();
  rating(level: WallLevel): Rating | 0 {
    return this.save().ratings[level] ?? 0;
  }
  hasStar(level: WallLevel): boolean {
    return this.rating(level) > 0;
  }
  /** Every level is open from the start; stars reward finishing a level, they never gate one. */
  unlocked(level: WallLevel): boolean {
    return levels.includes(level);
  }
  starredLevels(): number {
    return levels.filter((level) => this.hasStar(level)).length;
  }
  recordWorld(level: WallLevel, rating: Rating, gems: number) {
    this.state.update((save) => ({
      ...save,
      ratings: { ...save.ratings, [level]: Math.max(save.ratings[level] ?? 0, rating) as Rating },
      gems: save.gems + gems,
    }));
    this.persist();
  }
  recordStreak(streak: number) {
    if (streak <= this.save().bestStreak) return;
    this.state.update((save) => ({ ...save, bestStreak: streak }));
    this.persist();
  }
  setPace(pace: Pace) {
    this.state.update((save) => ({ ...save, pace }));
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
      const record = value as Record<string, unknown>;
      const ratings: Partial<Record<WallLevel, Rating>> = {};
      // Earlier saves listed starred levels; each counts as one star.
      if (Array.isArray(record['stars']))
        for (const level of record['stars'])
          if (levels.includes(level as WallLevel)) ratings[level as WallLevel] = 1;
      const saved = record['ratings'];
      if (saved && typeof saved === 'object')
        for (const level of levels) {
          const rating = (saved as Record<string, unknown>)[String(level)];
          if (rating === 1 || rating === 2 || rating === 3) ratings[level] = rating;
        }
      const count = (key: string) =>
        typeof record[key] === 'number' && (record[key] as number) >= 0
          ? Math.floor(record[key] as number)
          : 0;
      const pace = paces.find((pace) => pace === record['pace']) ?? empty.pace;
      return { version: 1, ratings, bestStreak: count('bestStreak'), gems: count('gems'), pace };
    } catch {
      return empty;
    }
  }
}
