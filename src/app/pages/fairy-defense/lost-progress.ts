import { NgOptimizedImage } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { LocaleService } from '../../core/locale';
import { gameText, GameMessageKey } from './game-messages';

/**
 * What a lost wave still earned: the butterfly friends made (or the boss shields broken) before
 * the hearts ran out, so trying again starts from something won, not from nothing.
 */
@Component({
  selector: 'app-lost-progress',
  imports: [NgOptimizedImage],
  template: `
    @if (!boss() && count() > 0) {
      <span class="friends" aria-hidden="true">
        @for (friend of friends(); track friend) {
          <img ngSrc="/images/fairy-defense/butterfly.webp" width="1374" height="1145" alt="" />
        }
      </span>
    }
    <p>{{ text() }}</p>
  `,
  styles: `
    :host {
      display: block;
    }
    .friends {
      display: flex;
      justify-content: center;
      gap: 4px;
    }
    img {
      width: 52px;
      height: auto;
      filter: drop-shadow(0 3px 6px #7a4fa055);
    }
    p {
      margin: 6px 0 0;
      font-size: 1.15rem;
      font-weight: 700;
    }
    @media (prefers-reduced-motion: no-preference) {
      img {
        animation: flutter 1.6s ease-in-out infinite alternate;
      }
      img:nth-child(even) {
        animation-delay: -0.8s;
      }
    }
    @keyframes flutter {
      to {
        translate: 0 -6px;
        rotate: 6deg;
      }
    }
  `,
})
export class LostProgress {
  /** Monsters befriended, or shield layers broken on a boss wave. */
  readonly count = input(0);
  readonly boss = input(false);
  private readonly i = inject(LocaleService);
  protected readonly friends = computed(() => Array.from({ length: this.count() }, (_, n) => n));
  protected readonly text = computed(() => {
    const n = this.count();
    const key: GameMessageKey =
      n === 0
        ? 'lostNone'
        : this.boss()
          ? n === 1
            ? 'lostShield'
            : 'lostShields'
          : n === 1
            ? 'lostFriend'
            : 'lostFriends';
    return gameText(this.i.locale(), key, { n });
  });
}
