import { Component, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GameBar, Icon, SoundToggle } from '@feenland/ui';
import { LocaleService } from '../core/locale';
import { EggChip } from '../pages/hatchery/egg-chip';

/**
 * The bar every game shows above its menu: the way back to the games hub (landing on this
 * game's section), the game's name, the dragon egg and an optional sound toggle. It wires the
 * design system's GameBar to the router, the locale and the hatchery.
 */
@Component({
  selector: 'app-game-header',
  imports: [RouterLink, GameBar, Icon, SoundToggle, EggChip],
  host: { style: 'display: block' },
  template: `<ui-game-bar [title]="title()" [detail]="detail()" [titleId]="titleId()">
    <a uiGameBarBack class="ui-pill" routerLink="/games" [fragment]="anchor()">
      <ui-icon kind="back" /><span class="ui-pill-label">{{ i.t('allGames') }}</span>
    </a>
    <ng-content />
    <app-egg-chip />
    @if (sound() !== undefined) {
      <ui-sound-toggle
        [on]="!!sound()"
        [onLabel]="i.t('soundOn')"
        [offLabel]="i.t('soundOff')"
        (toggle)="soundToggle.emit()"
      />
    }
  </ui-game-bar>`,
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
