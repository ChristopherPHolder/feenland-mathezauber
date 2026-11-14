import { DOCUMENT, NgOptimizedImage } from '@angular/common';
import { Component, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { LocaleService } from '../../core/locale';
import { gameText, GameMessageKey } from './game-messages';

/** How long a dropped gem takes to fly from the creature into the pouch (see battle-fx.css). */
const LANDING_MS = 1300;
/**
 * The haul of the wave in the HUD: gems dropped by rescued creatures, and the run of first tries.
 * Each count is keyed by its value, so a new number pops in instead of quietly changing.
 */
@Component({
  selector: 'app-gem-pouch',
  imports: [NgOptimizedImage],
  template: `<span class="pouch" role="img" [attr.aria-label]="t('gems', { n: gems() })">
      <span class="gem-art" aria-hidden="true"
        ><img ngSrc="/images/fairy-defense/crystals.webp" width="2172" height="724" alt=""
      /></span>
      @for (count of [shown()]; track count) {
        <span class="count" aria-hidden="true">{{ i.format(count) }}</span>
      }
    </span>
    @if (streak() >= 2) {
      @for (count of [streak()]; track count) {
        <span class="streak" role="img" [attr.aria-label]="t('streak', { n: count })">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="m12 2 2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 16.8l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8Z"
            />
          </svg>
          <span aria-hidden="true">{{ i.format(count) }}</span>
        </span>
      }
    }`,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .pouch,
    .streak {
      display: flex;
      align-items: center;
      gap: 4px;
      height: 46px;
      padding: 0 12px 0 6px;
      border-radius: var(--radius-button);
      background: var(--parchment);
      color: var(--ink);
      font-size: 22px;
      font-weight: 600;
    }
    .gem-art {
      position: relative;
      width: 26px;
      height: 36px;
      overflow: hidden;
    }
    .gem-art img {
      position: absolute;
      left: 0;
      top: 50%;
      width: 500%;
      height: auto;
      max-width: none;
      translate: 0 -50%;
    }
    .count {
      min-width: 1ch;
    }
    .streak {
      padding: 0 12px 0 8px;
      background: #fff1cb;
      color: #6b3d00;
    }
    .streak svg {
      width: 24px;
      height: 24px;
      fill: #f4b622;
      stroke: #8a5300;
      stroke-width: 1.5;
      stroke-linejoin: round;
    }
    /* Three first tries in a row: the pouch glows gold. */
    :host(.is-hot) .pouch {
      box-shadow:
        0 0 0 3px #f4b622,
        0 0 18px 4px #ffe27a;
    }
    @media (prefers-reduced-motion: no-preference) {
      .count,
      .streak {
        animation: pop 0.6s cubic-bezier(0.3, 1.6, 0.5, 1) both;
      }
    }
    @keyframes pop {
      from {
        scale: 0.3;
        opacity: 0;
      }
    }
    @media (max-width: 600px), (max-height: 500px) {
      .pouch,
      .streak {
        height: 40px;
        font-size: 18px;
        padding-right: 9px;
      }
      .gem-art {
        width: 22px;
        height: 30px;
      }
      .streak svg {
        width: 20px;
        height: 20px;
      }
    }
  `,
  host: { '[class.is-hot]': 'streak() >= 3' },
})
export class GemPouch {
  readonly gems = input(0);
  readonly streak = input(0);
  protected readonly i = inject(LocaleService);
  /** The count on the pouch: a new gem is counted when it lands, not when it leaves. */
  protected readonly shown = signal(0);
  private readonly document = inject(DOCUMENT);
  constructor() {
    let landing: ReturnType<typeof setTimeout> | undefined;
    effect(() => {
      const gems = this.gems();
      clearTimeout(landing);
      const still =
        this.document.documentElement.classList.contains('calm-motion') ||
        !!this.document.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if (gems <= untracked(this.shown) || still) this.shown.set(gems);
      else landing = setTimeout(() => this.shown.set(gems), LANDING_MS);
    });
    inject(DestroyRef).onDestroy(() => clearTimeout(landing));
  }
  protected t(key: GameMessageKey, values: Record<string, number> = {}) {
    return gameText(this.i.locale(), key, values);
  }
}
