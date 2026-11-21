import { Component, computed, input } from '@angular/core';
import type { ItemId } from './scales-levels';

/** One flat shape of an ingredient, drawn in a box 100 wide and 80 high, bottom centre at 0, 0. */
export type Shape =
  | { readonly e: readonly [number, number, number, number]; readonly fill: string }
  | { readonly r: readonly [number, number, number, number, number]; readonly fill: string }
  | { readonly d: string; readonly fill: string };

/** The flat drawing of each ingredient, for the 2D kitchen, the recipe card and the film. */
export const ITEM_ART: Readonly<Record<ItemId, readonly Shape[]>> = {
  pumpkin: [
    { e: [-22, -32, 24, 31], fill: '#d97418' },
    { e: [22, -32, 24, 31], fill: '#d97418' },
    { e: [0, -33, 26, 33], fill: '#f0952e' },
    { r: [-4, -76, 8, 14, 3], fill: '#5f7a2c' },
  ],
  melon: [
    { e: [0, -36, 44, 35], fill: '#4f8f33' },
    { d: 'M-30-58q8 22 0 44M-10-70q6 34 0 68M10-70q-6 34 0 68M30-58q-8 22 0 44', fill: 'none' },
  ],
  cabbage: [
    { e: [0, -36, 40, 36], fill: '#7fb65c' },
    { e: [-12, -40, 20, 28], fill: '#a6d483' },
    { e: [12, -38, 18, 26], fill: '#9acb78' },
    { e: [0, -42, 12, 20], fill: '#c4e6a5' },
  ],
  potatoes: [
    { d: 'M-34 0q-10-40 6-58h56q16 18 6 58z', fill: '#b08a5a' },
    { r: [-24, -64, 48, 8, 4], fill: '#8b6a40' },
    { e: [-12, -68, 13, 9], fill: '#c49a64' },
    { e: [10, -70, 12, 9], fill: '#b8895a' },
  ],
  cheese: [
    { r: [-40, -40, 80, 38, 10], fill: '#e9b130' },
    { e: [0, -40, 40, 12], fill: '#f6cf5a' },
    { e: [-14, -22, 5, 4], fill: '#c98f1c' },
    { e: [16, -16, 4, 3], fill: '#c98f1c' },
  ],
  flour: [
    { d: 'M-30 0q-10-44 8-62h44q18 18 8 62z', fill: '#f2ead9' },
    { r: [-20, -70, 40, 10, 4], fill: '#ddd1b8' },
    { r: [-30, -34, 60, 12, 2], fill: '#5b8fd1' },
  ],
  carrots: [
    { d: 'M-26-64l10 64l10-64z', fill: '#ef7d23' },
    { d: 'M-6-70l10 70l10-70z', fill: '#f28b2f' },
    { d: 'M14-62l10 62l10-62z', fill: '#e9731c' },
    { d: 'M-24-64q-6-14 4-12M-2-70q0-14 8-10M18-62q4-14 10-8', fill: '#5b9a35' },
  ],
  apples: [
    { e: [-16, -40, 16, 15], fill: '#d6372f' },
    { e: [14, -42, 16, 15], fill: '#e04a3a' },
    { e: [0, -52, 15, 14], fill: '#c92f28' },
    { r: [-36, -32, 72, 32, 8], fill: '#a9773f' },
  ],
  butter: [
    { r: [-34, -30, 68, 28, 5], fill: '#f7dc6f' },
    { r: [-34, -16, 68, 14, 3], fill: '#f3efe2' },
  ],
  berries: [
    { e: [-12, -30, 10, 10], fill: '#3f4396' },
    { e: [8, -32, 10, 10], fill: '#5257b3' },
    { e: [-2, -40, 10, 10], fill: '#4b4fa6' },
    { d: 'M-34-26h68q-6 26-34 26t-34-26z', fill: '#f1e7d6' },
  ],
  honey: [
    { r: [-22, -54, 44, 52, 12], fill: '#e3a018' },
    { r: [-24, -62, 48, 12, 4], fill: '#c46a2b' },
    { r: [-14, -36, 28, 16, 3], fill: '#fff3c4' },
  ],
  nuts: [
    { e: [-12, -30, 10, 8], fill: '#9c6a3a' },
    { e: [8, -32, 10, 8], fill: '#b07a44' },
    { e: [-2, -38, 9, 8], fill: '#8a5a2e' },
    { d: 'M-34-26h68q-6 26-34 26t-34-26z', fill: '#d8c9ad' },
  ],
  pillow: [
    { d: 'M-46-2q-4-30 2-60q44-10 88 0q6 30 2 60q-46 8-92 0z', fill: '#f4f1fb' },
    { d: 'M-30-34q30-8 60 0', fill: 'none' },
  ],
  rock: [{ d: 'M-26 0q-8-18 6-30q14-10 30-4q16 10 14 34z', fill: '#7d8590' }],
  salt: [
    { d: 'M-22 0q-8-34 6-48h32q14 14 6 48z', fill: '#b98ee0' },
    { r: [-14, -56, 28, 9, 4], fill: '#8b5fc0' },
    { d: 'M0-34l3 7 7 3-7 3-3 7-3-7-7-3 7-3z', fill: '#fff6bf' },
  ],
  water: [
    { r: [-22, -70, 44, 70, 10], fill: '#bfe3f7' },
    { r: [-22, -46, 44, 46, 10], fill: '#7fc4ef' },
  ],
  milk: [
    { r: [-22, -70, 44, 70, 10], fill: '#e8eef2' },
    { r: [-22, -50, 44, 50, 10], fill: '#fbfaf5' },
  ],
  juice: [
    { r: [-22, -70, 44, 70, 10], fill: '#f1d4e3' },
    { r: [-22, -48, 44, 48, 10], fill: '#c2357a' },
  ],
};

/** An ingredient as a small picture, for the recipe card and the answer buttons. */
@Component({
  selector: 'app-scales-item',
  template: `<svg viewBox="-56 -84 112 90" aria-hidden="true">
    @for (shape of shapes(); track $index) {
      @if ('e' in shape) {
        <ellipse
          [attr.cx]="shape.e[0]"
          [attr.cy]="shape.e[1]"
          [attr.rx]="shape.e[2]"
          [attr.ry]="shape.e[3]"
          [attr.fill]="shape.fill"
        />
      } @else if ('r' in shape) {
        <rect
          [attr.x]="shape.r[0]"
          [attr.y]="shape.r[1]"
          [attr.width]="shape.r[2]"
          [attr.height]="shape.r[3]"
          [attr.rx]="shape.r[4]"
          [attr.fill]="shape.fill"
        />
      } @else {
        <path [attr.d]="shape.d" [attr.fill]="shape.fill" />
      }
    }
  </svg>`,
  styles: `
    :host {
      display: inline-block;
      width: 2.2em;
      height: 1.8em;
      flex: none;
    }
    svg {
      width: 100%;
      height: 100%;
      overflow: visible;
    }
    ellipse,
    rect,
    path {
      stroke: #4a3424;
      stroke-width: 3;
      stroke-linejoin: round;
      stroke-linecap: round;
    }
  `,
})
export class ScalesItem {
  readonly item = input.required<ItemId>();
  protected readonly shapes = computed(() => ITEM_ART[this.item()]);
}
