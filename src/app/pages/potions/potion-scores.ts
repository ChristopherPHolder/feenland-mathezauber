import { DOCUMENT } from '@angular/common';
import { inject, Service, signal } from '@angular/core';

const KEY = 'feenland.potion-scores.v1';

export function parsePotionScores(value: unknown): Readonly<Record<string, number>> {
  if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1)
    return {};
  const raw = (value as { best?: unknown }).best;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return Object.fromEntries(
    Object.entries(raw).filter(
      ([id, score]) =>
        /^potion-\d$/.test(id) &&
        typeof score === 'number' &&
        Number.isInteger(score) &&
        score >= 0,
    ),
  ) as Record<string, number>;
}

/** Most coins won per potion level, kept apart from stars and mastery. */
@Service()
export class PotionScores {
  private readonly document = inject(DOCUMENT);
  readonly best = signal<Readonly<Record<string, number>>>(this.restore());

  /** Returns true when `score` beats the stored best for `levelId`. */
  record(levelId: string, score: number): boolean {
    if ((this.best()[levelId] ?? 0) >= score) return false;
    this.best.update((best) => ({ ...best, [levelId]: score }));
    try {
      this.document.defaultView?.localStorage.setItem(
        KEY,
        JSON.stringify({ version: 1, best: this.best() }),
      );
    } catch {
      /* The best score stays for this visit. */
    }
    return true;
  }

  private restore() {
    try {
      return parsePotionScores(
        JSON.parse(this.document.defaultView?.localStorage.getItem(KEY) ?? 'null'),
      );
    } catch {
      return {};
    }
  }
}
