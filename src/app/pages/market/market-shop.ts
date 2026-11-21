import { Component, computed, input } from '@angular/core';
import { GOOD_EMOJI, MarketFrame, MONEY_LOOK } from './market-frame';
import { GOOD_IDS } from './market-levels';
import { isNote } from './market-money';

/** Sky colours through the window: midday, golden hour, dusk. */
const SKY = ['#9fd6f5', '#ffb66b', '#6b4f9e'] as const;

function mix(a: string, b: string, t: number): string {
  const channel = (hex: string, at: number) => parseInt(hex.slice(at, at + 2), 16);
  const part = (at: number) =>
    Math.round(channel(a, at) + (channel(b, at) - channel(a, at)) * t)
      .toString(16)
      .padStart(2, '0');
  return `#${part(1)}${part(3)}${part(5)}`;
}

/**
 * The flat Fairy Market: Olli's shop as a drawing, for devices without WebGL and for tests.
 * It draws the same frame as the 3D shop: the treat and its price tag on the counter, the
 * coins on the tray, Olli behind the counter, Lumi with her basket, the sun in the window and
 * Lumi's shelf. Decorative; the game's DOM controls and status carry everything.
 */
@Component({
  selector: 'app-market-shop',
  host: { 'aria-hidden': 'true' },
  template: `
    <svg viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice">
      <rect width="400" height="250" fill="#f3dcb8" />
      <path d="M0 0h400v18q-200 26-400 0z" fill="#c99a62" />
      <!-- The round window and its sun -->
      <circle cx="62" cy="70" r="42" fill="#8a5a2b" />
      <circle cx="62" cy="70" r="36" [attr.fill]="sky()" />
      <circle cx="62" [attr.cy]="sunY()" r="11" fill="#ffd23f" [attr.opacity]="sunShown()" />
      <path d="M26 70h72M62 34v72" stroke="#8a5a2b" stroke-width="4" />
      <!-- Lumi's shelf under the window -->
      <rect x="18" y="118" width="88" height="6" rx="3" fill="#a46b35" />
      @for (good of shelfGoods(); track good; let index = $index) {
        <text [attr.x]="26 + (index % 6) * 14" [attr.y]="index < 6 ? 116 : 104" class="mini">
          {{ emoji[good] }}
        </text>
      }
      <!-- Olli's shelves -->
      @for (row of [0, 1]; track row) {
        <rect x="140" [attr.y]="58 + row * 44" width="230" height="7" rx="3" fill="#a46b35" />
        @for (good of shelfRow(row); track good; let index = $index) {
          <text [attr.x]="152 + index * 38" [attr.y]="54 + row * 44" class="ware">
            {{ emoji[good] }}
          </text>
        }
      }
      <!-- Lanterns glow gold for Lucky Shopper -->
      @for (x of [130, 270]; track x) {
        <circle
          [attr.cx]="x"
          cy="26"
          r="8"
          [attr.fill]="frame().golden ? '#ffd23f' : '#f6e3b0'"
          [class.glow]="frame().golden"
        />
      }
      <!-- Olli the otter behind the counter -->
      <g transform="translate(205 128)" [class.shake]="frame().slips > 0">
        <ellipse cx="0" cy="40" rx="30" ry="34" fill="#8a5a36" />
        <ellipse cx="0" cy="46" rx="18" ry="22" fill="#f2dcc0" />
        <path d="M-18 24h36v34h-36z" fill="#5fa86b" opacity="0.9" />
        <circle cx="0" cy="0" r="24" fill="#8a5a36" />
        <circle cx="-19" cy="-16" r="6" fill="#6e4528" />
        <circle cx="19" cy="-16" r="6" fill="#6e4528" />
        <ellipse cx="0" cy="8" rx="14" ry="10" fill="#f2dcc0" />
        <circle cx="-8" cy="-4" r="3" fill="#1d1d2b" />
        <circle cx="8" cy="-4" r="3" fill="#1d1d2b" />
        <ellipse cx="0" cy="4" rx="4" ry="3" fill="#3a2418" />
        <path d="M-4 10q4 4 8 0" fill="none" stroke="#3a2418" stroke-width="1.6" />
        <path d="M-6 7l-14-3M-6 9l-14 2M6 7l14-3M6 9l14 2" stroke="#3a2418" stroke-width="0.8" />
      </g>
      <!-- The counter -->
      <rect x="40" y="178" width="330" height="72" fill="#b97a3f" />
      <rect x="34" y="170" width="342" height="12" rx="5" fill="#d9a066" />
      <!-- The till -->
      <g transform="translate(270 140)">
        <rect x="0" y="12" width="46" height="30" rx="5" fill="#d8a93a" />
        <rect x="6" y="0" width="34" height="16" rx="3" fill="#f2cf6b" />
        <circle cx="23" cy="27" r="5" fill="#a87b1c" />
      </g>
      <!-- The treat with its price tag -->
      @if (showTreat()) {
        <g [attr.transform]="'translate(150 ' + (frame().big ? 158 : 164) + ')'">
          @if (frame().big) {
            <circle cx="0" cy="-8" r="22" fill="#fff3b0" opacity="0.8" />
          }
          <text x="0" y="0" class="treat" [class.big]="frame().big">{{ emoji[frame().good] }}</text>
          @if (frame().priceText) {
            <path d="M14 -24l12 -8" stroke="#8a5a2b" stroke-width="1.4" />
            <rect x="22" y="-44" width="44" height="22" rx="6" fill="#fffdf5" stroke="#8a5a2b" />
            <text x="44" y="-28" class="tag">{{ frame().priceText }}</text>
          }
        </g>
      }
      <!-- The tray and its coins -->
      <rect x="70" y="190" width="170" height="40" rx="8" fill="#8a5a2b" opacity="0.35" />
      @for (coin of trayCoins(); track $index) {
        @if (coin.note) {
          <rect
            [attr.x]="coin.x - 14"
            [attr.y]="coin.y - 8"
            width="28"
            height="16"
            rx="2"
            [attr.fill]="coin.fill"
            [attr.stroke]="coin.rim"
          />
        } @else {
          <circle [attr.cx]="coin.x" [attr.cy]="coin.y" r="9" [attr.fill]="coin.rim" />
          <circle [attr.cx]="coin.x" [attr.cy]="coin.y" r="6.5" [attr.fill]="coin.fill" />
        }
      }
      <!-- Lumi the fairy with her basket -->
      <g transform="translate(340 120)" class="lumi" [class.hop]="frame().outcome === 'bought'">
        <ellipse cx="-14" cy="6" rx="16" ry="24" fill="#d9f3ff" opacity="0.75" />
        <ellipse cx="14" cy="6" rx="16" ry="24" fill="#d9f3ff" opacity="0.75" />
        <path d="M-14 46 0 6l14 40z" fill="#bfe8cf" />
        <circle cx="0" cy="-6" r="14" fill="#f8d9c4" />
        <path d="M-15 -6q0-18 15-18t15 18q-6-8-15-8t-15 8z" fill="#f4d35e" />
        <circle cx="-5" cy="-6" r="2" fill="#2e6fd1" />
        <circle cx="5" cy="-6" r="2" fill="#2e6fd1" />
        <path d="M-4 1q4 3 8 0" fill="none" stroke="#c0596f" stroke-width="1.4" />
        <path d="M-6 48h5M2 48h5" stroke="#e5b93c" stroke-width="4" stroke-linecap="round" />
        <path d="M-30 40h26l-4 16h-18z" fill="#c8924e" />
        @for (good of basketGoods(); track $index) {
          <text
            [attr.x]="-24 + ($index % 3) * 8"
            [attr.y]="40 - Math.floor($index / 3) * 6"
            class="mini"
          >
            {{ emoji[good] }}
          </text>
        }
      </g>
    </svg>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
    svg {
      display: block;
      width: 100%;
      height: 100%;
    }
    text {
      text-anchor: middle;
      font-family: var(--font-sans);
    }
    .ware {
      font-size: 22px;
    }
    .mini {
      font-size: 10px;
    }
    .treat {
      font-size: 30px;
    }
    .treat.big {
      font-size: 40px;
    }
    .tag {
      font-size: 12px;
      font-weight: 600;
      fill: #16264f;
    }
    @media (prefers-reduced-motion: no-preference) {
      .glow {
        animation: glow 1.2s ease-in-out infinite alternate;
      }
    }
    @keyframes glow {
      to {
        opacity: 0.6;
      }
    }
    :host-context(.calm-motion) .glow {
      animation: none;
    }
  `,
})
export class MarketShop {
  readonly frame = input.required<MarketFrame>();
  protected readonly emoji = GOOD_EMOJI;
  protected readonly Math = Math;
  protected readonly sky = computed(() => {
    const t = this.frame().sunset;
    return t < 0.5 ? mix(SKY[0], SKY[1], t * 2) : mix(SKY[1], SKY[2], (t - 0.5) * 2);
  });
  protected readonly sunY = computed(() => 52 + this.frame().sunset * 46);
  protected readonly sunShown = computed(() => (this.frame().sunset >= 1 ? 0 : 1));
  protected readonly shelfGoods = computed(() => GOOD_IDS.slice(0, this.frame().shelf));
  protected readonly basketGoods = computed(() => this.frame().basket.slice(-9));
  protected readonly showTreat = computed(
    () => this.frame().phase === 'shop' || this.frame().outcome === 'none',
  );
  protected shelfRow(row: number) {
    return GOOD_IDS.slice(row * 6, row * 6 + 6);
  }
  protected readonly trayCoins = computed(() =>
    this.frame().tray.map((value, index) => ({
      x: 88 + (index % 7) * 22,
      y: index < 7 ? 204 : 220,
      note: isNote(value),
      ...MONEY_LOOK[value],
    })),
  );
}
