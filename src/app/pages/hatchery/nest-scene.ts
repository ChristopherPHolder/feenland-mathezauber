import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  viewChild,
} from '@angular/core';
import type { HatcheryWorld, NestFrame } from './hatchery-world';

/**
 * The nest in 3D. Purely presentational: the page owns the hatchery and passes a frame.
 * Three.js loads lazily and is skipped where WebGL is missing; the page then shows a flat egg.
 */
@Component({
  selector: 'app-nest-scene',
  template: `<canvas #canvas aria-hidden="true"></canvas>`,
  styles: `
    :host {
      position: relative;
      display: block;
      contain: strict;
    }
    canvas {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      display: block;
    }
  `,
})
export class NestScene {
  readonly frame = input.required<NestFrame>();
  /** Counts cheers; each new one makes the dragon in the nest hop. */
  readonly cheers = input(0);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly document = inject(DOCUMENT);
  private world?: HatcheryWorld;
  private seenCheers = 0;
  private destroyed = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.world?.dispose();
    });
    effect(() => {
      // Read the frame first: an optional call would skip it and never subscribe.
      const frame = this.frame();
      this.world?.setFrame(frame);
    });
    effect(() => {
      const cheers = this.cheers();
      if (cheers !== this.seenCheers) {
        this.seenCheers = cheers;
        this.world?.cheer();
      }
    });
    afterNextRender(() => void this.mount());
  }

  private async mount() {
    const view = this.document.defaultView;
    if (!view || typeof view.WebGL2RenderingContext === 'undefined') return;
    const { HatcheryWorld } = await import('./hatchery-world');
    if (this.destroyed) return;
    try {
      this.world = new HatcheryWorld(this.canvas().nativeElement, this.host.nativeElement);
      this.seenCheers = this.cheers();
      this.world.setFrame(this.frame());
    } catch {
      this.world = undefined;
    }
  }
}
