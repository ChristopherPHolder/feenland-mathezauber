import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';

/** A 3D world a game drives with plain state: it draws, it never decides anything. */
export interface StateWorld<S> {
  setState(state: S): void;
  dispose(): void;
}

export type WorldClass<S> = new (canvas: HTMLCanvasElement, host: HTMLElement) => StateWorld<S>;

/**
 * Loads the world's module on demand, e.g. `() => import('./wall-world').then((m) => m.WallWorld)`,
 * so Three.js only downloads for games that show it.
 */
export type WorldLoader<S> = () => Promise<WorldClass<S>>;

/**
 * Hosts a game's Three.js world. The canvas is decorative (`aria-hidden`): the game keeps its
 * real controls and live text in the DOM. Until the world is up, and wherever WebGL is missing
 * or fails (old devices, tests), the projected content shows instead, so a game passes its
 * existing 2D scene as the fallback:
 *
 *     <app-three-stage [world]="loadWorld" [state]="frame()">
 *       <app-wall-scene ... />
 *     </app-three-stage>
 *
 * The host fills whatever box the game gives it; size it from the game's layout.
 */
@Component({
  selector: 'app-three-stage',
  template: `<canvas #canvas aria-hidden="true"></canvas>
    @if (!ready()) {
      <div class="fallback"><ng-content /></div>
    }`,
  styles: `
    :host {
      position: relative;
      display: block;
      min-height: 0;
    }
    canvas {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      display: block;
      visibility: hidden;
    }
    :host(.is-3d) canvas {
      visibility: visible;
    }
    .fallback {
      height: 100%;
    }
  `,
  host: { '[class.is-3d]': 'ready()' },
})
export class ThreeStage<S> {
  readonly world = input.required<WorldLoader<S>>();
  readonly state = input.required<S>();
  /** True once the 3D world is drawing; false while loading and wherever it fell back to 2D. */
  readonly ready = signal(false);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly document = inject(DOCUMENT);
  private instance?: StateWorld<S>;
  private destroyed = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.instance?.dispose();
    });
    effect(() => {
      const state = this.state();
      if (this.ready()) this.instance?.setState(state);
    });
    afterNextRender(() => void this.mount());
  }

  private async mount() {
    if (!supportsWebGL(this.document)) return;
    let World: WorldClass<S>;
    try {
      World = await this.world()();
    } catch {
      return;
    }
    if (this.destroyed) return;
    const canvas = this.canvas().nativeElement;
    try {
      // The state effect hands it the first state as soon as `ready` flips.
      this.instance = new World(canvas, this.host);
    } catch {
      this.instance?.dispose();
      this.instance = undefined;
      return;
    }
    // A lost GL context (memory pressure on a tablet) drops back to the 2D scene until the
    // browser restores it; Three.js then uploads the world again and it comes back.
    canvas.addEventListener('webglcontextlost', () => this.ready.set(false));
    canvas.addEventListener('webglcontextrestored', () => {
      if (!this.destroyed) this.ready.set(true);
    });
    this.ready.set(true);
  }
}

/** WebGL 2 is what Three.js needs; jsdom and very old browsers lack it. */
export function supportsWebGL(document: Document): boolean {
  const view = document.defaultView;
  if (!view || typeof view.WebGL2RenderingContext === 'undefined') return false;
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}
