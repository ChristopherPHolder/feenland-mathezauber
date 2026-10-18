import { NgOptimizedImage } from '@angular/common';
import { Component, computed, inject, input, output } from '@angular/core';
import { LocaleService } from '../../core/locale';
import { Icon } from '../../shared/icon';
import { Battle } from './battle';
import { gameText, GameMessageKey } from './game-messages';
@Component({
  selector: 'app-battle-scene',
  imports: [NgOptimizedImage, Icon],
  templateUrl: './battle-scene.html',
  styleUrl: './battle-scene.css',
  host: { '[class.fit]': 'fit()' },
})
export class BattleScene {
  readonly pauseRequested = output();
  readonly battle = input.required<Battle>();
  readonly paused = input(false);
  readonly started = input(false);
  readonly fit = input(false);
  readonly stageLabel = input('');
  protected readonly i = inject(LocaleService);
  protected readonly sprite = computed(() => {
    switch (this.encounter().appearance) {
      case 'monster-red':
        return { width: 1278, height: 1230 };
      case 'monster-blue':
        return { width: 1146, height: 1372 };
      case 'monster-purple':
        return { width: 1293, height: 1216 };
      default:
        return { width: 1312, height: 1199 };
    }
  });
  protected readonly hearts = [1, 2, 3];
  protected readonly heartsAndSpells = Array.from({ length: 10 }, (_, index) => index);
  protected readonly encounter = computed(
    () => this.battle().wave.encounters[this.battle().encounter],
  );
  protected readonly shieldBreaking = computed(
    () =>
      this.battle().wave.boss &&
      this.battle().phase === 'transforming' &&
      this.battle().encounter < this.battle().wave.encounters.length - 1,
  );
  protected readonly shieldLayers = computed(() =>
    Array.from({ length: this.battle().wave.encounters.length }, (_, index) => index),
  );
  protected t(key: GameMessageKey, values: Record<string, number> = {}) {
    return gameText(this.i.locale(), key, values);
  }
}
