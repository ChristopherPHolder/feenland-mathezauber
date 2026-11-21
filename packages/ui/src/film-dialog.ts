import { afterNextRender, Component, ElementRef, input, output, viewChild } from '@angular/core';

/**
 * A full-screen modal card that shows a game's "how to play" film: the film is projected, the
 * title and the button text arrive already worded. It opens as soon as it renders and focuses
 * its button; the button and Escape both emit `done`, and the caller removes it. Games hold
 * their timers while it is open.
 *
 *     @if (coachOpen()) {
 *       <ui-film-dialog [heading]="t('help')" [go]="t('coachGo')" (done)="closeCoach()">
 *         <app-my-demo />
 *       </ui-film-dialog>
 *     }
 */
@Component({
  selector: 'ui-film-dialog',
  template: `<dialog #dialog aria-labelledby="ui-film-title" (cancel)="cancel($event)">
    <div class="card">
      <h2 id="ui-film-title">{{ heading() }}</h2>
      <ng-content />
      <button class="button primary" type="button" (click)="done.emit()">{{ go() }}</button>
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
      background: var(--scrim);
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
export class FilmDialog {
  readonly heading = input.required<string>();
  /** The button that closes it, like "Got it!". */
  readonly go = input.required<string>();
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

  /** Escape closes it the same way the button does. */
  protected cancel(event: Event) {
    event.preventDefault();
    this.done.emit();
  }
}
