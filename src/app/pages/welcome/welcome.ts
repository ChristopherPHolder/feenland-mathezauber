import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgOptimizedImage } from '@angular/common';
import { Chapter, entryLevel, levelStars, WORLD_CATALOG } from '../../core/catalog';
import { LocaleService } from '../../core/locale';
import { MessageKey } from '../../core/messages';
import { ProgressService } from '../../core/progress';
import { DragonFace, Emblem, Icon } from '@feenland/ui';
import { levels as wallLevels } from '../number-wall/number-wall';
import { NumberWallStore } from '../number-wall/number-wall-store';
import { DragonPortraits } from '../hatchery/dragon-portraits';
import { STAGES } from '../hatchery/dragons';
import { EggIcon } from '../hatchery/egg-icon';
import { HatcheryStore } from '../hatchery/hatchery-store';
import { hatcheryText } from '../hatchery/hatchery-messages';
const playLabels: Readonly<Record<string, MessageKey>> = {
  'fairy-defense': 'fairyPlay',
  crocodile: 'crocodilePlay',
  'number-wall': 'numberWallPlay',
  'unicorn-race': 'racePlay',
  'treasure-lock': 'lockPlay',
  potions: 'potionPlay',
  bakery: 'bakeryPlay',
  drums: 'drumsPlay',
  'star-catcher': 'starCatcherPlay',
  fireworks: 'fireworksPlay',
  gondola: 'gondolaPlay',
  scales: 'scalesPlay',
};
@Component({
  selector: 'app-welcome',
  imports: [RouterLink, NgOptimizedImage, Icon, Emblem, EggIcon, DragonFace],
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
            ><span class="play" aria-hidden="true"><ui-icon kind="play" /></span
            ><span
              >{{ i.t(p.progress().mastered.length ? 'continue' : 'start')
              }}<small>{{ i.t(p.nextWorld()?.title ?? 'missing') }}</small></span
            ><ui-icon kind="arrow"
          /></a>
        } @else {
          <div class="caught">
            <strong>{{ i.t('caught') }}</strong>
            <p>{{ i.t('caughtText') }}</p>
          </div>
        }
        <a class="button secondary" routerLink="/games"
          ><ui-icon kind="grid" />{{ i.t('allGames') }}</a
        >
      </div>
    </div>
    <a class="hatchery-card" routerLink="/hatchery" [class.is-ready]="hatchery.ready()">
      <span class="hatchery-art" aria-hidden="true">
        @if (homeDragon(); as dragon) {
          @if (portraits.pictures()[dragon.id]; as picture) {
            <img [src]="picture" width="256" height="256" alt="" />
          } @else if (hatchery.growing()) {
            <ui-dragon-face
              class="hatchery-egg"
              [colors]="dragon"
              [form]="hatchery.stage(dragon)"
            />
          }
        }
        @if (!hatchery.growing()) {
          <app-egg-icon class="hatchery-egg" [dragon]="hatchery.egg()" [warmth]="eggWarmth()" />
        }
      </span>
      <span class="hatchery-copy">
        @if (!hatchery.growing()) {
          <strong>{{ h('homeTitle') }}</strong>
          <span>{{
            hatchery.ready()
              ? h('homeReady')
              : h('warmth', {
                  n: i.format(hatchery.progress()),
                  total: i.format(hatchery.needed()),
                })
          }}</span>
          <small>{{
            hatchery.favorite()
              ? h('homeFavorite', { name: hatchery.name(hatchery.favorite()!) })
              : h('homeNoDragon')
          }}</small>
        } @else if (hatchery.raising(); as dragon) {
          <strong>{{ h('growTitle', { name: hatchery.name(dragon) }) }}</strong>
          <span>{{
            hatchery.ready()
              ? h('growReadyTitle', { name: hatchery.name(dragon) })
              : h('growth', {
                  n: i.format(hatchery.progress()),
                  total: i.format(hatchery.needed()),
                })
          }}</span>
          <small>{{ h(stages[hatchery.stage(dragon)]) }}</small>
        } @else {
          <strong>{{ h('allGrand') }}</strong>
          <small>{{ h('allGrandHelp') }}</small>
        }
      </span>
      <span class="hatchery-go">{{ h('homeAction') }}<ui-icon kind="arrow" /></span>
    </a>
    <section class="games" aria-labelledby="games-title">
      <h2 id="games-title">{{ i.t('homeGames') }}</h2>
      <ul class="game-list">
        @for (game of games(); track game.chapter.id) {
          <li
            class="game-card"
            [attr.data-game]="game.chapter.id"
            [style.--world-color]="game.color"
            [style.--world-ground]="game.ground"
          >
            <span class="game-emblem"
              ><ui-emblem [id]="game.chapter.id" [fallback]="game.chapter.emblem"
            /></span>
            <div class="game-copy">
              <h3 [id]="'game-' + game.chapter.id">{{ i.t(game.chapter.title) }}</h3>
              <p>{{ i.t(game.chapter.description) }}</p>
              <p class="game-meta">
                <ui-icon kind="star" />{{
                  i.t('chapterStars', { n: game.stars, total: game.total })
                }}
              </p>
            </div>
            <div class="game-actions">
              <a
                class="button primary game-link"
                [routerLink]="['/adventure', game.entry]"
                [attr.aria-describedby]="'game-' + game.chapter.id"
                >{{ i.t(game.play) }}<ui-icon kind="arrow"
              /></a>
              <a class="levels-link" routerLink="/games" [fragment]="game.chapter.id"
                >{{ i.t('allLevelsCount', { n: game.levels }) }}<ui-icon kind="arrow"
              /></a>
            </div>
          </li>
        }
      </ul>
    </section>
    <section class="journey" aria-labelledby="journey-title">
      <h2 id="journey-title">{{ i.t('journey') }}</h2>
      <dl>
        <div>
          <dt><ui-icon kind="star" />{{ i.t('mastered') }}</dt>
          <dd>{{ i.format(p.progress().mastered.length) }}</dd>
        </div>
        <div>
          <dt><ui-icon kind="cup" />{{ i.t('chapters') }}</dt>
          <dd>{{ i.format(p.progress().chapters.length) }}</dd>
        </div>
        <div>
          <dt><ui-icon kind="gem" />{{ i.t('explored') }}</dt>
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
  protected readonly hatchery = inject(HatcheryStore);
  protected readonly portraits = inject(DragonPortraits);
  protected readonly eggWarmth = computed(() => this.hatchery.progress() / this.hatchery.needed());
  protected readonly stages = STAGES;
  /** The favourite waits on Home; once the book is complete, the dragon growing up does. */
  protected readonly homeDragon = computed(() =>
    this.hatchery.growing()
      ? (this.hatchery.raising() ?? this.hatchery.favorite())
      : this.hatchery.favorite(),
  );
  constructor() {
    if (this.hatchery.favorite()) this.portraits.load();
  }
  protected h(
    key: Parameters<typeof hatcheryText>[1],
    values: Record<string, string | number> = {},
  ) {
    return hatcheryText(this.i.locale(), key, values);
  }
  private readonly catalog = inject(WORLD_CATALOG);
  private readonly walls = inject(NumberWallStore);
  /** One card per game, straight from the catalog: adding a chapter adds a card. */
  protected readonly games = computed(() =>
    this.catalog.flatMap((world) =>
      world.chapters.map((chapter: Chapter) => {
        const { levels, stars } = this.tally(chapter);
        return {
          chapter,
          color: world.color,
          ground: world.ground,
          entry: entryLevel(chapter, this.p.progress())?.id ?? chapter.levels[0]?.id,
          play: playLabels[chapter.levels[0]?.format ?? ''] ?? 'play',
          levels,
          total: levels * 3,
          stars,
        };
      }),
    ),
  );
  /**
   * Levels and earned stars of a game, as the games hub shows them. Magic walls is one
   * catalog level with its own levels inside, each rated by the wall game's store.
   */
  private tally(chapter: Chapter) {
    if (chapter.levels[0]?.format === 'number-wall')
      return {
        levels: wallLevels.length,
        stars: wallLevels.reduce((sum, level) => sum + this.walls.rating(level), 0),
      };
    return {
      levels: chapter.levels.length,
      stars: chapter.levels.reduce((sum, level) => sum + levelStars(level, this.p.progress()), 0),
    };
  }
}
