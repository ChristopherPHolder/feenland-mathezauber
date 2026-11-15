import { DOCUMENT } from '@angular/common';
import { computed, inject, Service, signal } from '@angular/core';

const KEY = 'feenland.gondola-scores.v1';
const LEVEL_ID = /^gondola-\d{1,2}$/;

export interface GondolaSave {
  /** Most points won per level. */
  readonly best: Readonly<Record<string, number>>;
  /** Levels finished at least once, in the order they were first finished: one building each. */
  readonly built: readonly string[];
}

export function parseGondolaSave(value: unknown): GondolaSave {
  const empty: GondolaSave = { best: {}, built: [] };
  if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1)
    return empty;
  const raw = value as { best?: unknown; built?: unknown };
  const best =
    raw.best && typeof raw.best === 'object' && !Array.isArray(raw.best)
      ? (Object.fromEntries(
          Object.entries(raw.best).filter(
            ([id, score]) =>
              LEVEL_ID.test(id) && typeof score === 'number' && Number.isInteger(score) && score >= 0,
          ),
        ) as Record<string, number>)
      : {};
  const built = Array.isArray(raw.built)
    ? [...new Set(raw.built.filter((id): id is string => typeof id === 'string' && LEVEL_ID.test(id)))]
    : [];
  return { best, built };
}

/** Best points per gondola level and the summit village the finished levels have built. */
@Service()
export class GondolaScores {
  private readonly document = inject(DOCUMENT);
  private readonly save = signal<GondolaSave>(this.restore());
  readonly best = computed(() => this.save().best);
  /** Buildings in the summit village: one per level finished at least once. */
  readonly village = computed(() => this.save().built.length);

  /**
   * Records a finished round. Returns whether the score is a new best and whether the level
   * added a new building to the village (its first finish).
   */
  record(levelId: string, score: number): { best: boolean; building: number | null } {
    const save = this.save();
    const best = (save.best[levelId] ?? 0) < score;
    const fresh = !save.built.includes(levelId);
    if (!best && !fresh) return { best: false, building: null };
    this.save.set({
      best: best ? { ...save.best, [levelId]: score } : save.best,
      built: fresh ? [...save.built, levelId] : save.built,
    });
    try {
      this.document.defaultView?.localStorage.setItem(
        KEY,
        JSON.stringify({ version: 1, ...this.save() }),
      );
    } catch {
      /* The village stays for this visit. */
    }
    return { best, building: fresh ? this.save().built.length : null };
  }

  private restore(): GondolaSave {
    try {
      return parseGondolaSave(
        JSON.parse(this.document.defaultView?.localStorage.getItem(KEY) ?? 'null'),
      );
    } catch {
      return { best: {}, built: [] };
    }
  }
}
