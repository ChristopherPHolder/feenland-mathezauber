import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgOptimizedImage } from '@angular/common';
import { Chapter, entryLevel, levelStars, WORLD_CATALOG } from '../../core/catalog';
import { LocaleService } from '../../core/locale';
import { MessageKey } from '../../core/messages';
import { ProgressService } from '../../core/progress';
import { Icon } from '../../shared/icon';
const playLabels: Readonly<Record<string, MessageKey>> = {
  'fairy-defense': 'fairyPlay',
  crocodile: 'crocodilePlay',
  'number-wall': 'numberWallPlay',
};
@Component({
  selector: 'app-welcome',
  imports: [RouterLink, NgOptimizedImage, Icon],
  template: ` <section class="home" aria-labelledby="welcome-title">
    <div class="hero">
      <div class="hero-copy">
        <p class="greeting">{{ i.t('welcome') }}</p>
        <h1 id="welcome-title">Feenland<br /><span>Mathezauber</span></h1>
        <p class="intro">{{ i.t('intro') }}</p>
      </div>
      <div class="illustration">
        <img ngSrc="/images/feenland.webp" width="1536" height="1024" priority alt="" />
      </div>
      <div class="adventure-actions">
        @if (p.next(); as next) {
          <a class="button primary" [routerLink]="['/adventure', next.id]"
            ><span class="play" aria-hidden="true"><app-icon kind="play" /></span
            ><span
              >{{ i.t(p.progress().mastered.length ? 'continue' : 'start')
              }}<small>{{ i.t(p.nextWorld()?.title ?? 'missing') }}</small></span
            ><app-icon kind="arrow"
          /></a>
        } @else {
          <div class="caught">
            <strong>{{ i.t('caught') }}</strong>
            <p>{{ i.t('caughtText') }}</p>
          </div>
        }
        <a class="button secondary" routerLink="/games"
          ><app-icon kind="grid" />{{ i.t('allGames') }}</a
        >
      </div>
    </div>
    <section class="games" aria-labelledby="games-title">
      <div class="section-head">
        <h2 id="games-title">{{ i.t('homeGames') }}</h2>
        <a class="all-link" routerLink="/games">{{ i.t('allGames') }}<app-icon kind="arrow" /></a>
      </div>
      <ul class="game-list">
        @for (game of games(); track game.chapter.id) {
          <li
            class="game-card"
            [attr.data-game]="game.chapter.id"
            [style.--world-color]="game.color"
            [style.--world-ground]="game.ground"
          >
            <span class="game-emblem" aria-hidden="true">{{ game.chapter.emblem }}</span>
            <div class="game-copy">
              <h3 [id]="'game-' + game.chapter.id">{{ i.t(game.chapter.title) }}</h3>
              <p>{{ i.t(game.chapter.description) }}</p>
              <p class="game-meta">
                <app-icon kind="star" />{{
                  i.t('chapterStars', { n: game.stars, total: game.total })
                }}
              </p>
            </div>
            <div class="game-actions">
              <a
                class="button primary game-link"
                [routerLink]="['/adventure', game.entry]"
                [attr.aria-describedby]="'game-' + game.chapter.id"
                >{{ i.t(game.play) }}<app-icon kind="arrow"
              /></a>
              <a class="levels-link" routerLink="/games" [fragment]="game.chapter.id"
                >{{ i.t('allLevels') }} · {{ i.t('levelsLabel', { n: game.levels }) }}</a
              >
            </div>
          </li>
        }
      </ul>
    </section>
    <section class="journey" aria-labelledby="journey-title">
      <h2 id="journey-title">{{ i.t('journey') }}</h2>
      <dl>
        <div>
          <dt><app-icon kind="star" />{{ i.t('mastered') }}</dt>
          <dd>{{ i.format(p.progress().mastered.length) }}</dd>
        </div>
        <div>
          <dt><app-icon kind="cup" />{{ i.t('chapters') }}</dt>
          <dd>{{ i.format(p.progress().chapters.length) }}</dd>
        </div>
        <div>
          <dt><app-icon kind="gem" />{{ i.t('explored') }}</dt>
          <dd>{{ i.format(p.progress().explored.length) }}</dd>
        </div>
      </dl>
    </section>
    <p class="invitation">{{ i.t('invitation') }}</p>
  </section>`,
  styleUrl: './welcome.css',
})
export class Welcome {
  protected readonly i = inject(LocaleService);
  protected readonly p = inject(ProgressService);
  private readonly catalog = inject(WORLD_CATALOG);
  /** One card per game, straight from the catalog: adding a chapter adds a card. */
  protected readonly games = computed(() =>
    this.catalog.flatMap((world) =>
      world.chapters.map((chapter: Chapter) => ({
        chapter,
        color: world.color,
        ground: world.ground,
        entry: entryLevel(chapter, this.p.progress())?.id ?? chapter.levels[0]?.id,
        play: playLabels[chapter.levels[0]?.format ?? ''] ?? 'play',
        levels: chapter.levels.length,
        total: chapter.levels.length * 3,
        stars: chapter.levels.reduce((sum, level) => sum + levelStars(level, this.p.progress()), 0),
      })),
    ),
  );
}
