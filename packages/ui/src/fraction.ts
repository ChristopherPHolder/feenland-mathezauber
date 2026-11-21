import { Component, input } from '@angular/core';

/**
 * A fraction written the way children see it in school: the numerator over a bar over the
 * denominator. Screen readers hear the caller's words instead ("one third", "drei Viertel"),
 * because "1 slash 3" means nothing to a seven-year-old.
 */
@Component({
  selector: 'ui-fraction',
  template: `<span class="words">{{ label() }}</span
    ><span class="stack" aria-hidden="true"
      ><span class="n">{{ numerator() }}</span
      ><span class="d">{{ denominator() }}</span></span
    >`,
  styles: `
    :host {
      display: inline-block;
      vertical-align: middle;
      line-height: 1;
    }
    .stack {
      display: inline-grid;
      justify-items: center;
      font-variant-numeric: tabular-nums;
      font-weight: 600;
    }
    .n,
    .d {
      padding: 0 0.15em;
      font-size: 0.82em;
    }
    .n {
      padding-bottom: 0.08em;
      border-bottom: max(2px, 0.09em) solid currentColor;
    }
    .d {
      padding-top: 0.1em;
    }
    .words {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
  `,
})
export class StackedFraction {
  readonly numerator = input.required<number>();
  readonly denominator = input.required<number>();
  /** What a screen reader says, in the reader's language, e.g. "three quarters". */
  readonly label = input.required<string>();
}
