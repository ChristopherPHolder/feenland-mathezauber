import { NgOptimizedImage } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { LocaleService } from '../../core/locale';
import { Icon } from '../../shared/icon';
import { Battle, WAVE_ONE } from './battle';
import { gameText, GameMessageKey } from './game-messages';
@Component({
  selector: 'app-battle-scene',
  imports: [NgOptimizedImage, Icon],
  templateUrl: './battle-scene.html',
  styleUrl: './battle-scene.css',
})
export class BattleScene {
  readonly battle = input.required<Battle>();
  readonly paused = input(false);
  readonly started = input(false);
  protected readonly i = inject(LocaleService);
  protected readonly hearts = [1, 2, 3];
  protected readonly heartsAndSpells = [1, 2, 3, 4, 5];
  protected readonly encounter = computed(() => WAVE_ONE[this.battle().encounter]);
  protected t(key: GameMessageKey, values: Record<string, number> = {}) {
    return gameText(this.i.locale(), key, values);
  }
}
