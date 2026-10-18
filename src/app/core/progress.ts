import { DOCUMENT } from '@angular/common';
import { computed, inject, Service, signal } from '@angular/core';
import { emptyProgress, nextLevel, parseProgress, Progress, WORLD_CATALOG } from './catalog';
@Service()
export class ProgressService {
  private readonly catalog = inject(WORLD_CATALOG);
  private readonly document = inject(DOCUMENT);
  private readonly state = signal<Progress>(this.load());
  readonly progress = this.state.asReadonly();
  readonly saveFailed = signal(false);
  readonly next = computed(() => nextLevel(this.catalog, this.progress()));
  explore(worldId: string) {
    if (
      !this.catalog.some((world) => world.id === worldId) ||
      this.progress().explored.includes(worldId)
    )
      return;
    this.state.update((progress) => ({ ...progress, explored: [...progress.explored, worldId] }));
    try {
      this.document.defaultView?.localStorage.setItem(
        'feenland.progress',
        JSON.stringify(this.progress()),
      );
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
