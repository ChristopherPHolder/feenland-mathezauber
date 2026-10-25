import { Component, computed, inject, input, output } from '@angular/core';
import { Icon } from '../../../shared/icon';
import { LocaleService } from '../../../core/locale';
import { gameText, GameMessageKey } from '../game-messages';
import { TOTAL_WAVES } from '../waves';
@Component({
  selector: 'app-wave-path',
  imports: [Icon],
  template: `<h2 id="wave-path-title">{{ t('chooseWave') }}</h2>
    <p class="wave-status">{{ t('savedWaves', { n: completed().length }) }}</p>
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
              (wave === next() ? ' · ' + t('nextUp') : '')
            "
            (click)="selectWave.emit(wave)"
          >
            <span>{{ wave }}</span
            ><app-icon [kind]="done().has(wave) ? 'check' : wave % 5 === 0 ? 'cup' : 'gem'" />
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
      padding: 10px;
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
    .wave-path app-icon {
      width: 18px;
      height: 18px;
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
  readonly selectWave = output<number>();
  protected readonly waves = Array.from({ length: TOTAL_WAVES }, (_, i) => i + 1);
  protected readonly done = computed(() => new Set(this.completed()));
  private readonly i = inject(LocaleService);
  protected t(key: GameMessageKey, values: Record<string, number> = {}) {
    return gameText(this.i.locale(), key, values);
  }
}
