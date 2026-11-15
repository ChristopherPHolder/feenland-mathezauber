import { NgOptimizedImage } from '@angular/common';
import { Component, inject, input } from '@angular/core';
import { LocaleService } from '../../core/locale';
import { gameText, GameMessageKey } from './game-messages';

/** What a finished wave pays out: one to three stars popping in, and the gems in the pouch. */
@Component({
  selector: 'app-wave-reward',
  imports: [NgOptimizedImage],
  template: `<div class="stars" role="img" [attr.aria-label]="t('starsLabel', { n: stars() })">
      @for (slot of slots; track slot) {
        <svg viewBox="0 0 24 24" aria-hidden="true" [class.earned]="slot <= stars()">
          <path d="m12 2 2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 16.8l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8Z" />
        </svg>
      }
    </div>
    <p class="haul">
      <span class="gem-art" aria-hidden="true"
        ><img ngSrc="/images/fairy-defense/crystals.webp" width="2172" height="724" alt=""
      /></span>
      {{ t('gems', { n: gems() }) }}
    </p>`,
  styles: `
    :host {
      display: block;
    }
    .stars {
      display: flex;
      justify-content: center;
      align-items: flex-end;
      gap: 6px;
    }
    svg {
      width: 52px;
      height: 52px;
      fill: #efe6cf;
      stroke: #9b8a68;
      stroke-width: 1.2;
      stroke-linejoin: round;
    }
    /* The middle star sits a little higher, like a crown. */
    svg:nth-child(2) {
      width: 64px;
      height: 64px;
      margin-bottom: 8px;
    }
    .earned {
      fill: #f4b622;
      stroke: #8a5300;
      filter: drop-shadow(0 0 6px #ffe27a);
    }
    .haul {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      margin: 6px 0 0;
      font-size: 20px;
      font-weight: 600;
    }
    .gem-art {
      position: relative;
      width: 24px;
      height: 32px;
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
    @media (prefers-reduced-motion: no-preference) {
      svg {
        animation: land 0.6s cubic-bezier(0.3, 1.6, 0.5, 1) both;
      }
      svg:nth-child(2) {
        animation-delay: 0.35s;
      }
      svg:nth-child(3) {
        animation-delay: 0.7s;
      }
    }
    @keyframes land {
      from {
        scale: 0.1;
        rotate: -60deg;
        opacity: 0;
      }
    }
    @media (max-height: 500px) {
      svg {
        width: 40px;
        height: 40px;
      }
      svg:nth-child(2) {
        width: 48px;
        height: 48px;
      }
      .haul {
        font-size: 17px;
      }
    }
  `,
})
export class WaveReward {
  readonly stars = input(1);
  readonly gems = input(0);
  protected readonly slots = [1, 2, 3];
  protected readonly i = inject(LocaleService);
  protected t(key: GameMessageKey, values: Record<string, number> = {}) {
    return gameText(this.i.locale(), key, values);
  }
}
