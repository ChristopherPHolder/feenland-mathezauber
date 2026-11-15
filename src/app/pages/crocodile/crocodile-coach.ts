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
import { CrocodileArt } from './crocodile-art';
import { crocodileText, CrocodileMessageKey } from './crocodile-messages';
import type { HatId } from './crocodile-score';

/**
 * A little "how to feed Kiki" coach over the pond: a finger taps the bigger of two made-up numbers
 * and Kiki gulps it, then a finger taps Kiki when both sides match. It never uses the snack on
 * screen, so it shows how to play without giving an answer away. The game pauses the heron while
 * it is open.
 */
@Component({
  selector: 'app-crocodile-coach',
  imports: [CrocodileArt],
  templateUrl: './crocodile-coach.html',
  styleUrl: './crocodile-coach.css',
})
export class CrocodileCoach {
  private readonly i = inject(LocaleService);
  /** True when the coach comes back mid-round, after a snatched or untouched snack. */
  readonly again = input(false);
  /** Levels with sums show "work out both sides first" above the pictures. */
  readonly maths = input(false);
  /** The bigger number sits on the left, so the lesson is "bigger", never "always right". */
  readonly flip = input(false);
  readonly hat = input<HatId | 'none'>('none');
  readonly done = output<void>();

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    // A modal dialog keeps the pond and the answers out of reach until the child is ready, and
    // starts focus on "Got it!". It leaves the top layer when the game removes the coach.
    afterNextRender(() => {
      const dialog = this.dialog().nativeElement;
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
      dialog.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
    });
  }

  /** Escape closes the coach the same way "Got it!" does. */
  protected cancel(event: Event) {
    event.preventDefault();
    this.done.emit();
  }

  protected t(key: CrocodileMessageKey) {
    return crocodileText(this.i.locale(), key);
  }
}
