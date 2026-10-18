import { DOCUMENT } from '@angular/common';
import { computed, inject, Service, signal } from '@angular/core';
import { emptyProgress, nextLevel, parseProgress, Progress, WORLD_CATALOG } from './catalog';
import { applyResult, LevelResult, ResultSource } from './results';
@Service()
export class ProgressService {
  private readonly catalog = inject(WORLD_CATALOG);
  private readonly document = inject(DOCUMENT);
  private readonly state = signal<Progress>(this.load('feenland.progress'));
  private readonly demoState = signal<Progress>(this.load('feenland.demo-progress'));
  readonly progress = this.state.asReadonly();
  readonly saveFailed = signal(false);
  readonly next = computed(() => nextLevel(this.catalog, this.progress()));
  progressFor(source: ResultSource): Progress {
    if (source === 'practice') return this.progress();
    const real = this.progress();
    const demo = this.demoState();
    return {
      ...demo,
      mastered: [...new Set([...real.mastered, ...demo.mastered])],
      completed: [...new Set([...(real.completed ?? []), ...(demo.completed ?? [])])],
      chapters: [...new Set([...real.chapters, ...demo.chapters])],
      explored: [...new Set([...real.explored, ...demo.explored])],
      stars: { ...real.stars, ...demo.stars },
    };
  }
  explore(worldId: string) {
    if (
      !this.catalog.some((world) => world.id === worldId) ||
      this.progress().explored.includes(worldId)
    )
      return;
    this.state.update((progress) => ({ ...progress, explored: [...progress.explored, worldId] }));
    this.save('feenland.progress', this.progress());
  }
  record(result: LevelResult): boolean {
    const progress = applyResult(this.catalog, this.progressFor(result.source), result);
    if (!progress) return false;
    if (result.source === 'demo') this.demoState.set(progress);
    else this.state.set(progress);
    this.save(result.source === 'demo' ? 'feenland.demo-progress' : 'feenland.progress', progress);
    return true;
  }
  private save(key: string, progress: Progress) {
    try {
      this.document.defaultView?.localStorage.setItem(key, JSON.stringify(progress));
      this.saveFailed.set(false);
    } catch {
      this.saveFailed.set(true);
    }
  }
  private load(key: string): Progress {
    try {
      return parseProgress(
        JSON.parse(this.document.defaultView?.localStorage.getItem(key) ?? 'null'),
      );
    } catch {
      return emptyProgress;
    }
  }
}
