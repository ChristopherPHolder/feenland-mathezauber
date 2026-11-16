import {
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
  afterNextRender,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { LocaleService } from '../../core/locale';
import { Icon } from '@feenland/ui';
import { DrumChart } from './drum-chart';
import { patternName } from './drum-intro';
import { drumText, DrumMessageKey } from './drum-messages';
import { PatternPicture } from './drum-scores';

export interface DrumResult {
  readonly stars: 1 | 2 | 3;
  readonly points: number;
  readonly best: number;
  readonly newBest: boolean;
  readonly bestStreak: number;
  readonly onBeat: number;
  readonly timed: boolean;
  readonly firstTry: number;
  readonly questions: number;
  readonly picture: PatternPicture;
  readonly saveFailed: boolean;
}

/**
 * The finish card: the stars, the points, tiles for the best streak, on-beat hits and first
 * tries, and the hundred chart the round lit, saved to the pattern gallery.
 */
@Component({
  selector: 'app-drum-outcome',
  imports: [RouterLink, Icon, DrumChart],
  templateUrl: './drum-outcome.html',
  styleUrl: './drum-outcome.css',
  host: { tabindex: '-1', '[attr.aria-label]': "t('done')" },
})
export class DrumOutcome {
  readonly result = input.required<DrumResult>();
  readonly rows = input(10);
  readonly next = input<readonly string[] | null>(null);
  readonly again = output();
  readonly celebrate = output();
  protected readonly i = inject(LocaleService);
  protected readonly slots = [1, 2, 3];
  protected readonly pattern = computed(() =>
    patternName(this.i.locale(), this.result().picture, (n) => this.i.format(n)),
  );

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    afterNextRender(() => host.focus({ preventScroll: true }));
  }

  protected t(key: DrumMessageKey, values: Record<string, string | number> = {}) {
    return drumText(this.i.locale(), key, values);
  }
}
