import { DOCUMENT } from '@angular/common';
import { inject, Service, signal } from '@angular/core';
import { DRAGONS } from './dragons';

/**
 * Pictures of every dragon, rendered once in 3D and kept as images, so the dragon book and the
 * home screen can show them without a live WebGL scene each. Empty where WebGL is missing.
 */
@Service()
export class DragonPortraits {
  private readonly document = inject(DOCUMENT);
  readonly pictures = signal<Readonly<Record<string, string>>>({});
  private started = false;

  load() {
    const view = this.document.defaultView;
    if (this.started || !view || typeof view.WebGL2RenderingContext === 'undefined') return;
    this.started = true;
    // Render after the page has painted, so it never delays the first view.
    view.setTimeout(async () => {
      try {
        const { renderPortraits } = await import('./hatchery-world');
        this.pictures.set(renderPortraits(DRAGONS));
      } catch {
        /* Without pictures the book falls back to coloured eggs. */
      }
    }, 300);
  }
}
