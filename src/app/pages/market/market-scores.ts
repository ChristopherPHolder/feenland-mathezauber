import { DOCUMENT } from '@angular/common';
import { computed, inject, Service, signal } from '@angular/core';
import { GOOD_IDS, GoodId } from './market-levels';

const KEY = 'feenland.market-scores.v1';
const LEVEL_ID = /^market-\d{1,2}$/;

export interface MarketSave {
  /** Most points won per level. */
  readonly best: Readonly<Record<string, number>>;
  /** Every different treat Lumi ever bought, in the order she first bought it. */
  readonly shelf: readonly GoodId[];
}

const isGood = (value: unknown): value is GoodId =>
  typeof value === 'string' && (GOOD_IDS as readonly string[]).includes(value);

export function parseMarketSave(value: unknown): MarketSave {
  const empty: MarketSave = { best: {}, shelf: [] };
  if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1)
    return empty;
  const raw = value as { best?: unknown; shelf?: unknown };
  const best =
    raw.best && typeof raw.best === 'object' && !Array.isArray(raw.best)
      ? (Object.fromEntries(
          Object.entries(raw.best).filter(
            ([id, score]) =>
              (id === 'market-basket' || LEVEL_ID.test(id)) &&
              typeof score === 'number' &&
              Number.isInteger(score) &&
              score >= 0,
          ),
        ) as Record<string, number>)
      : {};
  const shelf = Array.isArray(raw.shelf) ? [...new Set(raw.shelf.filter(isGood))] : [];
  return { best, shelf };
}

/** Best points per market level and Lumi's shelf of every treat she has bought. */
@Service()
export class MarketScores {
  private readonly document = inject(DOCUMENT);
  private readonly save = signal<MarketSave>(this.restore());
  readonly best = computed(() => this.save().best);
  readonly shelf = computed(() => this.save().shelf);

  /**
   * Records a finished round and the treats bought in it. Returns whether the score is a new
   * best and how many treats are new on the shelf.
   */
  record(levelId: string, score: number, bought: readonly GoodId[]) {
    const save = this.save();
    const best = (save.best[levelId] ?? 0) < score;
    const fresh = [...new Set(bought)].filter((good) => !save.shelf.includes(good));
    if (!best && !fresh.length) return { best: false, fresh: 0 };
    this.save.set({
      best: best ? { ...save.best, [levelId]: score } : save.best,
      shelf: [...save.shelf, ...fresh],
    });
    try {
      this.document.defaultView?.localStorage.setItem(
        KEY,
        JSON.stringify({ version: 1, ...this.save() }),
      );
    } catch {
      /* The shelf stays for this visit. */
    }
    return { best, fresh: fresh.length };
  }

  private restore(): MarketSave {
    try {
      return parseMarketSave(
        JSON.parse(this.document.defaultView?.localStorage.getItem(KEY) ?? 'null'),
      );
    } catch {
      return { best: {}, shelf: [] };
    }
  }
}
