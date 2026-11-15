import { DOCUMENT } from '@angular/common';
import { computed, inject, Service, signal } from '@angular/core';
import { DrumTempo, parseDrumTempo } from './drum-patterns';

const KEY = 'feenland.drum-scores.v1';

/** A lit hundred chart kept for the pattern gallery: its cells and how the pattern ran. */
export interface PatternPicture {
  readonly cells: readonly number[];
  readonly step: number;
  readonly start: number;
}

export interface DrumRecords {
  /** Best points per level and tempo, keyed `drums-3:slow`. */
  readonly best: Readonly<Record<string, number>>;
  /** The latest pattern picture per level. */
  readonly gallery: Readonly<Record<string, PatternPicture>>;
}

const LEVEL = /^drums-\d{1,2}$/;
const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

export function parseDrumRecords(value: unknown): DrumRecords {
  const empty = { best: {}, gallery: {} };
  if (!value || typeof value !== 'object' || (value as { version?: unknown }).version !== 1)
    return empty;
  const raw = value as { best?: unknown; gallery?: unknown };
  const best =
    raw.best && typeof raw.best === 'object' && !Array.isArray(raw.best)
      ? Object.fromEntries(
          Object.entries(raw.best).filter(([key, score]) => {
            const [level, tempo] = key.split(':');
            return LEVEL.test(level) && parseDrumTempo(tempo) === tempo && isCount(score);
          }),
        )
      : {};
  const gallery =
    raw.gallery && typeof raw.gallery === 'object' && !Array.isArray(raw.gallery)
      ? Object.fromEntries(
          Object.entries(raw.gallery).filter(([key, picture]) => {
            if (!LEVEL.test(key) || !picture || typeof picture !== 'object') return false;
            const { cells, step, start } = picture as Partial<PatternPicture>;
            return (
              Array.isArray(cells) &&
              cells.every(isCount) &&
              typeof step === 'number' &&
              Number.isInteger(step) &&
              isCount(start)
            );
          }),
        )
      : {};
  return { best, gallery } as DrumRecords;
}

/** Best points per level and tempo, and the pattern gallery. Kept apart from stars. */
@Service()
export class DrumScores {
  private readonly document = inject(DOCUMENT);
  private readonly records = signal<DrumRecords>(this.restore());
  readonly gallery = computed(() => this.records().gallery);
  /** The best points per level over every tempo, for the games hub. */
  readonly best = computed(() => {
    const best: Record<string, number> = {};
    for (const [key, score] of Object.entries(this.records().best)) {
      const level = key.split(':')[0];
      best[level] = Math.max(best[level] ?? 0, score);
    }
    return best as Readonly<Record<string, number>>;
  });

  bestFor(levelId: string, tempo: DrumTempo): number {
    return this.records().best[`${levelId}:${tempo}`] ?? 0;
  }

  /** Saves the round; returns true when `score` beats the best for this level and tempo. */
  record(levelId: string, tempo: DrumTempo, score: number, picture: PatternPicture): boolean {
    const key = `${levelId}:${tempo}`;
    const beaten = score > (this.records().best[key] ?? 0);
    this.records.update((records) => ({
      best: beaten ? { ...records.best, [key]: score } : records.best,
      gallery: { ...records.gallery, [levelId]: picture },
    }));
    try {
      this.document.defaultView?.localStorage.setItem(
        KEY,
        JSON.stringify({ version: 1, ...this.records() }),
      );
    } catch {
      /* The scores stay for this visit. */
    }
    return beaten;
  }

  private restore(): DrumRecords {
    try {
      return parseDrumRecords(
        JSON.parse(this.document.defaultView?.localStorage.getItem(KEY) ?? 'null'),
      );
    } catch {
      return { best: {}, gallery: {} };
    }
  }
}
