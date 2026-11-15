import { Component, computed, inject, input } from '@angular/core';
import { LocaleService } from '../../core/locale';
import { StarRating } from '../../shared/star-rating';
import { ratingFor } from './number-wall';

interface RewardRow {
  readonly key: 'wallRewardBuilt' | 'wallRewardPerfect' | 'wallRewardFast';
  readonly badge: string;
  readonly earned: boolean;
}

/**
 * The prize card once a wall stands: which of its gems the child won (built, no mistakes, faster
 * than the troll), the ones still to win next time, and the stars the level is heading for.
 */
@Component({
  selector: 'app-wall-reward',
  imports: [StarRating],
  host: { class: 'is-reward' },
  template: `
    <h2 class="title">{{ i.t('wallRewardTitle') }}</h2>
    <ul class="rows">
      @for (row of rows(); track row.key) {
        <li class="row" [class.is-earned]="row.earned">
          <span class="badge" aria-hidden="true">{{ row.badge }}</span>
          <span class="label">{{ i.t(row.key) }}</span>
          <span class="gain">+{{ row.earned ? 1 : 0 }} <span aria-hidden="true">💎</span></span>
        </li>
      }
    </ul>
    <div class="foot">
      <p class="stars">
        <span>{{ i.t('wallRewardStars') }}</span>
        <app-star-rating [stars]="stars()" />
      </p>
      @if (stars() < 3) {
        <p class="help">{{ i.t('wallStarsHelp') }}</p>
      }
    </div>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px 18px;
      border-radius: var(--radius-surface);
      background: var(--paper-veil);
      color: var(--ink);
    }
    .title {
      margin: 0;
      font-size: 18px;
    }
    .rows {
      display: grid;
      flex: 1;
      grid-auto-rows: minmax(52px, 1fr);
      gap: 10px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .row {
      display: grid;
      grid-template-columns: 44px 1fr auto;
      align-items: center;
      gap: 10px;
      padding: 4px 12px 4px 6px;
      border: 2px dashed var(--star-empty);
      border-radius: 16px;
      color: var(--muted);
      font-weight: 600;
      animation: pop 420ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
    }
    .row:nth-child(2) {
      animation-delay: 160ms;
    }
    .row:nth-child(3) {
      animation-delay: 320ms;
    }
    .row.is-earned {
      border: 2px solid var(--gold);
      background: var(--warm-ground);
      color: var(--ink);
    }
    .badge {
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: var(--paper);
      font-size: 26px;
      filter: grayscale(1);
      opacity: 0.55;
    }
    .is-earned .badge {
      filter: none;
      opacity: 1;
    }
    .gain {
      font-size: 18px;
      font-weight: 700;
      white-space: nowrap;
    }
    .foot {
      display: grid;
      gap: 6px;
      margin-top: auto;
      padding-top: 10px;
      border-top: 2px dashed var(--parchment-deep);
    }
    .help {
      margin: 0;
      color: var(--muted);
      font-size: 15px;
    }
    .stars {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin: 0;
      font-weight: 600;
    }
    @keyframes pop {
      from {
        opacity: 0;
        transform: scale(0.85);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .row {
        animation: none;
      }
    }
  `,
})
export class WallReward {
  readonly perfect = input(false);
  readonly fast = input(false);
  readonly timed = input(false);
  /** Gems won in the level so far, this wall included. */
  readonly gems = input(0);
  readonly wallsDone = input(1);

  protected readonly i = inject(LocaleService);
  protected readonly rows = computed<readonly RewardRow[]>(() => [
    { key: 'wallRewardBuilt', badge: '🧱', earned: true },
    { key: 'wallRewardPerfect', badge: '⭐', earned: this.perfect() },
    ...(this.timed() ? [{ key: 'wallRewardFast' as const, badge: '⚡', earned: this.fast() }] : []),
  ]);
  protected readonly stars = computed(() =>
    ratingFor(this.gems(), this.timed(), Math.max(1, this.wallsDone())),
  );
}
