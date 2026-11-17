import { Component, computed, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DragonFace } from '@feenland/ui';
import { LocaleService } from '../../core/locale';
import { EggIcon } from './egg-icon';
import { HatcheryStore } from './hatchery-store';
import { hatcheryText } from './hatchery-messages';

/**
 * The dragon egg in every game's header: it fills up and glows with each right answer, and
 * shines once it is ready to hatch. Once every dragon has hatched, it shows the dragon growing
 * up inside a ring that fills instead. A tap opens the hatchery at any time.
 */
@Component({
  selector: 'app-egg-chip',
  imports: [DragonFace, EggIcon, RouterLink],
  template: `<a class="chip" routerLink="/hatchery" [attr.aria-label]="label()">
      @if (dragon(); as dragon) {
        <svg class="ring" viewBox="0 0 46 46" aria-hidden="true">
          <circle cx="23" cy="23" r="21" pathLength="100" />
          <circle
            class="ring-fill"
            cx="23"
            cy="23"
            r="21"
            pathLength="100"
            [attr.stroke-dasharray]="fill() * 100 + ' 100'"
          />
        </svg>
        <ui-dragon-face [colors]="dragon" [form]="store.stage(dragon)" />
      } @else {
        <app-egg-icon [dragon]="store.egg()" [warmth]="fill()" />
      }
      @if (warming()) {
        <span class="plus" aria-hidden="true">+1</span>
      }
    </a>
    <span class="sr-only" aria-live="polite">{{ announcement() }}</span>`,
  styles: `
    :host {
      position: relative;
      display: inline-flex;
    }
    .chip {
      position: relative;
      display: grid;
      place-items: center;
      width: 46px;
      height: 46px;
      border-radius: 50%;
      background: #ffffffd9;
      box-shadow: var(--shadow-rest);
      font-size: 17px;
      text-decoration: none;
    }
    :host(.is-warming) .chip {
      animation: warm-pop 0.6s ease-out;
      box-shadow:
        0 0 0 4px #ffcf7a99,
        var(--shadow-rest);
    }
    :host(.is-ready) .chip {
      background: var(--warm-ground);
      box-shadow:
        0 0 0 3px var(--sun),
        0 0 16px #ffb35c;
      animation: ready-rock 2.4s ease-in-out infinite;
    }
    .ring {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      transform: rotate(-90deg);
      fill: none;
      stroke: #3fae5c33;
      stroke-width: 3;
    }
    .ring-fill {
      stroke: #3fae5c;
      stroke-linecap: round;
      transition: stroke-dasharray 0.6s ease;
    }
    ui-dragon-face {
      position: relative;
      font-size: 15px;
    }
    .plus {
      position: absolute;
      top: -8px;
      right: -6px;
      padding: 0 5px;
      border-radius: 10px;
      background: var(--sun);
      color: var(--ink);
      font-size: 12px;
      font-weight: 700;
      animation: plus-rise 0.8s ease-out forwards;
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
    @keyframes warm-pop {
      40% {
        transform: scale(1.18);
      }
    }
    @keyframes ready-rock {
      0%,
      70%,
      100% {
        transform: rotate(0);
      }
      78% {
        transform: rotate(-12deg);
      }
      86% {
        transform: rotate(10deg);
      }
      94% {
        transform: rotate(-5deg);
      }
    }
    @keyframes plus-rise {
      to {
        transform: translateY(-14px);
        opacity: 0;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .chip,
      .plus {
        animation: none !important;
      }
    }
  `,
  host: {
    '[class.is-warming]': 'warming()',
    '[class.is-ready]': 'store.ready()',
  },
})
export class EggChip {
  protected readonly store = inject(HatcheryStore);
  private readonly i = inject(LocaleService);
  protected readonly fill = computed(() =>
    this.store.needed() ? this.store.progress() / this.store.needed() : 1,
  );
  /** With the book complete: the dragon growing up, or the favourite once all are grand. */
  protected readonly dragon = computed(() =>
    this.store.growing() ? (this.store.raising() ?? this.store.favorite()) : undefined,
  );
  protected readonly label = computed(() => {
    const locale = this.i.locale();
    const raising = this.store.raising();
    const name = raising ? this.store.name(raising) : '';
    const progress = !this.store.growing()
      ? this.store.ready()
        ? hatcheryText(locale, 'eggChipReady')
        : hatcheryText(locale, 'eggChip', {
            n: this.store.progress(),
            total: this.store.needed(),
          })
      : !raising
        ? hatcheryText(locale, 'allGrandChip')
        : this.store.ready()
          ? hatcheryText(locale, 'growChipReady', { name })
          : hatcheryText(locale, 'growChip', {
              name,
              n: this.store.progress(),
              total: this.store.needed(),
            });
    return `${hatcheryText(locale, 'title')}. ${progress}`;
  });
  protected readonly warming = signal(false);
  protected readonly announcement = signal('');
  private timer?: ReturnType<typeof setTimeout>;

  constructor() {
    const seen = this.store.pulse();
    const wasReady = this.store.ready();
    effect(() => {
      const pulse = this.store.pulse();
      if (pulse === seen) return;
      untracked(() => {
        this.warming.set(true);
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.warming.set(false), 800);
      });
    });
    effect(() => {
      // Say it once, when the egg becomes ready during this game.
      if (this.store.ready() && !wasReady)
        untracked(() => {
          const raising = this.store.raising();
          this.announcement.set(
            this.store.growing() && raising
              ? hatcheryText(this.i.locale(), 'growReadyAnnounce', {
                  name: this.store.name(raising),
                })
              : hatcheryText(this.i.locale(), 'eggReadyAnnounce'),
          );
        });
    });
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }
}
