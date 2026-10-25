import { NgOptimizedImage } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Chapter, Level, levelStars, WORLD_CATALOG, World } from '../../core/catalog';
import { LocaleService } from '../../core/locale';
import { ProgressService } from '../../core/progress';
import { Icon } from '../../shared/icon';
import { StarRating } from '../../shared/star-rating';
import { CampaignStore } from '../fairy-defense/campaign';
import { TOTAL_WAVES } from '../fairy-defense/waves';
import { comparisonStage } from '../crocodile/comparison';
import { CrocodileScores } from '../crocodile/crocodile-scores';
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
  imports: [RouterLink, Icon, NgOptimizedImage, StarRating],
  templateUrl: './games.html',
  styleUrl: './games.css',
})
export class Games {
  protected readonly i = inject(LocaleService);
  protected readonly p = inject(ProgressService);
  private readonly catalog = inject(WORLD_CATALOG);
  protected readonly campaign = inject(CampaignStore);
  protected readonly scores = inject(CrocodileScores);
  protected readonly walls = inject(NumberWallStore);
  protected readonly totalWaves = TOTAL_WAVES;
  protected readonly wallLevels = wallLevels;
  protected readonly games = computed<readonly GameEntry[]>(() =>
    this.catalog.flatMap((world) => world.chapters.map((chapter) => ({ world, chapter }))),
  );
  protected readonly nextId = computed(() => this.p.next()?.id);
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
    return level.practice?.example ?? comparisonStage(level.id)?.example ?? '';
  }
  protected best(level: Level) {
    return this.scores.best()[level.id] ?? 0;
  }
  protected wallTitle(level: WallLevel): MessageKey {
    return `wallLevel${level}` as MessageKey;
  }
  protected wallHelp(level: WallLevel): MessageKey {
    return `wallLevel${level}Help` as MessageKey;
  }
}
