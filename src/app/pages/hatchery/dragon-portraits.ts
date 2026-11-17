import { DOCUMENT } from '@angular/common';
import { effect, inject, Service, signal, untracked } from '@angular/core';
import { Dragon, DRAGONS } from './dragons';
import { HatcheryStore } from './hatchery-store';

/**
 * Pictures of every dragon at its current stage, rendered once in 3D and kept as images, so
 * the dragon book and the home screen can show them without a live WebGL scene each. A dragon
 * that grows gets a new picture. Empty where WebGL is missing.
 */
@Service()
export class DragonPortraits {
  private readonly document = inject(DOCUMENT);
  private readonly store = inject(HatcheryStore);
  readonly pictures = signal<Readonly<Record<string, string>>>({});
  private readonly loaded = signal(false);
  /** The stage each picture shows. */
  private readonly drawn = new Map<string, number>();
  private started = false;

  constructor() {
    effect(() => {
      if (!this.loaded()) return;
      const grown = DRAGONS.filter(
        (dragon) => this.store.stage(dragon) !== (this.drawn.get(dragon.id) ?? 0),
      );
      if (grown.length) untracked(() => void this.render(grown));
    });
  }

  load() {
    const view = this.document.defaultView;
    if (this.started || !view || typeof view.WebGL2RenderingContext === 'undefined') return;
    this.started = true;
    // Render after the page has painted, so it never delays the first view.
    view.setTimeout(async () => {
      await this.render(DRAGONS);
      this.loaded.set(true);
    }, 300);
  }

  private async render(dragons: readonly Dragon[]) {
    try {
      const { renderPortraits } = await import('./hatchery-world');
      const stages = new Map(dragons.map((dragon) => [dragon.id, this.store.stage(dragon)]));
      const pictures = renderPortraits(dragons, (dragon) => stages.get(dragon.id) ?? 0);
      for (const [id, stage] of stages) this.drawn.set(id, stage);
      this.pictures.update((current) => ({ ...current, ...pictures }));
    } catch {
      /* Without pictures the book falls back to coloured eggs. */
    }
  }
}
