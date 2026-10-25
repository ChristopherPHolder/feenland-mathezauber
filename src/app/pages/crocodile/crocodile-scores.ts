import { DOCUMENT } from '@angular/common';
import { inject, Service, signal } from '@angular/core';
import { parseBestScores } from './crocodile-score';
const KEY = 'feenland.crocodile-scores.v1';
/** Best points per crocodile level. Kept apart from earned stars and mastery. */
@Service()
export class CrocodileScores {
  private readonly document = inject(DOCUMENT);
  readonly best = signal<Readonly<Record<string, number>>>(this.restore());
  readonly saveFailed = signal(false);
  /** Returns true when `score` beats the stored best for `levelId`. */
  record(levelId: string, score: number): boolean {
    if ((this.best()[levelId] ?? 0) >= score) return false;
    this.best.update((best) => ({ ...best, [levelId]: score }));
    try {
      this.document.defaultView?.localStorage.setItem(
        KEY,
        JSON.stringify({ version: 1, best: this.best() }),
      );
      this.saveFailed.set(false);
    } catch {
      this.saveFailed.set(true);
    }
    return true;
  }
  private restore() {
    try {
      return parseBestScores(
        JSON.parse(this.document.defaultView?.localStorage.getItem(KEY) ?? 'null'),
      );
    } catch {
      return {};
    }
  }
}
