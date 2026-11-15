import { Component, computed, input } from '@angular/core';
import { TrickCard } from './bakery-order';

/**
 * Bruno's recipe card: the level's trick worked through on a small tray with other numbers
 * than the order's, so it shows the way without giving the answer away.
 */
@Component({
  selector: 'app-bakery-card',
  template: `
    <h3>{{ title() }}</h3>
    <div class="card-body">
      <svg [attr.viewBox]="'0 0 ' + box().width + ' ' + box().height" aria-hidden="true">
        @for (dot of dots(); track $index) {
          <circle
            [attr.cx]="dot.x"
            [attr.cy]="dot.y"
            r="3.6"
            [class.ghost]="dot.ghost"
            [class.second]="dot.part % 2 === 1"
          />
        }
      </svg>
      <ol>
        @for (line of lines(); track $index) {
          <li>{{ line }}</li>
        }
      </ol>
    </div>
  `,
  styles: `
    :host {
      display: block;
      padding: 10px 14px;
      border: 2px dashed #c98a45;
      border-radius: var(--radius-chip);
      background: #fff8ea;
    }
    h3 {
      margin: 0 0 6px;
      font-size: 15px;
      color: var(--amber-ink);
    }
    .card-body {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    svg {
      flex: none;
      width: min(40%, 130px);
      height: auto;
    }
    circle {
      fill: #d08f45;
    }
    circle.second {
      fill: #8a5cc7;
    }
    circle.ghost {
      fill: none;
      stroke: #8c5a2b;
      stroke-dasharray: 2 2;
    }
    ol {
      margin: 0;
      padding: 0;
      list-style: none;
      font-size: 18px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      line-height: 1.5;
    }
  `,
})
export class BakeryCard {
  readonly card = input.required<TrickCard>();
  readonly title = input.required<string>();
  readonly lines = input.required<readonly string[]>();

  /** Rows split into the card's parts with a gap between them; a negative part is nibbled. */
  protected readonly dots = computed(() => {
    const { cols, parts } = this.card();
    const dots: { x: number; y: number; ghost: boolean; part: number }[] = [];
    let row = 0;
    let offset = 0;
    parts.forEach((part, index) => {
      if (part < 0) {
        // The nibbled row: the last row of the full tray, drawn hollow.
        for (let col = 0; col < cols; col++)
          dots.push({ x: 6 + col * 9, y: 6 + (row - 1) * 9 + offset, ghost: true, part: index });
        return;
      }
      for (let r = 0; r < part; r++, row++)
        for (let col = 0; col < cols; col++) {
          const last = parts[index + 1] !== undefined && parts[index + 1] < 0 && r === part - 1;
          dots.push({ x: 6 + col * 9, y: 6 + row * 9 + offset, ghost: last, part: index });
        }
      offset += 6;
    });
    return dots.filter(
      (dot, index, all) => all.findIndex((other) => other.x === dot.x && other.y === dot.y) === index,
    );
  });
  protected readonly box = computed(() => {
    const dots = this.dots();
    return {
      width: Math.max(...dots.map((d) => d.x)) + 6,
      height: Math.max(...dots.map((d) => d.y)) + 6,
    };
  });
}
