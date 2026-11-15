import { Component, computed, input } from '@angular/core';
import { constellation, constellationEdges, ConstellationId } from './star-constellations';

/**
 * A constellation drawn flat: lit stars joined by lines, the points still to catch as faint
 * dots. Used for the night-sky collection, the finish card and the fallback sky. Decorative:
 * whatever it shows is also said in text nearby.
 */
@Component({
  selector: 'app-star-picture',
  template: `<svg viewBox="-8 -8 116 116" aria-hidden="true">
    @for (edge of edges(); track $index) {
      <line
        [attr.x1]="points()[edge[0]][0]"
        [attr.y1]="points()[edge[0]][1]"
        [attr.x2]="points()[edge[1]][0]"
        [attr.y2]="points()[edge[1]][1]"
        [style.--i]="$index"
      />
    }
    @for (point of points(); track $index) {
      <circle
        [attr.cx]="point[0]"
        [attr.cy]="point[1]"
        [attr.r]="$index < litCount() ? 4.2 : 2.2"
        [class.lit]="$index < litCount()"
        [style.--i]="$index"
      />
    }
  </svg>`,
  styles: `
    :host {
      display: block;
      aspect-ratio: 1;
    }
    svg {
      display: block;
      width: 100%;
      height: 100%;
      overflow: visible;
    }
    line {
      stroke: var(--line, #ffe9a8);
      stroke-width: 1.8;
      stroke-linecap: round;
      opacity: 0.85;
    }
    circle {
      fill: var(--dim, #ffffff59);
    }
    circle.lit {
      fill: var(--lit, #fff4c2);
      filter: drop-shadow(0 0 3px var(--glow, var(--gold)));
    }
    :host(.is-faint) line {
      stroke: #c9cdf0;
      stroke-dasharray: 3 4;
      opacity: 0.45;
    }
    :host(.is-faint) circle {
      fill: #c9cdf0a6;
    }
    :host(.is-faint) circle.lit {
      fill: #c9cdf0a6;
      filter: none;
    }
    @media (prefers-reduced-motion: no-preference) {
      :host(.is-drawing) line {
        stroke-dasharray: 200;
        animation: draw 0.6s ease-out both;
        animation-delay: calc(var(--i) * 90ms);
      }
      :host(.is-drawing) circle.lit {
        animation: twinkle 0.5s cubic-bezier(0.3, 1.6, 0.5, 1) both;
        animation-delay: calc(var(--i) * 90ms);
      }
    }
    :host-context(.calm-motion) line,
    :host-context(.calm-motion) circle {
      animation: none !important;
    }
    @keyframes draw {
      from {
        stroke-dashoffset: 200;
      }
      to {
        stroke-dashoffset: 0;
      }
    }
    @keyframes twinkle {
      from {
        transform: scale(0);
      }
    }
    circle {
      transform-box: fill-box;
      transform-origin: center;
    }
  `,
  host: { '[class.is-faint]': 'faint()', '[class.is-drawing]': 'drawing()' },
})
export class StarPicture {
  readonly id = input.required<ConstellationId>();
  /** Points lit so far; ignored once `complete`. */
  readonly lit = input(0);
  readonly complete = input(false);
  /** Drawn quietly, for constellations in the collection that are not the focus. */
  readonly faint = input(false);
  /** Draw the lines in one after another, for the finish card. */
  readonly drawing = input(false);

  private readonly shape = computed(() => constellation(this.id()));
  protected readonly points = computed(() =>
    this.shape().points.map(([x, y]) => [x * 100, y * 100] as const),
  );
  protected readonly litCount = computed(() =>
    this.complete() ? this.shape().points.length : this.lit(),
  );
  protected readonly edges = computed(() =>
    constellationEdges(this.shape(), this.lit(), this.complete()),
  );
}
