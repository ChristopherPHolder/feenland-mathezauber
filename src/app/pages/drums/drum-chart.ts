import { Component, computed, input } from '@angular/core';

/**
 * The hundred chart in the clearing: a grid of little glowing mushroom tops, 1 to 100 (to 120
 * on the drum master level). Pom's landings light their cells, so a step size draws its own
 * shape: tens fall down a column, fives make two columns, twos every other cell. Earlier verses
 * stay faintly lit. `compact` drops the numbers for the small inset on a phone.
 */
@Component({
  selector: 'app-drum-chart',
  host: {
    role: 'img',
    '[attr.aria-label]': 'label()',
    '[class.is-compact]': 'compact()',
  },
  template: `@for (cell of cells(); track cell.value) {
    <span
      class="cell"
      [class.lit]="cell.lit"
      [class.faded]="cell.faded"
      [class.mark]="cell.mark"
      [style.--hue]="cell.hue"
      ><span class="number">{{ cell.value }}</span></span
    >
  }`,
  styles: `
    :host {
      display: grid;
      grid-template-columns: repeat(10, minmax(0, 1fr));
      gap: clamp(1px, 0.6cqi, 4px);
      padding: clamp(4px, 1.6cqi, 10px);
      border-radius: var(--radius-surface);
      background: linear-gradient(#2c2560, #1d1844);
      container-type: inline-size;
      color: #d9d2ff;
    }
    .cell {
      display: grid;
      place-items: center;
      aspect-ratio: 1;
      border-radius: 50% 50% 30% 30%;
      background: #3a3275;
      font-size: clamp(7px, 4cqi, 15px);
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      line-height: 1;
    }
    .faded {
      background: color-mix(in srgb, hsl(var(--hue) 80% 62%) 40%, #3a3275);
      color: #fff;
    }
    .lit {
      background: hsl(var(--hue) 85% 64%);
      color: #1d1844;
      box-shadow: 0 0 clamp(2px, 1.5cqi, 8px) hsl(var(--hue) 90% 70%);
    }
    .mark {
      outline: clamp(1px, 0.6cqi, 3px) solid #fff;
      outline-offset: 1px;
    }
    :host(.is-compact) .number {
      display: none;
    }
  `,
})
export class DrumChart {
  readonly rows = input(10);
  /** Cells lit by the verse being played. */
  readonly lit = input<readonly number[]>([]);
  /** Cells lit in earlier verses. */
  readonly faded = input<readonly number[]>([]);
  /** The cell of the number Pom is standing on. */
  readonly mark = input<number | null>(null);
  readonly label = input('');
  readonly compact = input(false);
  /** The colour of the lit cells, as a hue. */
  readonly hue = input(328);

  protected readonly cells = computed(() => {
    const lit = new Set(this.lit());
    const faded = new Set(this.faded());
    const hue = this.hue();
    return Array.from({ length: this.rows() * 10 }, (_, index) => {
      const value = index + 1;
      return {
        value,
        lit: lit.has(value),
        faded: !lit.has(value) && faded.has(value),
        mark: value === this.mark(),
        hue,
      };
    });
  });
}
