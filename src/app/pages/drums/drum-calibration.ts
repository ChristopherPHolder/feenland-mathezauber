import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { LocaleService } from '../../core/locale';
import { drumText, DrumMessageKey } from './drum-messages';
import { DrumSounds } from './drum-sounds';

export const CALIBRATION_KEY = 'feenland.drums-calibration.v1';
/** Eight drum beats at 100 bpm; the taps on the last six set the offset. */
const BEATS = 8;
const PERIOD = 0.6;
const MAX_OFFSET = 0.35;

/** The typical lag of a child's taps behind the beats, or null without enough taps. */
export function tapOffset(beats: readonly number[], taps: readonly number[]): number | null {
  const offsets = taps
    .map((tap) => {
      const nearest = beats.reduce((best, beat) =>
        Math.abs(beat - tap) < Math.abs(best - tap) ? beat : best,
      );
      return tap - nearest;
    })
    .filter((offset) => Math.abs(offset) < PERIOD / 2)
    .sort((a, b) => a - b);
  if (offsets.length < 4) return null;
  const middle = offsets[Math.floor(offsets.length / 2)];
  return Math.max(0, Math.min(MAX_OFFSET, middle));
}

/**
 * "Sound a bit late? Tap with the drum": eight beats play and the child taps along. Headphones
 * and some tablets play sound late, so the median lag widens the on-beat window. Optional and
 * remembered on the device.
 */
@Component({
  selector: 'app-drum-calibration',
  template: `@if (!open()) {
      <button class="button secondary open" type="button" (click)="begin()">
        {{ t('calibrate') }}
      </button>
    } @else {
      <section class="panel-in" [attr.aria-label]="t('calibrate')">
        <p role="status">{{ t(message()) }}</p>
        @if (message() === 'calibrateHelp') {
          <button
            class="tap"
            type="button"
            [class.hit]="flash()"
            (pointerdown)="tap($event)"
            (keydown.enter)="tap($event)"
            (keydown.space)="tap($event)"
          >
            {{ t('calibrateTap') }}
          </button>
        }
        <button class="button secondary" type="button" (click)="close()">
          {{ t('calibrateClose') }}
        </button>
      </section>
    }`,
  styles: `
    :host {
      display: block;
      margin-top: 12px;
    }
    .open {
      width: auto;
      min-height: 44px;
      font-size: 15px;
    }
    .panel-in {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      border-radius: var(--radius-surface);
      background: var(--ground);
    }
    .panel-in p {
      flex: 1 1 200px;
      margin: 0;
    }
    .tap {
      width: clamp(88px, 22vw, 120px);
      aspect-ratio: 1;
      border: 4px solid #8a5a2b;
      border-radius: 50%;
      background: #fff8e8;
      color: var(--ink);
      font: 600 22px var(--font-sans);
      box-shadow: 0 6px 0 #8a5a2b;
      touch-action: manipulation;
    }
    .tap.hit {
      transform: translateY(4px);
      box-shadow: 0 2px 0 #8a5a2b;
    }
  `,
})
export class DrumCalibration {
  private readonly i = inject(LocaleService);
  private readonly sounds = inject(DrumSounds);
  private readonly document = inject(DOCUMENT);
  protected readonly open = signal(false);
  protected readonly message = signal<DrumMessageKey>('calibrateHelp');
  protected readonly flash = signal(false);
  private beats: number[] = [];
  private taps: number[] = [];
  private timer?: ReturnType<typeof setTimeout>;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  protected t(key: DrumMessageKey) {
    return drumText(this.i.locale(), key);
  }

  protected begin() {
    this.open.set(true);
    this.taps = [];
    if (!this.sounds.enabled) {
      this.message.set('calibrateNoSound');
      return;
    }
    this.message.set('calibrateHelp');
    this.sounds.unlock();
    const first = this.sounds.now() + 0.8;
    this.beats = Array.from({ length: BEATS }, (_, index) => first + index * PERIOD);
    this.beats.forEach((beat) => this.sounds.hit(40, beat));
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.settle(), (0.8 + BEATS * PERIOD + 0.4) * 1000);
  }

  protected tap(event: Event) {
    event.preventDefault();
    this.taps.push(this.sounds.now());
    this.flash.set(true);
    setTimeout(() => this.flash.set(false), 90);
  }

  protected close() {
    clearTimeout(this.timer);
    this.open.set(false);
  }

  private settle() {
    // The first two beats let the child find the rhythm.
    const offset = tapOffset(this.beats.slice(2), this.taps);
    if (offset === null) {
      this.message.set('calibrateRetry');
      return;
    }
    try {
      this.document.defaultView?.localStorage.setItem(CALIBRATION_KEY, offset.toFixed(3));
    } catch {
      /* Without storage the default window stays. */
    }
    this.message.set('calibrateDone');
  }
}
