import { DOCUMENT } from '@angular/common';
import { effect, inject, Service, signal } from '@angular/core';

const KEY = 'feenland.calm-motion';

/**
 * The Settings switch for calm motion. When on, `calm-motion` on the root element stops the
 * bouncing, drifting and floating decorations in every game, the same way the device's
 * reduced-motion preference does.
 */
@Service()
export class MotionPreference {
  private readonly document = inject(DOCUMENT);
  readonly calm = signal(this.read());

  constructor() {
    effect(() => this.document.documentElement.classList.toggle('calm-motion', this.calm()));
  }

  set(calm: boolean) {
    this.calm.set(calm);
    try {
      this.document.defaultView?.localStorage.setItem(KEY, String(calm));
    } catch {
      // Without storage the switch still works for this visit.
    }
  }

  private read(): boolean {
    try {
      return this.document.defaultView?.localStorage.getItem(KEY) === 'true';
    } catch {
      return false;
    }
  }
}
