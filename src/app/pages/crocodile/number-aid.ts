import { Component, computed, inject, input } from '@angular/core';
import { LocaleService } from '../../core/locale';
import type { Side } from './compare';
import { crocText } from './crocodile-messages';
/** Visual counting help under a number card: the worked sum, fish to count, or tens and ones. */
@Component({
  selector: 'app-number-aid',
  template: `@if (calculation()) {
      <span class="aid calc">{{ side().text }} = {{ i.format(side().value) }}</span>
    } @else if (side().value <= 20) {
      <span class="aid fish-row" role="img" [attr.aria-label]="fishLabel()">
        @for (dot of dots(); track dot) {
          <span class="fish"></span>
        }
      </span>
    } @else {
      <span class="aid tens-row" role="img" [attr.aria-label]="i.format(side().value)">
        @for (ten of tens(); track ten) {
          <span class="ten-bar"></span>
        }
        @for (one of ones(); track one) {
          <span class="one-dot"></span>
        }
      </span>
    }`,
  styles: `
    :host {
      display: block;
    }
    .aid {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      align-items: center;
      gap: 4px;
      max-width: 150px;
      margin: 8px auto 0;
    }
    .calc {
      font-size: 18px;
      font-weight: 600;
      color: #a3124a;
    }
    .fish {
      width: 18px;
      height: 12px;
      border-radius: 60% 40% 40% 60%;
      background: #f08a24;
      position: relative;
    }
    .fish::after {
      content: '';
      position: absolute;
      right: -5px;
      top: 1px;
      border-left: 6px solid #f08a24;
      border-top: 5px solid transparent;
      border-bottom: 5px solid transparent;
    }
    .fish-row {
      gap: 8px 10px;
      max-width: 140px;
    }
    .ten-bar {
      width: 10px;
      height: 44px;
      border-radius: 4px;
      background: #3b7dd8;
    }
    .one-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #f08a24;
    }
    .tens-row {
      max-width: 170px;
    }
  `,
})
export class NumberAid {
  readonly side = input.required<Side>();
  protected readonly i = inject(LocaleService);
  protected readonly calculation = computed(() => /[+−]/.test(this.side().text));
  protected readonly dots = computed(() =>
    Array.from({ length: Math.max(0, Math.min(this.side().value, 20)) }, (_, index) => index),
  );
  protected readonly tens = computed(() =>
    Array.from({ length: Math.floor(this.side().value / 10) }, (_, index) => index),
  );
  protected readonly ones = computed(() =>
    Array.from({ length: this.side().value % 10 }, (_, index) => index),
  );
  protected readonly fishLabel = computed(() =>
    crocText(this.i.locale(), 'fish', { n: this.side().value }),
  );
}
