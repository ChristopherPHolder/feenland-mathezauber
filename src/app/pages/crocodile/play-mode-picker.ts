import { Component, inject, input, output } from '@angular/core';
import { LocaleService } from '../../core/locale';
import { CrocodileArt } from './crocodile-art';
import { crocodileText, CrocodileMessageKey } from './crocodile-messages';
import type { HatId, PlayMode } from './crocodile-score';
import { Heron } from './heron';
/** Calm pond or heron race: the second one turns time into a visible rival instead of a clock. */
@Component({
  selector: 'app-play-mode-picker',
  imports: [CrocodileArt, Heron],
  template: `<fieldset class="modes">
    <legend>{{ t('modeTitle') }}</legend>
    <button
      type="button"
      class="mode"
      [class.active]="mode() === 'calm'"
      [attr.aria-pressed]="mode() === 'calm'"
      (click)="modeChange.emit('calm')"
    >
      <span class="mode-art"><app-crocodile kind="front" [hat]="hat()" /></span>
      <strong>{{ t('calm') }}</strong>
      <small>{{ t('calmHelp') }}</small>
      @if (bestCalm() > 0) {
        <span class="mode-best">{{ t('bestScore', { n: i.format(bestCalm()) }) }}</span>
      }
    </button>
    <button
      type="button"
      class="mode race-mode"
      [class.active]="mode() === 'race'"
      [attr.aria-pressed]="mode() === 'race'"
      (click)="modeChange.emit('race')"
    >
      <span class="mode-art"><app-heron [flapping]="mode() === 'race'" /></span>
      <strong>{{ t('race') }}</strong>
      <small>{{ t('raceHelp') }}</small>
      @if (bestRace() > 0) {
        <span class="mode-best">{{ t('bestScore', { n: i.format(bestRace()) }) }}</span>
      }
    </button>
  </fieldset>`,
  styles: `
    .modes {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin: 20px auto 0;
      padding: 0;
      border: 0;
      max-width: 620px;
    }
    legend {
      float: left;
      width: 100%;
      margin-bottom: 12px;
      font-size: 19px;
      font-weight: 600;
    }
    .mode {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      min-height: 44px;
      padding: 14px 12px 16px;
      border: 3px solid #cfe1d4;
      border-radius: 20px;
      background: #fff;
      color: var(--ink);
      text-align: center;
      transition:
        border-color 0.15s,
        transform 0.15s;
    }
    .mode:hover {
      transform: translateY(-2px);
    }
    .mode.active {
      border-color: #3a8f55;
      background: #eaf7ec;
    }
    .race-mode.active {
      border-color: #3f6fa8;
      background: #e6f0fb;
    }
    .mode-art {
      display: block;
      width: 96px;
    }
    strong {
      font-size: 18px;
    }
    small {
      font-size: 14px;
      line-height: 1.4;
      color: var(--muted);
    }
    .mode-best {
      margin-top: 4px;
      font-size: 14px;
      font-weight: 600;
      color: #a3124a;
    }
    @media (max-width: 640px) {
      .modes {
        grid-template-columns: 1fr;
      }
      .mode {
        flex-direction: row;
        flex-wrap: wrap;
        text-align: left;
        gap: 2px 14px;
      }
      .mode-art {
        width: 72px;
        flex: none;
      }
      strong,
      small,
      .mode-best {
        flex: 1 1 calc(100% - 90px);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .mode {
        transition: none;
      }
    }
  `,
})
export class PlayModePicker {
  readonly mode = input.required<PlayMode>();
  readonly hat = input<HatId | 'none'>('none');
  readonly bestCalm = input(0);
  readonly bestRace = input(0);
  readonly modeChange = output<PlayMode>();
  protected readonly i = inject(LocaleService);
  protected t(key: CrocodileMessageKey, values: Record<string, string | number> = {}) {
    return crocodileText(this.i.locale(), key, values);
  }
}
