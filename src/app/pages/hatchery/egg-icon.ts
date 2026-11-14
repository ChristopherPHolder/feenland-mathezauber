import { Component, computed, input } from '@angular/core';
import type { Dragon } from './dragons';

let nextId = 0;

/** A flat egg drawing that fills with warm colour from the bottom as it warms up. */
@Component({
  selector: 'app-egg-icon',
  template: `<svg viewBox="0 0 40 48" aria-hidden="true">
    <defs>
      <clipPath [attr.id]="clip">
        <path [attr.d]="shape" />
      </clipPath>
    </defs>
    <path [attr.d]="shape" [attr.fill]="dragon()?.shell ?? '#f4ecdc'" />
    @if (dragon(); as dragon) {
      <g [attr.clip-path]="'url(#' + clip + ')'">
        <rect
          x="0"
          [attr.y]="48 - fill() * 44"
          width="40"
          height="48"
          fill="#ffb35c"
          opacity="0.55"
        />
        <circle cx="13" cy="20" r="3.4" [attr.fill]="dragon.spots" />
        <circle cx="26" cy="15" r="2.6" [attr.fill]="dragon.spots" />
        <circle cx="25" cy="31" r="3.8" [attr.fill]="dragon.spots" />
        <circle cx="12" cy="35" r="2.4" [attr.fill]="dragon.spots" />
      </g>
    } @else {
      <text x="20" y="34" text-anchor="middle" font-size="22" font-weight="600" fill="#8c7d63">
        ?
      </text>
    }
    <path [attr.d]="shape" fill="none" stroke="#5b4a33" stroke-opacity="0.45" stroke-width="1.6" />
    <ellipse cx="13" cy="14" rx="3" ry="5" fill="white" opacity="0.55" />
  </svg>`,
  styles: `
    :host {
      display: inline-block;
      width: 1.6em;
      height: 1.9em;
    }
    svg {
      width: 100%;
      height: 100%;
      display: block;
    }
  `,
})
export class EggIcon {
  /** The dragon inside, for its colours; leave empty for a mystery egg. */
  readonly dragon = input<Dragon | null>(null);
  /** How warm it is, from 0 to 1. */
  readonly warmth = input(0);
  protected readonly fill = computed(() => Math.max(0, Math.min(1, this.warmth())));
  protected readonly clip = `egg-clip-${nextId++}`;
  protected readonly shape = 'M20 2C10 2 3 18 3 29a17 17 0 0 0 34 0C37 18 30 2 20 2z';
}
