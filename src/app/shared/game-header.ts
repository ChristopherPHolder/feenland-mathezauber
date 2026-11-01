import { Component, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LocaleService } from '../core/locale';
import { Icon } from './icon';
/**
 * The bar every game shows above its menu: the way back to the games hub (landing on this
 * game's section), the game's name, and an optional sound toggle.
 */
@Component({
  selector: 'app-game-header',
  imports: [RouterLink, Icon],
  template: `<a class="games-link" routerLink="/games" [fragment]="anchor()">
      <app-icon kind="back" /><span>{{ i.t('allGames') }}</span>
    </a>
    <div class="titles">
      <h1 [id]="titleId()">{{ title() }}</h1>
      @if (detail()) {
        <p>{{ detail() }}</p>
      }
    </div>
    <div class="actions">
      <ng-content />
      @if (sound() !== undefined) {
        <button
          class="sound-button"
          type="button"
          [attr.aria-pressed]="sound()"
          [attr.aria-label]="i.t(sound() ? 'soundOn' : 'soundOff')"
          (click)="soundToggle.emit()"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 9v6h4l5 4V5L8 9z" />
            @if (sound()) {
              <path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" />
            } @else {
              <path d="m16 9 5 6m0-6-5 6" />
            }
          </svg>
        </button>
      }
    </div>`,
  styles: `
    :host {
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      gap: 12px;
    }
    .games-link,
    .sound-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      min-width: 46px;
      min-height: 46px;
      padding: 8px 14px;
      border: 0;
      border-radius: var(--radius-button);
      background: #ffffffd9;
      color: var(--ink);
      text-decoration: none;
      font-weight: 600;
      font-size: 15px;
      box-shadow: 0 4px 15px #214d5a0a;
    }
    .games-link app-icon {
      width: 22px;
      height: 22px;
    }
    .titles {
      min-width: 0;
      text-align: center;
    }
    h1 {
      font-size: clamp(22px, 3vw, 30px);
      line-height: 1.15;
      margin: 0;
    }
    p {
      margin: 4px 0 0;
      color: var(--muted);
      font-size: 15px;
      line-height: 1.4;
    }
    .actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .sound-button {
      padding: 8px;
      border-radius: 50%;
    }
    .sound-button svg {
      width: 26px;
      height: 26px;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .sound-button[aria-pressed='false'] {
      color: var(--muted);
    }
    @media (max-width: 540px) {
      .games-link span {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
      }
      .games-link {
        padding: 8px;
        border-radius: 50%;
      }
      h1 {
        font-size: 20px;
      }
      p {
        font-size: 13px;
      }
    }
  `,
})
export class GameHeader {
  readonly title = input.required<string>();
  readonly detail = input('');
  /** The id the surrounding game section labels itself by. */
  readonly titleId = input('game-title');
  /** The games-hub section (chapter or level id) the back link lands on. */
  readonly anchor = input<string | undefined>(undefined);
  /** Current sound state; leave undefined for games without a sound toggle here. */
  readonly sound = input<boolean | undefined>(undefined);
  readonly soundToggle = output();
  protected readonly i = inject(LocaleService);
}
