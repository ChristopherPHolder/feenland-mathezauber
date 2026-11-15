import { Component, computed, input } from '@angular/core';

/**
 * The thinking-time ring in the sky: a glowing band that burns down and gets warmer as it
 * runs low, so a child can read the time at a glance without reading seconds.
 */
@Component({
  selector: 'app-fuse-timer',
  template: `
    <progress
      class="ring"
      max="100"
      [value]="percent()"
      [attr.aria-label]="label()"
      [attr.aria-valuetext]="valueText()"
    ></progress>
    <span class="spark" aria-hidden="true"></span>
    <span class="count" aria-hidden="true">{{ seconds() }}</span>
  `,
  host: {
    '[class.is-warm]': 'percent() <= 50 && percent() > 25',
    '[class.is-hot]': 'percent() <= 25',
    '[style.--value]': 'percent()',
  },
  styles: `
    @property --value {
      syntax: '<number>';
      inherits: true;
      initial-value: 100;
    }
    :host {
      --size: 84px;
      --band: 11px;
      --fill: #5fe0b6;
      position: absolute;
      z-index: 5;
      top: 86px;
      left: 24px;
      display: grid;
      place-items: center;
      width: var(--size);
      height: var(--size);
      border-radius: 50%;
      background: #152f4a;
      box-shadow:
        0 4px 12px #092e3355,
        0 0 0 3px #fffaf0;
      transition: --value 0s linear;
      pointer-events: none;
    }
    :host(.is-warm) {
      --fill: #ffc04d;
    }
    :host(.is-hot) {
      --fill: #ff7a6b;
      animation: glow 1s ease-in-out infinite alternate;
    }
    .ring {
      grid-area: 1 / 1;
      appearance: none;
      width: calc(var(--size) - 8px);
      height: calc(var(--size) - 8px);
      border: 0;
      border-radius: 50%;
      background: conic-gradient(var(--fill) calc(var(--value) * 1%), #ffffff33 0);
      mask: radial-gradient(
        farthest-side,
        transparent calc(100% - var(--band)),
        #000 calc(100% - var(--band) + 1px)
      );
    }
    .ring::-webkit-progress-bar,
    .ring::-webkit-progress-value {
      background: none;
    }
    .ring::-moz-progress-bar {
      background: none;
    }
    /* The burning tip of the fuse, riding the end of the band. */
    .spark {
      position: relative;
      grid-area: 1 / 1;
      width: 100%;
      height: 100%;
      rotate: calc(var(--value) * 3.6deg);
    }
    .spark::before {
      content: '';
      position: absolute;
      top: 1px;
      left: 50%;
      width: 14px;
      height: 14px;
      margin-left: -7px;
      border-radius: 50%;
      background: radial-gradient(circle, #fff 0 30%, var(--fill) 60%, transparent 72%);
      box-shadow: 0 0 10px 3px var(--fill);
    }
    .count {
      grid-area: 1 / 1;
      color: #fffaf0;
      font-size: 28px;
      font-weight: 800;
      font-variant-numeric: tabular-nums;
      line-height: 1;
    }
    @media (prefers-reduced-motion: no-preference) {
      :host {
        transition-duration: 1s;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      :host(.is-hot) {
        animation: none;
      }
    }
    @media (max-width: 600px), (max-height: 500px) {
      :host {
        --size: 64px;
        --band: 9px;
        top: 82px;
      }
      .count {
        font-size: 22px;
      }
    }
    @media (max-width: 600px) {
      :host {
        top: 70px;
        left: 12px;
      }
    }
    @media (forced-colors: active) {
      .ring {
        forced-color-adjust: none;
        --fill: CanvasText;
      }
    }
    @keyframes glow {
      to {
        box-shadow:
          0 4px 12px #092e3355,
          0 0 0 3px #fffaf0,
          0 0 22px 8px #ff7a6b;
      }
    }
  `,
})
export class FuseTimer {
  /** Seconds left. */
  readonly seconds = input.required<number>();
  /** The full thinking time in seconds. */
  readonly total = input.required<number>();
  readonly label = input.required<string>();
  readonly valueText = input.required<string>();
  protected readonly percent = computed(() =>
    Math.round((100 * Math.max(0, Math.min(this.seconds(), this.total()))) / this.total()),
  );
}
