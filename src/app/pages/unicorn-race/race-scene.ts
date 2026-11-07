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
import { RacerId, racerIds, RacerState } from './race';
import type { RaceWorld, WorldFrame } from './race-world';
/**
 * The race track in 3D: four lanes down a fairyland meadow to the rainbow castle, seen from
 * just behind Lumi. Purely presentational; the page owns the race and feeds it each tick.
 * The world itself (Three.js) loads lazily and is skipped where WebGL is missing.
 */
@Component({
  selector: 'app-race-scene',
  template: `
    <canvas #canvas aria-hidden="true"></canvas>
    <ul class="sr-only">
      @for (id of ids; track id) {
        <li>{{ labels()[id] }}</li>
      }
    </ul>
    @if (countdown(); as count) {
      <p class="countdown" aria-hidden="true">{{ count }}</p>
    }
    @if (finished()) {
      <div class="confetti" aria-hidden="true">
        @for (piece of confetti; track piece) {
          <span [style.--i]="piece"></span>
        }
      </div>
    }
  `,
  styles: `
    :host {
      position: relative;
      display: block;
      overflow: hidden;
      border-radius: var(--radius-panel);
      background: linear-gradient(#e6e1ff, #cfeedd);
      box-shadow: var(--shadow-panel);
      contain: strict;
    }
    canvas {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      display: block;
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
      margin: 0;
      padding: 0;
    }
    .countdown {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      margin: 0;
      font-size: clamp(64px, 18vmin, 140px);
      font-weight: 700;
      color: #fff;
      -webkit-text-stroke: 3px #4b3a70;
      paint-order: stroke fill;
      text-shadow: 0 6px 0 rgba(75, 58, 112, 0.25);
      animation: count-pop 0.8s ease-out;
      pointer-events: none;
    }
    @keyframes count-pop {
      0% {
        transform: scale(0.4);
        opacity: 0;
      }
      30% {
        transform: scale(1.15);
        opacity: 1;
      }
      100% {
        transform: scale(1);
      }
    }
    .confetti {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }
    .confetti span {
      position: absolute;
      top: -14px;
      left: calc(var(--i) * 6.2% + 2%);
      width: 10px;
      height: 16px;
      border-radius: 2px;
      background: hsl(calc(var(--i) * 40deg) 90% 65%);
      animation: fall 1.5s linear infinite;
      animation-delay: calc(var(--i) * -0.11s);
    }
    @keyframes fall {
      to {
        transform: translateY(110vh) rotate(540deg);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .countdown,
      .confetti span {
        animation: none;
      }
    }
  `,
  host: {
    '[class.running]': 'running()',
    '[class.finished]': 'finished()',
    '[class.rainbow]': 'rainbow()',
    '[class.stumbling]': 'stumbling()',
  },
})
export class RaceScene {
  readonly racers = input.required<readonly RacerState[]>();
  readonly names = input.required<Readonly<Record<RacerId, string>>>();
  /** Spoken description per racer (name and how far along it is). */
  readonly labels = input.required<Readonly<Record<RacerId, string>>>();
  readonly running = input(false);
  readonly stumbling = input(false);
  readonly rainbow = input(false);
  readonly finished = input(false);
  readonly countdown = input<string | null>(null);
  protected readonly ids = racerIds;
  protected readonly confetti = Array.from({ length: 16 }, (_, index) => index);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly document = inject(DOCUMENT);
  private world?: RaceWorld;
  private frame: WorldFrame = {
    racers: [],
    running: false,
    stumbling: false,
    rainbow: false,
    finished: false,
  };
  private destroyed = false;
  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.world?.dispose();
    });
    effect(() => {
      this.frame = {
        racers: this.racers(),
        running: this.running(),
        stumbling: this.stumbling(),
        rainbow: this.rainbow(),
        finished: this.finished(),
      };
      this.world?.setFrame(this.frame);
    });
    effect(() => this.world?.setNames(this.names()));
    afterNextRender(() => void this.mount());
  }
  private async mount() {
    const view = this.document.defaultView;
    if (!view || typeof view.WebGL2RenderingContext === 'undefined') return;
    const { RaceWorld } = await import('./race-world');
    if (this.destroyed) return;
    try {
      this.world = new RaceWorld(this.canvas().nativeElement, this.host.nativeElement);
    } catch {
      return;
    }
    this.world.setNames(this.names());
    this.world.setFrame(this.frame);
  }
}
