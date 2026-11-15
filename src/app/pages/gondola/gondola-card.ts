import { Component, computed, input } from '@angular/core';
import { RuleCard } from './gondola-levels';

interface Seat {
  readonly x: number;
  readonly y: number;
  readonly filled: boolean;
  readonly fresh: boolean;
  readonly second: boolean;
}

function seats(x: number, count: number, fresh = 0): Seat[] {
  return Array.from({ length: 10 }, (_, index) => ({
    x: x + 12 + (index % 5) * 15,
    y: 30 + Math.floor(index / 5) * 19,
    filled: index < count + fresh,
    fresh: index >= count && index < count + fresh,
    second: index >= 5,
  }));
}

/**
 * Gusti's picture card after two slips: the trick drawn with other numbers than this turn,
 * so it shows the way, never the answer. A cabin filled to ten and the rest in the next one,
 * the loose ones going first, or "10 and 3 is 13".
 */
@Component({
  selector: 'app-gondola-card',
  template: `<svg viewBox="0 0 240 92" aria-hidden="true">
      @for (cabin of cabins(); track $index) {
        <g>
          <rect class="body" [attr.x]="cabin.x" y="14" width="96" height="62" rx="14" />
          @if (cabin.label) {
            <text class="label" [attr.x]="cabin.x + 48" y="10">{{ cabin.label }}</text>
          }
          @for (seat of cabin.seats; track $index) {
            <circle
              class="seat"
              [class.is-filled]="seat.filled"
              [class.is-fresh]="seat.fresh"
              [class.is-second]="seat.second"
              [attr.cx]="seat.x"
              [attr.cy]="seat.y"
              r="6"
            />
          }
        </g>
      }
      <path class="arrow" d="M108 46h22m-7-7 7 7-7 7" />
    </svg>
    <p>{{ caption() }}</p>`,
  styles: `
    :host {
      display: grid;
      grid-template-columns: minmax(120px, 200px) 1fr;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border-radius: var(--radius-surface);
      background: var(--warm-ground);
      border: 2px solid var(--sun);
    }
    svg {
      width: 100%;
      display: block;
    }
    p {
      margin: 0;
      line-height: 1.4;
    }
    .body {
      fill: #eef7ff;
      stroke: var(--sky-deep);
      stroke-width: 2.5;
    }
    .seat {
      fill: #fff;
      stroke: #c98aa0;
      stroke-width: 1.4;
    }
    .seat.is-second {
      stroke: #7fa6c9;
    }
    .seat.is-filled {
      fill: #ffd9e6;
    }
    .seat.is-filled.is-second {
      fill: #d6ecff;
    }
    .seat.is-fresh {
      fill: var(--gold);
      stroke: var(--gold-deep);
    }
    .label {
      font: 600 13px var(--font-sans);
      fill: var(--ink);
      text-anchor: middle;
    }
    .arrow {
      fill: none;
      stroke: var(--pink);
      stroke-width: 4;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    @container (max-width: 380px) {
      :host {
        grid-template-columns: 1fr;
      }
      svg {
        max-width: 220px;
      }
    }
  `,
})
export class GondolaCard {
  readonly card = input.required<RuleCard>();
  readonly caption = input.required<string>();

  protected readonly cabins = computed(() => {
    const card = this.card();
    switch (card.kind) {
      case 'fill': {
        const fresh = 10 - card.a;
        return [
          { x: 6, label: `${card.a} + ${fresh} = 10`, seats: seats(6, card.a, fresh) },
          { x: 138, label: `${card.b - fresh}`, seats: seats(138, card.b - fresh) },
        ];
      }
      case 'down': {
        const loose = card.a % 10;
        return [
          { x: 6, label: `− ${loose}`, seats: seats(6, loose) },
          { x: 138, label: `10 − ${card.b - loose}`, seats: seats(138, 10 - (card.b - loose)) },
        ];
      }
      case 'teen':
        return [
          { x: 6, label: '10', seats: seats(6, 10) },
          { x: 138, label: `${card.b}`, seats: seats(138, card.b) },
        ];
      default:
        return [
          { x: 6, label: `${card.a}`, seats: seats(6, 10) },
          { x: 138, label: `${card.b}`, seats: seats(138, card.b) },
        ];
    }
  });
}
