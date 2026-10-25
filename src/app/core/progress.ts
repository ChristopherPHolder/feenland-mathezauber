import { DOCUMENT } from '@angular/common';
import { computed, inject, Service, signal } from '@angular/core';
import {
  emptyProgress,
  findLevel,
  nextLevel,
  parseProgress,
  Progress,
  WORLD_CATALOG,
} from './catalog';
import { applyResult, LevelResult } from './results';
@Service()
export class ProgressService {
  private readonly catalog = inject(WORLD_CATALOG);
  private readonly document = inject(DOCUMENT);
  private readonly state = signal<Progress>(this.load());
  readonly progress = this.state.asReadonly();
  readonly saveFailed = signal(false);
  readonly next = computed(() => nextLevel(this.catalog, this.progress()));
  readonly nextWorld = computed(() => findLevel(this.catalog, this.next()?.id ?? null)?.world);
  explore(worldId: string) {
    if (
      !this.catalog.some((world) => world.id === worldId) ||
      this.progress().explored.includes(worldId)
    )
      return;
    this.state.update((progress) => ({ ...progress, explored: [...progress.explored, worldId] }));
    this.save(this.progress());
  }
  record(result: LevelResult): boolean {
    const progress = applyResult(this.catalog, this.progress(), result);
    if (!progress) return false;
    this.state.set(progress);
    this.save(progress);
    return true;
  }
  private save(progress: Progress) {
    const key = 'feenland.progress';
    try {
      const storage = this.document.defaultView?.localStorage;
      const original = storage?.getItem(key);
      if (original !== null && original !== undefined) {
        let supported = false;
        try {
          const value: unknown = JSON.parse(original);
          supported =
            !!value &&
            typeof value === 'object' &&
            'version' in value &&
            value.version === 1 &&
            'mastered' in value &&
            Array.isArray(value.mastered) &&
            'chapters' in value &&
            Array.isArray(value.chapters) &&
            'explored' in value &&
            Array.isArray(value.explored);
        } catch {
          /* Keep the original corrupt save recoverable before replacing it. */
        }
        if (!supported) storage?.setItem(key + '.recovery', original);
      }
      storage?.setItem(key, JSON.stringify(progress));
      this.saveFailed.set(false);
    } catch {
      this.saveFailed.set(true);
    }
  }
  private load(): Progress {
    try {
      return parseProgress(
        JSON.parse(this.document.defaultView?.localStorage.getItem('feenland.progress') ?? 'null'),
      );
    } catch {
      return emptyProgress;
    }
  }
}
