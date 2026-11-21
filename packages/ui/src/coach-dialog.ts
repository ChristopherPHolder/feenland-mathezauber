import { afterNextRender, Component, ElementRef, input, output, viewChild } from '@angular/core';

/**
 * "How to play" over a game: a modal dialog with the game's demo film projected inside, a
 * title and one big button. It opens itself when shown; Escape and the button both emit
 * `done`, and the game removes it. Text arrives already translated.
 *
 *     <ui-coach-dialog [heading]="t('demoTitle')" [goLabel]="t('coachGo')" (done)="closeHelp()">
 *       <app-market-demo [skill]="..." />
 *     </ui-coach-dialog>
 */
@Component({
  selector: 'ui-coach-dialog',
  template: `<dialog #dialog aria-labelledby="ui-coach-title" (cancel)="cancel($event)">
    <div class="card">
      <h2 id="ui-coach-title">{{ heading() }}</h2>
      <ng-content />
      <button class="button primary" type="button" (click)="done.emit()">
        {{ goLabel() }}
      </button>
    </div>
  </dialog>`,
  styles: `
    dialog {
      inset: 0;
      width: 100%;
      height: 100%;
      max-width: none;
      max-height: none;
      margin: 0;
      padding: max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right))
        max(12px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left));
      border: 0;
      background: transparent;
      overflow: auto;
    }
    dialog:modal {
      overscroll-behavior: contain;
    }
    dialog[open] {
      display: grid;
      place-items: center;
    }
    dialog::backdrop {
      overflow: hidden;
      overscroll-behavior: contain;
      background: rgb(23 37 85 / 0.5);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
    }
    .card {
      display: grid;
      gap: 12px;
      justify-items: center;
      width: 100%;
      max-width: 400px;
      padding: 18px 18px 20px;
      border-radius: var(--radius-panel);
      background: var(--cream);
      box-shadow: var(--shadow-float);
      color: var(--ink);
    }
    h2 {
      margin: 0;
      font-size: 24px;
    }
    .button {
      width: 100%;
      max-width: 300px;
    }
  `,
})
export class CoachDialog {
  readonly heading = input.required<string>();
  readonly goLabel = input.required<string>();
  readonly done = output<void>();
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    afterNextRender(() => {
      const dialog = this.dialog().nativeElement;
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
      dialog.querySelector<HTMLElement>('.button.primary')?.focus({ preventScroll: true });
    });
  }

  /** Escape closes the coach the same way the button does. */
  protected cancel(event: Event) {
    event.preventDefault();
    this.done.emit();
  }
}
