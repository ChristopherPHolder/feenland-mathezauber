import { DOCUMENT } from '@angular/common';
import { inject, Service, signal } from '@angular/core';
import { isLevelResult, LevelResult } from './results';
import { ProgressService } from './progress';
@Service()
export class CompletionService {
  private readonly document = inject(DOCUMENT);
  private readonly p = inject(ProgressService);
  private readonly state = signal<LevelResult | null>(this.restore());
  readonly result = this.state.asReadonly();
  finish(result: LevelResult): boolean {
    if (!this.p.record(result)) return false;
    this.state.set(result);
    try {
      this.document.defaultView?.sessionStorage.setItem('feenland.result', JSON.stringify(result));
    } catch {
      /* Receipt remains available in memory. */
    }
    return true;
  }
  private restore(): LevelResult | null {
    try {
      const value: unknown = JSON.parse(
        this.document.defaultView?.sessionStorage.getItem('feenland.result') ?? 'null',
      );
      // Restoring a receipt never applies a result or awards anything.
      return isLevelResult(value) &&
        this.p.progressFor(value.source).completed?.includes(value.levelId)
        ? value
        : null;
    } catch {
      return null;
    }
  }
}
