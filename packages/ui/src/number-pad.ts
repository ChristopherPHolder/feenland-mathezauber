import { Component, input, output } from '@angular/core';

/**
 * The number pad for typed answers, laid out as rows of five so the pad itself shows the
 * five-structure: 1–5, 6–9 and 0, then Delete and OK. The caller keeps the typed value and
 * words every label.
 */
@Component({
  selector: 'ui-number-pad',
  template: `<p class="display sr-only" aria-live="polite">
      {{ answerLabel() }}: {{ value() || '?' }}
    </p>
    <div class="keys" role="group" [attr.aria-label]="padLabel()">
      @for (digit of digits; track digit) {
        <button type="button" class="key" [disabled]="disabled()" (click)="digit$.emit(digit)">
          {{ digit }}
        </button>
      }
      <button
        type="button"
        class="key wide delete"
        [disabled]="disabled() || !value()"
        (click)="erase.emit()"
      >
        {{ deleteLabel() }}
      </button>
      <button
        type="button"
        class="key wide ok"
        [disabled]="disabled() || !value()"
        (click)="submit.emit()"
      >
        {{ okLabel() }}
      </button>
    </div>`,
  styles: `
    :host {
      display: grid;
      gap: 8px;
    }
    /* Rows of five, so the pad itself shows 1–5 and 6–10. */
    .keys {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 8px;
    }
    .key {
      min-height: 52px;
      border: 0;
      border-radius: var(--radius-tile);
      background: var(--paper);
      color: var(--ink);
      font: 600 26px var(--font-sans);
      touch-action: manipulation;
      box-shadow:
        inset 0 0 0 2px #b9cde0,
        0 4px 0 #9bb3cc;
      cursor: pointer;
    }
    /* The second row is the second five: a cooler tint, paired with the row break itself. */
    .key:nth-child(n + 6):nth-child(-n + 10) {
      background: #eef6ff;
    }
    .key.wide {
      grid-column: span 2;
      font-size: 19px;
    }
    .key.ok {
      grid-column: 4 / span 2;
      background: var(--pink);
      color: var(--paper);
      box-shadow: 0 4px 0 #7d0e3b;
    }
    .key:active:not([disabled]) {
      transform: translateY(3px);
      box-shadow: inset 0 0 0 2px #b9cde0;
    }
    .key[disabled] {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .key:focus-visible {
      outline: 3px solid var(--focus);
      outline-offset: 3px;
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }

    @media (max-height: 940px) and (max-width: 520px),
      (orientation: landscape) and (max-height: 520px) {
      .keys {
        gap: 6px;
      }
      .key {
        min-height: 44px;
        font-size: 22px;
      }
      .key.wide {
        font-size: 17px;
      }
    }
  `,
})
export class NumberPad {
  /** The digits typed so far. */
  readonly value = input.required<string>();
  readonly disabled = input(false);
  /** Spoken before the typed value, e.g. "Your answer". */
  readonly answerLabel = input.required<string>();
  readonly padLabel = input.required<string>();
  readonly deleteLabel = input.required<string>();
  readonly okLabel = input.required<string>();
  readonly digit$ = output<number>({ alias: 'digit' });
  readonly erase = output<void>();
  readonly submit = output<void>();
  protected readonly digits = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];
}
