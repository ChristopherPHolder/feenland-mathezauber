import { Component, computed, inject, input, output } from '@angular/core';
import { Icon } from '@feenland/ui';
import { LocaleService } from '../../../core/locale';
import { gameText, GameMessageKey } from '../game-messages';
import { TOTAL_WAVES } from '../waves';
@Component({
  selector: 'app-wave-path',
  imports: [Icon],
  template: `<h2 id="wave-path-title">{{ t('chooseWave') }}</h2>
    <p class="wave-status">
      {{ t('savedWaves', { n: completed().length }) }}
      <span class="star-total"
        ><svg viewBox="0 0 24 24" aria-hidden="true"><path [attr.d]="star" /></svg
        >{{ t('starTotal', { n: starTotal() }) }}</span
      >
    </p>
    <ol class="wave-path" aria-labelledby="wave-path-title">
      @for (wave of waves; track wave) {
        <li>
          <button
            type="button"
            [class.done]="done().has(wave)"
            [class.boss]="wave % 5 === 0"
            [class.next]="wave === next()"
            [attr.aria-label]="
              t(done().has(wave) ? 'completedWave' : 'waveButton', { n: wave }) +
              (wave % 5 === 0 ? ' · ' + t('bossWave') : '') +
              (wave === next() ? ' · ' + t('nextUp') : '') +
              (starsFor(wave) ? ' · ' + t('starsLabel', { n: starsFor(wave) }) : '')
            "
            (click)="selectWave.emit(wave)"
          >
            <span>{{ wave }}</span>
            @if (starsFor(wave); as earned) {
              <span class="tile-stars" aria-hidden="true">
                @for (slot of slots; track slot) {
                  <svg viewBox="0 0 24 24" [class.earned]="slot <= earned">
                    <path [attr.d]="star" />
                  </svg>
                }
              </span>
            } @else {
              <ui-icon [kind]="done().has(wave) ? 'check' : wave % 5 === 0 ? 'cup' : 'gem'" />
            }
          </button>
        </li>
      }
    </ol>`,
  styles: `
    :host {
      display: block;
      background: #fffdf5;
      padding: 20px 28px;
    }
    h2 {
      font-size: 22px;
      line-height: 1.3;
      margin: 0;
    }
    .wave-status {
      font-size: 14px;
      color: #4c6079;
      margin: 4px 0 0;
    }
    .wave-path {
      display: grid;
      grid-template-columns: repeat(10, minmax(0, 1fr));
      gap: 12px;
      list-style: none;
      padding: 14px 0 0;
      margin: 0;
    }
    .wave-path button {
      width: 100%;
      min-height: 68px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 5px;
      padding: 10px 4px;
      border: 2px solid #75857a;
      border-radius: 16px;
      color: #172555;
      background: #fff9e9;
      font-size: 22px;
      font-weight: 600;
      cursor: pointer;
    }
    .wave-path button:hover {
      background: #fff1cb;
    }
    .wave-path ui-icon {
      width: 18px;
      height: 18px;
    }
    .wave-status {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px 14px;
    }
    .star-total {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-weight: 600;
      color: #6b3d00;
    }
    .star-total svg {
      width: 18px;
      height: 18px;
      fill: #f4b622;
      stroke: #8a5300;
      stroke-width: 1.5;
    }
    .tile-stars {
      display: flex;
      gap: 1px;
    }
    .tile-stars svg {
      width: 16px;
      height: 16px;
      fill: #fffdf5;
      stroke: #75857a;
      stroke-width: 1.5;
      stroke-linejoin: round;
    }
    .tile-stars .earned {
      fill: #f4b622;
      stroke: #8a5300;
    }
    .wave-path .done {
      background: #dfefe3;
      border-color: #28604b;
    }
    .wave-path .boss {
      border-color: #87502c;
    }
    .wave-path .next {
      border-color: #c91860;
      box-shadow: 0 0 0 3px #c9186033;
    }
    @media (max-width: 700px) {
      :host {
        padding: 16px;
      }
      .wave-path {
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: 8px;
      }
      .wave-path button {
        min-height: 60px;
        font-size: 20px;
      }
    }
  `,
})
export class WavePathComponent {
  /** Wave numbers that already have a saved result. */
  readonly completed = input<readonly number[]>([]);
  /** The wave the child is expected to play next; highlighted, never gated. */
  readonly next = input(1);
  /** Best stars per wave; waves saved before stars existed have none and keep their check. */
  readonly stars = input<ReadonlyMap<number, number>>(new Map());
  readonly starTotal = input(0);
  readonly selectWave = output<number>();
  protected readonly slots = [1, 2, 3];
  protected readonly star =
    'm12 2 2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 16.8l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8Z';
  protected starsFor(wave: number) {
    return this.stars().get(wave) ?? 0;
  }
  protected readonly waves = Array.from({ length: TOTAL_WAVES }, (_, i) => i + 1);
  protected readonly done = computed(() => new Set(this.completed()));
  private readonly i = inject(LocaleService);
  protected t(key: GameMessageKey, values: Record<string, number> = {}) {
    return gameText(this.i.locale(), key, values);
  }
}
