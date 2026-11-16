import { Component, input, output } from '@angular/core';

/** A round speaker button that shows and flips the sound state. The caller owns the state. */
@Component({
  selector: 'ui-sound-toggle',
  template: `<button
    type="button"
    [attr.aria-pressed]="on()"
    [attr.aria-label]="on() ? onLabel() : offLabel()"
    (click)="toggle.emit()"
  >
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 9v6h4l5 4V5L8 9z" />
      @if (on()) {
        <path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" />
      } @else {
        <path d="m16 9 5 6m0-6-5 6" />
      }
    </svg>
  </button>`,
  styles: `
    :host {
      display: inline-flex;
    }
    button {
      display: inline-grid;
      place-items: center;
      min-width: 46px;
      min-height: 46px;
      padding: 8px;
      border: 0;
      border-radius: 50%;
      background: #ffffffd9;
      color: var(--ink);
      box-shadow: var(--shadow-rest);
    }
    button[aria-pressed='false'] {
      color: var(--muted);
    }
    svg {
      width: 26px;
      height: 26px;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
  `,
})
export class SoundToggle {
  readonly on = input.required<boolean>();
  /** Announced while sound is on, e.g. "Sound on". */
  readonly onLabel = input.required<string>();
  /** Announced while sound is off, e.g. "Sound off". */
  readonly offLabel = input.required<string>();
  readonly toggle = output();
}
