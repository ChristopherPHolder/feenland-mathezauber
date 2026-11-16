import { Component, computed, inject, input } from '@angular/core';
import { LocaleService } from '../../core/locale';
import { Icon } from '@feenland/ui';
import { Flick } from './firework-flick';
import { fireworkText, FireworkMessageKey } from './firework-messages';
import { BookShape, shapePath } from './firework-shapes';

/** When the first star pops in, and the gap to the next, in seconds. */
const STAR_START = 0.3;
const STAR_STEP = 0.3;

/**
 * The finish card of a show: Flick waving a sparkler, the stars popping in one by one, then tiles
 * for the fireworks launched, the first looks, the best streak and the shape the level adds to the
 * firework book. It only shows; the game decides.
 */
@Component({
  selector: 'app-firework-reward',
  imports: [Icon, Flick],
  styleUrl: './firework-reward.css',
  template: `
    <div class="hero">
      <span class="rays" aria-hidden="true"></span>
      <app-flick class="flick" pose="cheer" />
      <div class="stars" role="img" [attr.aria-label]="t('starsLabel', { n: stars() })">
        @for (slot of slots; track slot) {
          <ui-icon
            kind="star"
            class="star"
            [class.won]="slot <= stars()"
            [style.--at]="starAt(slot) + 's'"
          />
        }
      </div>
    </div>
    <ul class="tiles">
      <li [style.--at]="tileAt(0)">
        <strong>{{ i.format(launched()) }}</strong
        ><span>{{ t('tileLaunched') }}</span>
      </li>
      <li [style.--at]="tileAt(1)">
        <strong>{{ i.format(firstLooks()) }}/{{ i.format(regular()) }}</strong
        ><span>{{ t('tileFirst') }}</span>
      </li>
      <li [style.--at]="tileAt(2)">
        <strong>{{ i.format(bestStreak()) }}</strong
        ><span>{{ t('tileStreak') }}</span>
      </li>
      <li class="shape-tile" [class.is-new]="newShape()" [style.--at]="tileAt(3)">
        <svg viewBox="0 0 100 100" aria-hidden="true"><path [attr.d]="path()" /></svg>
        <span>{{ t(newShape() ? 'tileShape' : 'tileShapeAgain') }}: {{ t(shape()) }}</span>
      </li>
    </ul>
  `,
})
export class FireworkReward {
  protected readonly i = inject(LocaleService);
  readonly stars = input.required<number>();
  readonly launched = input.required<number>();
  readonly firstLooks = input.required<number>();
  readonly regular = input.required<number>();
  readonly bestStreak = input.required<number>();
  readonly shape = input.required<BookShape>();
  readonly newShape = input(false);

  protected readonly slots = [1, 2, 3];
  protected readonly path = computed(() => shapePath(this.shape()));
  protected t(key: FireworkMessageKey, values: Record<string, string | number> = {}) {
    return fireworkText(this.i.locale(), key, values);
  }
  protected starAt(slot: number) {
    return STAR_START + (slot - 1) * STAR_STEP;
  }
  protected tileAt(index: number) {
    return `${STAR_START + 3 * STAR_STEP + index * 0.15}s`;
  }
}
