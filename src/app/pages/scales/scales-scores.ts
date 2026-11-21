import { DOCUMENT } from '@angular/common';
import { computed, inject, Service, signal } from '@angular/core';

const KEY = 'feenland.scales.v1';
const LEVEL_ID = /^scales-([1-9]|1[0-2])$/;

export interface ScalesRecord {
  readonly version: 1;
  /** Most points per level. */
  readonly best: Readonly<Record<string, number>>;
  /** Levels finished at least once: each puts its dish on the feast table. */
  readonly dishes: readonly string[];
}

const empty = (): ScalesRecord => ({ version: 1, best: {}, dishes: [] });

export function parseScales(value: unknown): ScalesRecord {
  if (!value || typeof value !== 'object' || (value as { version?: unknown }).version !== 1)
    return empty();
  const raw = value as Partial<Record<keyof ScalesRecord, unknown>>;
  const best =
    raw.best && typeof raw.best === 'object' && !Array.isArray(raw.best)
      ? Object.fromEntries(
          Object.entries(raw.best).filter(
            ([id, score]) => LEVEL_ID.test(id) && Number.isInteger(score) && (score as number) >= 0,
          ),
        )
      : {};
  const dishes = Array.isArray(raw.dishes)
    ? [
        ...new Set(
          raw.dishes.filter((id): id is string => typeof id === 'string' && LEVEL_ID.test(id)),
        ),
      ]
    : [];
  return { version: 1, best: best as Record<string, number>, dishes };
}

/**
 * What Bramble's kitchen remembers between visits: best points per level and the dishes on
 * the feast table. Saved on the device only.
 */
@Service()
export class ScalesScores {
  private readonly document = inject(DOCUMENT);
  private readonly state = signal<ScalesRecord>(this.restore());
  readonly best = computed(() => this.state().best);
  /** One plate per level, in level order: true once its dish was cooked. */
  readonly table = computed(() =>
    Array.from({ length: 12 }, (_, index) => this.state().dishes.includes(`scales-${index + 1}`)),
  );
  readonly dishes = computed(() => this.state().dishes.length);

  /** Records a finished round. Returns whether it was a new best and whether a dish was added. */
  finish(levelId: string, score: number): { best: boolean; dish: boolean } {
    const state = this.state();
    const best = (state.best[levelId] ?? 0) < score;
    const dish = !state.dishes.includes(levelId);
    this.update({
      best: best ? { ...state.best, [levelId]: score } : state.best,
      dishes: dish ? [...state.dishes, levelId] : state.dishes,
    });
    return { best, dish };
  }

  private update(change: Partial<ScalesRecord>) {
    this.state.update((state) => ({ ...state, ...change }));
    try {
      this.document.defaultView?.localStorage.setItem(KEY, JSON.stringify(this.state()));
    } catch {
      /* The kitchen remembers this visit only. */
    }
  }

  private restore(): ScalesRecord {
    try {
      return parseScales(
        JSON.parse(this.document.defaultView?.localStorage.getItem(KEY) ?? 'null'),
      );
    } catch {
      return empty();
    }
  }
}
