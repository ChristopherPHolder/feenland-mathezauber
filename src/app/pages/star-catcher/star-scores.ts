import { DOCUMENT } from '@angular/common';
import { inject, Service, signal } from '@angular/core';
import { ALL_CONSTELLATIONS, parseStarPace, StarPace } from './star-levels';
import type { ConstellationId } from './star-constellations';

const KEY = 'feenland.star-scores.v1';
const PACE_KEY = 'feenland.star-pace.v1';

export interface StarRecords {
  readonly best: Readonly<Record<string, number>>;
  readonly constellations: readonly ConstellationId[];
}

export function parseStarRecords(value: unknown): StarRecords {
  const empty: StarRecords = { best: {}, constellations: [] };
  if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1)
    return empty;
  const raw = (value as { best?: unknown }).best;
  const best =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (Object.fromEntries(
          Object.entries(raw).filter(
            ([id, score]) =>
              /^star-catcher-\d{1,2}$/.test(id) &&
              typeof score === 'number' &&
              Number.isInteger(score) &&
              score >= 0,
          ),
        ) as Record<string, number>)
      : {};
  const list = (value as { constellations?: unknown }).constellations;
  const constellations = Array.isArray(list)
    ? ALL_CONSTELLATIONS.filter((id) => list.includes(id))
    : [];
  return { best, constellations };
}

/**
 * The star catcher's keepsakes: the most points per level, the constellations already drawn
 * (they stay in the sky and fill the collection), and the remembered falling pace. Kept apart
 * from stars and mastery; bad or missing storage simply starts empty.
 */
@Service()
export class StarScores {
  private readonly document = inject(DOCUMENT);
  private readonly records = this.restore();
  readonly best = signal<Readonly<Record<string, number>>>(this.records.best);
  readonly constellations = signal<readonly ConstellationId[]>(this.records.constellations);

  /** Returns true when `score` beats the stored best for `levelId`. */
  record(levelId: string, score: number): boolean {
    if ((this.best()[levelId] ?? 0) >= score) return false;
    this.best.update((best) => ({ ...best, [levelId]: score }));
    this.save();
    return true;
  }

  /** Puts a finished constellation in the sky for good. */
  draw(id: ConstellationId) {
    if (this.constellations().includes(id)) return;
    this.constellations.update((list) =>
      ALL_CONSTELLATIONS.filter((c) => c === id || list.includes(c)),
    );
    this.save();
  }

  pace(): StarPace {
    try {
      return parseStarPace(this.document.defaultView?.localStorage.getItem(PACE_KEY));
    } catch {
      return 'off';
    }
  }

  rememberPace(pace: StarPace) {
    try {
      this.document.defaultView?.localStorage.setItem(PACE_KEY, pace);
    } catch {
      /* The pace stays for this visit. */
    }
  }

  private save() {
    try {
      this.document.defaultView?.localStorage.setItem(
        KEY,
        JSON.stringify({ version: 1, best: this.best(), constellations: this.constellations() }),
      );
    } catch {
      /* The records stay for this visit. */
    }
  }

  private restore(): StarRecords {
    try {
      return parseStarRecords(
        JSON.parse(this.document.defaultView?.localStorage.getItem(KEY) ?? 'null'),
      );
    } catch {
      return { best: {}, constellations: [] };
    }
  }
}
