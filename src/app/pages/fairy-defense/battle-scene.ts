import { EggChip } from '../hatchery/egg-chip';
import { NgOptimizedImage } from '@angular/common';
import {
  afterRenderEffect,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { LocaleService } from '../../core/locale';
import { Icon } from '../../shared/icon';
import { ThreeStage, WorldLoader } from '../../shared/three/three-stage';
import { Battle, gemsFor } from './battle';
import { castleFrame, CastleFrame } from './castle-frame';
import { GemPouch } from './gem-pouch';
import { TOTAL_WAVES } from './waves';
import { gameText, GameMessageKey } from './game-messages';
@Component({
  selector: 'app-battle-scene',
  imports: [NgOptimizedImage, Icon, EggChip, GemPouch, ThreeStage],
  templateUrl: './battle-scene.html',
  styleUrls: ['./battle-scene.css', './battle-fx.css', './battle-scene-3d.css'],
  host: { '[class.fit]': 'fit()' },
})
export class BattleScene {
  readonly pauseRequested = output();
  readonly battle = input.required<Battle>();
  readonly paused = input(false);
  readonly started = input(false);
  readonly fit = input(false);
  readonly stageLabel = input('');
  /** How close the thinking timer is to running out: 0 (no hurry) to 1 (time is up). */
  readonly pressure = input(0);
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
  /** "3 / 20" for a narrow phone, where the full label would squeeze into a column. */
  protected readonly shortLabel = computed(
    () => this.stageLabel().replace(/^\D+/, '') || `${this.battle().wave.number} / ${TOTAL_WAVES}`,
  );
  protected readonly hearts = [1, 2, 3];
  protected readonly rays = Array.from({ length: 12 }, (_, index) => index);
  /** Gems the rescued creature drops: the same rule the battle adds to the pouch. */
  protected readonly dropped = computed(() => gemsFor(this.battle().attempts));
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly flight = viewChild<ElementRef<HTMLElement>>('flight');
  protected readonly fireflies = [0, 1, 2, 3, 4, 5, 6];
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
  constructor() {
    // The dropped gem flies from the creature to wherever the pouch sits on this screen.
    afterRenderEffect(() => {
      const gem = this.flight()?.nativeElement;
      const pouch = this.host.nativeElement.querySelector('app-gem-pouch .gem-art');
      if (!gem || !pouch) return;
      const from = (gem.querySelector('.gem-art') ?? gem).getBoundingClientRect();
      const to = pouch.getBoundingClientRect();
      gem.style.setProperty('--to-x', `${to.left + to.width / 2 - (from.left + from.width / 2)}px`);
      gem.style.setProperty('--to-y', `${to.top + to.height / 2 - (from.top + from.height / 2)}px`);
    });
  }
  /** The 3D battlefield loads on demand, so Three.js stays out of the first download. */
  protected readonly loadWorld: WorldLoader<CastleFrame> = () =>
    import('./castle-world').then((module) => module.CastleWorld);
  protected readonly frame = computed(() =>
    castleFrame(this.battle(), {
      started: this.started(),
      paused: this.paused(),
      badge: this.encounter().question ? '?' : this.i.format(this.encounter().energy),
      pressure: this.pressure(),
    }),
  );
  protected t(key: GameMessageKey, values: Record<string, number> = {}) {
    return gameText(this.i.locale(), key, values);
  }
}
