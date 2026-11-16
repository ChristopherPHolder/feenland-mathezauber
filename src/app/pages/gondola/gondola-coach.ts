import {
  afterNextRender,
  Component,
  ElementRef,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { LocaleService } from '../../core/locale';
import { GondolaDemo } from './gondola-demo';
import { gondolaText, GondolaMessageKey } from './gondola-messages';

/**
 * "How to play" over the station: the demo film in a modal dialog. The ? button opens it any
 * time; the snow cloud waits while it is open.
 */
@Component({
  selector: 'app-gondola-coach',
  imports: [GondolaDemo],
  template: `<dialog #dialog aria-labelledby="coach-title" (cancel)="cancel($event)">
    <div class="card">
      <h2 id="coach-title">{{ t('demoTitle') }}</h2>
      <app-gondola-demo [alternate]="alternate()" />
      <button class="button primary" type="button" (click)="done.emit()">
        {{ t('coachGo') }}
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
export class GondolaCoach {
  private readonly i = inject(LocaleService);
  /** The turn on screen uses the film's usual numbers: show the other ones. */
  readonly alternate = input(false);
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

  /** Escape closes the coach the same way "Got it!" does. */
  protected cancel(event: Event) {
    event.preventDefault();
    this.done.emit();
  }

  protected t(key: GondolaMessageKey) {
    return gondolaText(this.i.locale(), key);
  }
}
