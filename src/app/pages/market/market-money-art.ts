import { Component, computed, input } from '@angular/core';
import { MONEY_LOOK } from './market-frame';
import { Denomination, faceUnit, faceValue, isNote } from './market-money';

/** Coin diameters in px: bigger values are bigger coins, as in a real purse. */
const COIN_SIZE: Partial<Record<Denomination, number>> = {
  10: 30,
  20: 33,
  50: 37,
  100: 40,
  200: 46,
};
/** Note widths in px; notes are 9:5 and grow with their value. */
const NOTE_WIDTH: Partial<Record<Denomination, number>> = { 500: 64, 1000: 70, 2000: 76 };

/**
 * One coin or note, drawn in the market's own style: a two-tone coin with its value and a
 * little leaf, or a coloured note with a star. Decorative: the button around it carries the
 * spoken name.
 */
@Component({
  selector: 'app-market-money',
  host: {
    'aria-hidden': 'true',
    '[style.--w.px]': 'width()',
    '[style.--h.px]': 'height()',
  },
  template: `
    @if (note()) {
      <svg [attr.viewBox]="'0 0 90 50'">
        <rect
          x="2"
          y="2"
          width="86"
          height="46"
          rx="6"
          [attr.fill]="look().fill"
          [attr.stroke]="look().rim"
          stroke-width="3"
        />
        <rect
          x="8"
          y="8"
          width="74"
          height="34"
          rx="4"
          fill="none"
          [attr.stroke]="look().rim"
          stroke-width="1.5"
          stroke-dasharray="3 3"
        />
        <path
          d="m70 13 2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4-3.9-3.8 5.4-.8z"
          [attr.fill]="look().rim"
          opacity="0.6"
        />
        <text x="36" y="34" text-anchor="middle" [attr.fill]="look().ink" class="face">
          {{ face() }}
        </text>
        <text x="66" y="40" text-anchor="middle" [attr.fill]="look().ink" class="unit">
          {{ unit() }}
        </text>
      </svg>
    } @else {
      <svg viewBox="0 0 50 50">
        <circle cx="25" cy="25" r="23" [attr.fill]="look().rim" />
        <circle cx="25" cy="25" r="17" [attr.fill]="look().fill" />
        <circle
          cx="25"
          cy="25"
          r="20"
          fill="none"
          stroke="#ffffff"
          stroke-opacity="0.45"
          stroke-width="1.2"
        />
        <path d="M34 11c-5 0-8 3-8 7 4 0 8-3 8-7z" fill="#ffffff" opacity="0.5" />
        <text x="25" y="28" text-anchor="middle" [attr.fill]="look().ink" class="face">
          {{ face() }}
        </text>
        <text x="25" y="40" text-anchor="middle" [attr.fill]="look().ink" class="unit small">
          {{ unit() }}
        </text>
      </svg>
    }
  `,
  styles: `
    :host {
      display: inline-block;
      width: var(--w);
      height: var(--h);
      flex: none;
      filter: drop-shadow(0 2px 0 #0003);
    }
    svg {
      display: block;
      width: 100%;
      height: 100%;
      overflow: visible;
    }
    .face {
      font: 600 17px var(--font-sans);
    }
    .unit {
      font: 600 13px var(--font-sans);
    }
    .unit.small {
      font-size: 10px;
    }
    :host-context(.note) .face {
      font-size: 24px;
    }
  `,
})
export class MarketMoney {
  readonly value = input.required<Denomination>();
  /** 1 is the natural size; the tray and the 3D-less phone layout shrink coins a little. */
  readonly scale = input(1);
  protected readonly note = computed(() => isNote(this.value()));
  protected readonly look = computed(() => MONEY_LOOK[this.value()]);
  protected readonly face = computed(() => faceValue(this.value()));
  protected readonly unit = computed(() => faceUnit(this.value()));
  protected readonly width = computed(
    () => (this.note() ? NOTE_WIDTH[this.value()]! : COIN_SIZE[this.value()]!) * this.scale(),
  );
  protected readonly height = computed(() =>
    this.note() ? Math.round((this.width() * 5) / 9) : this.width(),
  );
}
