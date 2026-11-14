import { NgOptimizedImage, ViewportScroller } from '@angular/common';
import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Chapter, Level, levelStars, WORLD_CATALOG, World } from '../../core/catalog';
import { LocaleService } from '../../core/locale';
import { ProgressService } from '../../core/progress';
import { Emblem } from '../../shared/emblem';
import { Icon } from '../../shared/icon';
import { StarRating } from '../../shared/star-rating';
import { CampaignStore } from '../fairy-defense/campaign';
import { TOTAL_WAVES } from '../fairy-defense/waves';
import { comparisonStage } from '../crocodile/comparison';
import { raceStage } from '../unicorn-race/race-questions';
import { CrocodileScores } from '../crocodile/crocodile-scores';
import { lockStage } from '../treasure-lock/lock-puzzles';
import { LockScores } from '../treasure-lock/lock-scores';
import { levels as wallLevels, WallLevel } from '../number-wall/number-wall';
import { NumberWallStore } from '../number-wall/number-wall-store';
import { MessageKey } from '../../core/messages';
/** One section per game, in catalog order, with the world it belongs to. */
export interface GameEntry {
  readonly world: World;
  readonly chapter: Chapter;
}
/**
 * The games hub: every game and every level on one page, each one tap from playing.
 * Sections carry the chapter id and level cards carry the level id, so older world and
 * chapter links, completion and the games themselves can land on the right spot.
 */
@Component({
  selector: 'app-games',
  imports: [RouterLink, Icon, NgOptimizedImage, StarRating, Emblem],
  templateUrl: './games.html',
  styleUrl: './games.css',
})
export class Games {
  protected readonly i = inject(LocaleService);
  protected readonly p = inject(ProgressService);
  private readonly catalog = inject(WORLD_CATALOG);
  protected readonly campaign = inject(CampaignStore);
  protected readonly scores = inject(CrocodileScores);
  private readonly lockScores = inject(LockScores);
  protected readonly walls = inject(NumberWallStore);
  protected readonly totalWaves = TOTAL_WAVES;
  protected readonly wallLevels = wallLevels;
  protected readonly games = computed<readonly GameEntry[]>(() =>
    this.catalog.flatMap((world) => world.chapters.map((chapter) => ({ world, chapter }))),
  );
  protected readonly nextId = computed(() => this.p.next()?.id);
  /** The game section filling most of the screen, highlighted in the jump bar. */
  protected readonly inView = signal('');

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);
    // Anchor jumps land below the sticky game chips instead of under them.
    const scroller = inject(ViewportScroller);
    scroller.setOffset(() => [
      0,
      (host.querySelector<HTMLElement>('.game-jump')?.offsetHeight ?? 0) + 12,
    ]);
    destroyRef.onDestroy(() => scroller.setOffset([0, 0]));
    afterNextRender(() => {
      if (typeof IntersectionObserver === 'undefined') return;
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            this.inView.set(entry.target.id);
            // Keep the highlighted chip visible in the sideways-scrolling row.
            const row = host.querySelector<HTMLElement>('.game-jump ul');
            const chip = row?.querySelector<HTMLElement>(`a[href$="#${entry.target.id}"]`);
            if (row && chip) row.scrollTo({ left: chip.offsetLeft - row.offsetLeft - 16 });
          }
        },
        // A section counts once it crosses the band a third of the way down the screen.
        { rootMargin: '-33% 0px -66% 0px' },
      );
      host.querySelectorAll('section.game').forEach((section) => observer.observe(section));
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }
  protected stars(level: Level) {
    return levelStars(level, this.p.progress());
  }
  protected mastered(level: Level) {
    return this.p.progress().mastered.includes(level.id);
  }
  protected completed(level: Level) {
    return !this.mastered(level) && !!this.p.progress().completed?.includes(level.id);
  }
  /** The worked example a level shows on its card, when the game defines one. */
  protected example(level: Level) {
    return (
      level.practice?.example ??
      comparisonStage(level.id)?.example ??
      raceStage(level.id)?.example ??
      lockStage(level.id)?.example ??
      ''
    );
  }
  protected best(level: Level) {
    return this.scores.best()[level.id] ?? this.lockScores.best()[level.id] ?? 0;
  }
  protected wallTitle(level: WallLevel): MessageKey {
    return `wallLevel${level}` as MessageKey;
  }
  protected wallHelp(level: WallLevel): MessageKey {
    return `wallLevel${level}Help` as MessageKey;
  }
}
