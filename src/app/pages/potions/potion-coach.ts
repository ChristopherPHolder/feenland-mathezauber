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
import { PotionDemo } from './potion-demo';
import { potionText, PotionMessageKey } from './potion-messages';
import type { PotionOp } from './potion-puzzles';

/**
 * "How to brew" over the cauldron: the demo film in a modal dialog. The ? button opens it any
 * time; the game holds the hourglass while it is open.
 */
@Component({
  selector: 'app-potion-coach',
  imports: [PotionDemo],
  template: `<dialog #dialog aria-labelledby="coach-title" (cancel)="cancel($event)">
    <div class="card">
      <h2 id="coach-title">{{ t('demoTitle') }}</h2>
      <app-potion-demo [ops]="ops()" />
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
      background: rgb(29 22 64 / 0.55);
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
export class PotionCoach {
  private readonly i = inject(LocaleService);
  readonly ops = input<readonly PotionOp[]>(['+', '−']);
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

  protected t(key: PotionMessageKey) {
    return potionText(this.i.locale(), key);
  }
}
