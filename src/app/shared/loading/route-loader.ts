import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { LocaleService } from '../../core/locale';
import { StateWorld, supportsWebGL, WorldLoader } from '../three/three-stage';
import { routeTones } from './route-tones';

/**
 * What a child sees while a page or game downloads: a twinkling star and a "Loading…" pill in
 * the game's colours (`tone`). It is plain CSS, so it paints on the first frame with nothing
 * else to fetch, and it holds still under calm motion or reduced motion.
 *
 * A game can pass a small Three.js `scene` too. Where WebGL 2 works, the scene loads beside the
 * game (Three.js is the chunk the game needs anyway), fades in over the CSS star and gets one
 * `setState(null)`; anywhere it fails the CSS star simply stays.
 *
 * The pill is for the eyes. Screen readers get a status message that is filled a moment after
 * the loader appears: a live region that already holds its text when inserted is often not
 * read out, and one that changes once is read out exactly once.
 */
/** Long enough after insertion that assistive tech treats the text as a change to announce. */
export const ANNOUNCE_DELAY = 100;

@Component({
  selector: 'app-route-loader',
  template: `@if (scene()) {
      <canvas #canvas aria-hidden="true"></canvas>
    }
    <div class="art" aria-hidden="true">
      <span class="orb"
        ><span class="star"></span><span class="orbit"><span></span></span
      ></span>
      <span class="dots"><span></span><span></span><span></span></span>
    </div>
    <p class="label" aria-hidden="true">{{ i.t('loading') }}</p>
    <p class="status" role="status">{{ status() }}</p>`,
  styles: [
    routeTones,
    `
      :host {
        position: relative;
        display: grid;
        place-content: center;
        justify-items: center;
        gap: 18px;
        padding: 24px;
        overflow: hidden;
      }
      canvas {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        display: block;
        opacity: 0;
        transition: opacity 600ms ease;
      }
      :host(.is-3d) canvas {
        opacity: 1;
      }
      .art {
        display: grid;
        justify-items: center;
        gap: 22px;
        transition: opacity 400ms ease;
      }
      :host(.is-3d) .art {
        opacity: 0;
      }
      .orb {
        position: relative;
        display: grid;
        place-items: center;
        width: 120px;
        height: 120px;
        border-radius: 50%;
        background: var(--loader-orb);
        box-shadow: 0 12px 30px #17255522;
        animation: loader-float 2.4s ease-in-out infinite;
      }
      .star {
        width: 64px;
        height: 64px;
        background: var(--loader-star);
        clip-path: polygon(
          50% 0%,
          61% 35%,
          98% 35%,
          68% 57%,
          79% 91%,
          50% 70%,
          21% 91%,
          32% 57%,
          2% 35%,
          39% 35%
        );
        animation: loader-twinkle 1.6s ease-in-out infinite;
      }
      .orbit {
        position: absolute;
        inset: -10px;
        animation: loader-spin 2.4s linear infinite;
      }
      .orbit span {
        position: absolute;
        top: 0;
        left: calc(50% - 7px);
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: var(--loader-dot);
      }
      .dots {
        display: flex;
        gap: 10px;
      }
      .dots span {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: var(--loader-dot);
        animation: loader-hop 1.2s ease-in-out infinite;
      }
      .dots span:nth-child(2) {
        animation-delay: 150ms;
      }
      .dots span:nth-child(3) {
        animation-delay: 300ms;
      }
      .label {
        position: relative;
        margin: 0;
        min-height: 1.4em;
        padding: 8px 20px;
        border-radius: 999px;
        background: var(--loader-pill);
        font-size: 20px;
        font-weight: 600;
        line-height: 1.4;
      }
      .status {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
      }
      @keyframes loader-float {
        50% {
          translate: 0 -8px;
        }
      }
      @keyframes loader-twinkle {
        50% {
          scale: 0.86;
          rotate: 18deg;
        }
      }
      @keyframes loader-spin {
        to {
          rotate: 1turn;
        }
      }
      @keyframes loader-hop {
        30% {
          translate: 0 -10px;
        }
        60% {
          translate: 0;
        }
      }
      @media (forced-colors: active) {
        .star,
        .orbit span,
        .dots span {
          forced-color-adjust: none;
          background: CanvasText;
        }
      }
    `,
  ],
  host: { class: 'is-route-tone', '[attr.data-tone]': 'tone()', '[class.is-3d]': 'live()' },
})
export class RouteLoader {
  /** Loads the game's small Three.js loading scene; without it the CSS star is all there is. */
  readonly scene = input<WorldLoader<null> | undefined>();
  /** The game's colours: castle, pond, race, lock, wall, hatchery, or default for pages. */
  readonly tone = input<string>('default');
  /** True once the 3D scene draws; false while it loads and wherever it fell back. */
  protected readonly live = signal(false);
  protected readonly i = inject(LocaleService);
  private readonly announced = signal(false);
  protected readonly status = computed(() => (this.announced() ? this.i.t('loading') : ''));
  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly document = inject(DOCUMENT);
  private world?: StateWorld<null>;
  private destroyed = false;

  constructor() {
    let announce: ReturnType<typeof setTimeout> | undefined;
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      clearTimeout(announce);
      this.world?.dispose();
      this.world = undefined;
    });
    afterNextRender(() => {
      announce = setTimeout(() => this.announced.set(true), ANNOUNCE_DELAY);
      void this.mount();
    });
  }

  private async mount() {
    const load = this.scene();
    if (!load || !supportsWebGL(this.document)) return;
    let World;
    try {
      World = await load();
    } catch {
      return;
    }
    const canvas = this.canvas()?.nativeElement;
    if (this.destroyed || !canvas) return;
    try {
      this.world = new World(canvas, this.host);
      this.world.setState(null);
    } catch {
      this.world?.dispose();
      this.world = undefined;
      return;
    }
    canvas.addEventListener('webglcontextlost', () => this.live.set(false), { once: true });
    this.live.set(true);
  }
}
