import { Component, computed, input } from '@angular/core';
import { foodBox, piecePaths } from './food-geometry';
import type { Food } from './picnic-levels';
import { roundFood } from './picnic-levels';

/**
 * A food drawn flat from above: a pie or cake in wedges, a honey bar or ribbon in slices, with
 * jam on the shaded pieces. Decorative; the caller labels it where it matters.
 */
@Component({
  selector: 'app-picnic-food',
  template: `<svg
    [attr.viewBox]="'0 0 ' + box().width + ' ' + box().height"
    aria-hidden="true"
    [attr.data-food]="food()"
  >
    @if (round()) {
      <circle class="dish" cx="50" cy="50" r="49" />
    }
    @for (piece of pieces(); track $index) {
      <path class="piece" [class.jam]="piece.jam" [attr.d]="piece.d" />
      @if (piece.jam && food() !== 'ribbon') {
        <circle class="berry" [attr.cx]="piece.x" [attr.cy]="piece.y" r="2.6" />
      }
    }
    @if (food() === 'cake' && pieces().length < 2) {
      @for (c of cherries; track $index) {
        <circle class="cherry" [attr.cx]="c[0]" [attr.cy]="c[1]" r="3.4" />
      }
    }
  </svg>`,
  styles: `
    :host {
      display: block;
    }
    svg {
      display: block;
      width: 100%;
      height: auto;
      overflow: visible;
    }
    .dish {
      fill: #ffffff;
      stroke: #d8cfc4;
      stroke-width: 1;
    }
    .piece {
      stroke-width: 1.4;
      stroke-linejoin: round;
      transition: d 0.3s ease-out;
    }
    [data-food='pie'] .piece {
      fill: #f4c77d;
      stroke: #b9792f;
    }
    [data-food='cake'] .piece {
      fill: #fbd3e2;
      stroke: #c4567f;
    }
    [data-food='bar'] .piece {
      fill: #f6c24a;
      stroke: #a86d12;
    }
    [data-food='ribbon'] .piece {
      fill: #9fd6f5;
      stroke: #2f7fb0;
    }
    [data-food] .piece.jam {
      fill: #e2526e;
      stroke: #8f1f3a;
    }
    [data-food='ribbon'] .piece.jam {
      fill: #b06ad9;
      stroke: #5d2f86;
    }
    .berry {
      fill: #fff0f3;
      opacity: 0.8;
    }
    .cherry {
      fill: #d81e45;
    }
  `,
})
export class PicnicFood {
  readonly food = input.required<Food>();
  readonly sizes = input.required<readonly number[]>();
  readonly shaded = input<readonly boolean[]>([]);
  readonly apart = input(true);
  protected readonly round = computed(() => roundFood(this.food()));
  protected readonly box = computed(() => foodBox(this.food()));
  protected readonly pieces = computed(() =>
    piecePaths(this.food(), this.sizes(), this.shaded(), this.apart() && this.sizes().length > 1),
  );
  protected readonly cherries = [
    [50, 30],
    [33, 58],
    [67, 58],
  ];
}
