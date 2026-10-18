import { Component, inject, input, output } from '@angular/core';
import { Icon } from '../../../shared/icon';
import { LocaleService } from '../../../core/locale';
import { gameText, GameMessageKey } from '../game-messages';
import { TOTAL_WAVES } from '../waves';
@Component({
  selector: 'app-wave-path',
  imports: [Icon],
  template: `<details>
    <summary>
      {{ t('chooseWave') }} <span>{{ t('savedWaves', { n: completed() }) }}</span>
    </summary>
    <ol class="wave-path" [attr.aria-label]="t('waveMenu')">
      @for (wave of waves; track wave) {
        <li>
          <button
            [disabled]="wave > unlocked()"
            [class.done]="wave <= completed()"
            [class.boss]="wave % 5 === 0"
            [attr.aria-label]="
              t(
                wave > unlocked()
                  ? 'lockedWave'
                  : wave <= completed()
                    ? 'completedWave'
                    : 'waveButton',
                { n: wave }
              ) + (wave % 5 === 0 ? ' · ' + t('bossWave') : '')
            "
            (click)="selectWave.emit(wave)"
          >
            <span>{{ wave }}</span
            ><app-icon
              [kind]="
                wave > unlocked()
                  ? 'lock'
                  : wave <= completed()
                    ? 'check'
                    : wave % 5 === 0
                      ? 'cup'
                      : 'gem'
              "
            />
          </button>
        </li>
      }
    </ol>
  </details>`,
  styles: `
    :host {
      display: block;
      background: #fffdf5;
      padding: 16px 28px;
    }
    summary {
      cursor: pointer;
      min-height: 44px;
      line-height: 1.5;
      padding: 10px 0;
      font-size: 18px;
    }
    summary span {
      font-size: 14px;
      color: #4c6079;
      margin-left: 16px;
    }
    .wave-path {
      display: grid;
      grid-template-columns: repeat(10, minmax(0, 1fr));
      gap: 12px;
      list-style: none;
      padding: 12px 0;
      margin: 0;
    }
    .wave-path button {
      width: 100%;
      min-height: 64px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 5px;
      padding: 10px;
      border: 1px solid #75857a;
      border-radius: 14px;
      color: #172555;
      background: #fff9e9;
      font-size: 20px;
    }
    .wave-path app-icon {
      width: 18px;
      height: 18px;
    }
    .wave-path .done {
      background: #dfefe3;
    }
    .wave-path .boss {
      border: 2px solid #87502c;
    }
    .wave-path button:disabled {
      background: #eeece4;
      color: #56615c;
      cursor: default;
    }
    @media (max-width: 700px) {
      :host {
        padding: 12px 16px;
      }
      .wave-path {
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: 8px;
      }
      summary span {
        display: block;
        margin: 4px 0 0;
      }
      .wave-path button {
        min-height: 60px;
      }
    }
  `,
})
export class WavePathComponent {
  readonly unlocked = input(1);
  readonly completed = input(0);
  readonly selectWave = output<number>();
  protected readonly waves = Array.from({ length: TOTAL_WAVES }, (_, i) => i + 1);
  private readonly i = inject(LocaleService);
  protected t(key: GameMessageKey, values: Record<string, number> = {}) {
    return gameText(this.i.locale(), key, values);
  }
}
