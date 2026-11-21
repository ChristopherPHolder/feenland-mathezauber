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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Chapter, Level, levelStars, WORLD_CATALOG, World } from '../../core/catalog';
import { LocaleService } from '../../core/locale';
import { ProgressService } from '../../core/progress';
import { localQuestion } from '../../core/practice';
import { Emblem, Icon, StarRating } from '@feenland/ui';
import { CampaignStore } from '../fairy-defense/campaign';
import { TOTAL_WAVES } from '../fairy-defense/waves';
import { comparisonStage, localSide } from '../crocodile/comparison';
import { raceStage, raceSumText } from '../unicorn-race/race-questions';
import { CrocodileScores } from '../crocodile/crocodile-scores';
import { lockStage } from '../treasure-lock/lock-puzzles';
import { LockScores } from '../treasure-lock/lock-scores';
import { localOps, potionStage } from '../potions/potion-puzzles';
import { PotionScores } from '../potions/potion-scores';
import { bakeryStage } from '../bakery/bakery-levels';
import { BakeryScores } from '../bakery/bakery-scores';
import { drumStage } from '../drums/drum-patterns';
import { DrumScores } from '../drums/drum-scores';
import { starStage } from '../star-catcher/star-levels';
import { StarScores } from '../star-catcher/star-scores';
import { fireworkLevel } from '../fireworks/firework-levels';
import { FireworkScores } from '../fireworks/firework-scores';
import { gondolaStage } from '../gondola/gondola-levels';
import { GondolaScores } from '../gondola/gondola-scores';
import { scalesStage } from '../scales/scales-levels';
import { ScalesScores } from '../scales/scales-scores';
import { marketStage } from '../market/market-levels';
import { MarketScores } from '../market/market-scores';
import {
  levelPosition,
  levels as wallLevels,
  rulesFor,
  WallLevel,
} from '../number-wall/number-wall';
import { NumberWallStore } from '../number-wall/number-wall-store';
import { MessageKey } from '../../core/messages';
/** One level as a card on the hub: everything the template shows, worked out up front. */
export interface LevelCard {
  /** The element id, which old bookmarks, games and completion link to. */
  readonly id: string;
  readonly level: Level;
  readonly link: readonly string[];
  readonly query: Readonly<Record<string, number>> | null;
  /** Position in the game's list of levels, easiest first. */
  readonly number: number;
  readonly example: string;
  readonly title: MessageKey;
  readonly help: MessageKey;
  /** Castle stages show their number range instead of a help line. */
  readonly upTo?: number;
  readonly stars: number;
  readonly best: number;
  readonly state: 'mastered' | 'completed' | null;
  readonly recommended: boolean;
  /** The castle's wave campaign, shown as a wide card of its own. */
  readonly hero: boolean;
}
/** A topic inside a game, like "Adding" or "Times tables", with its levels in order. */
export interface Topic {
  readonly key: MessageKey;
  /** Element id prefix for the tab and its panel. */
  readonly id: string;
  readonly cards: readonly LevelCard[];
  readonly stars: number;
  readonly maxStars: number;
}
/** One section per game, in catalog order, with the world it belongs to. */
export interface GameEntry {
  readonly world: World;
  readonly chapter: Chapter;
  readonly topics: readonly Topic[];
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
  private readonly potionScores = inject(PotionScores);
  private readonly bakeryScores = inject(BakeryScores);
  private readonly drumScores = inject(DrumScores);
  private readonly starScores = inject(StarScores);
  private readonly fireworkScores = inject(FireworkScores);
  private readonly gondolaScores = inject(GondolaScores);
  private readonly scalesScores = inject(ScalesScores);
  private readonly marketScores = inject(MarketScores);
  protected readonly walls = inject(NumberWallStore);
  protected readonly totalWaves = TOTAL_WAVES;
  protected readonly nextId = computed(() => this.p.next()?.id);
  protected readonly games = computed<readonly GameEntry[]>(() =>
    this.catalog.flatMap((world) =>
      world.chapters.map((chapter) => ({ world, chapter, topics: this.topicsOf(chapter) })),
    ),
  );
  /** The topic each game shows; until a child picks one, the topic they are working on. */
  private readonly picked = signal<Readonly<Record<string, MessageKey>>>({});
  protected readonly selected = computed(() => {
    const picked = this.picked();
    return Object.fromEntries(
      this.games().map(({ chapter, topics }) => [
        chapter.id,
        picked[chapter.id] ?? this.currentTopic(topics),
      ]),
    ) as Readonly<Record<string, MessageKey>>;
  });
  /** The game section filling most of the screen, highlighted in the jump bar. */
  protected readonly inView = signal('');

  constructor() {
    // A link to a level (`/games#crocodile-3`) opens the topic that level belongs to.
    const route = inject(ActivatedRoute);
    route.fragment
      .pipe(takeUntilDestroyed())
      .subscribe((fragment) => fragment && this.reveal(fragment));
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
      // The hub can finish loading after the router tried its anchor jump; if the page is still
      // at the top, jump now. A restored scroll position (going back) is left alone.
      const fragment = route.snapshot.fragment;
      if (fragment && scroller.getScrollPosition()[1] === 0) scroller.scrollToAnchor(fragment);
    });
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
  /** Selects the topic holding the card with this id, so a deep link lands on a visible card. */
  protected reveal(cardId: string) {
    for (const { chapter, topics } of this.games()) {
      const topic = topics.find((entry) => entry.cards.some((card) => card.id === cardId));
      if (topic) this.choose(chapter.id, topic.key);
    }
  }
  protected choose(chapterId: string, topic: MessageKey) {
    this.picked.update((picked) => ({ ...picked, [chapterId]: topic }));
  }
  /** Arrow keys move along a game's topics, Home and End jump to the ends; selection follows. */
  protected onTopicKey(event: KeyboardEvent, game: GameEntry, index: number) {
    const last = game.topics.length - 1;
    const target =
      event.key === 'ArrowRight'
        ? index === last
          ? 0
          : index + 1
        : event.key === 'ArrowLeft'
          ? index === 0
            ? last
            : index - 1
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : -1;
    if (target < 0) return;
    event.preventDefault();
    const topic = game.topics[target]!;
    this.choose(game.chapter.id, topic.key);
    const tab = (event.currentTarget as HTMLElement).parentElement?.querySelector<HTMLElement>(
      `#${topic.id}-tab`,
    );
    tab?.focus();
    // Scroll only the row of topics, never the page.
    tab?.scrollIntoView?.({
      block: 'nearest',
      inline: 'nearest',
      container: 'nearest',
    } as ScrollIntoViewOptions);
  }
  /** The topic with the recommended level, else the first with an unplayed level. */
  private currentTopic(topics: readonly Topic[]): MessageKey {
    return (
      topics.find((topic) => topic.cards.some((card) => card.recommended)) ??
      topics.find((topic) => topic.cards.some((card) => card.stars === 0 && !card.state)) ??
      topics[0]
    )?.key as MessageKey;
  }
  private topicsOf(chapter: Chapter): readonly Topic[] {
    const cards =
      chapter.levels[0]?.format === 'number-wall'
        ? this.wallCards(chapter.levels[0])
        : chapter.levels.map((level, index) => this.card(level, index));
    const topics: { key: MessageKey; cards: LevelCard[] }[] = [];
    for (const card of cards) {
      const key = card.level.group ?? chapter.title;
      const topic = topics.find((entry) => entry.key === key);
      if (topic) topic.cards.push(card);
      else topics.push({ key, cards: [card] });
    }
    return topics.map((topic) => ({
      ...topic,
      id: `${chapter.id}-${topic.key}`,
      stars: topic.cards.reduce((sum, card) => sum + card.stars, 0),
      maxStars: topic.cards.length * 3,
    }));
  }
  private card(level: Level, index: number): LevelCard {
    const progress = this.p.progress();
    const mastered = progress.mastered.includes(level.id);
    return {
      id: level.id,
      level,
      link: ['/adventure', level.id],
      query: null,
      number: level.practice?.stage ?? index + 1,
      example: this.example(level),
      title: level.title,
      help: level.description,
      ...(level.practice ? { upTo: level.practice.max } : {}),
      stars: levelStars(level, progress),
      best:
        this.scores.best()[level.id] ??
        this.lockScores.best()[level.id] ??
        this.potionScores.best()[level.id] ??
        this.bakeryScores.best()[level.id] ??
        this.drumScores.best()[level.id] ??
        this.starScores.best()[level.id] ??
        this.fireworkScores.best()[level.id] ??
        this.gondolaScores.best()[level.id] ??
        this.scalesScores.best()[level.id] ??
        this.marketScores.best()[level.id] ??
        0,
      state: mastered ? 'mastered' : progress.completed?.includes(level.id) ? 'completed' : null,
      recommended: level.id === this.nextId(),
      hero: level.format === 'fairy-defense',
    };
  }
  /** Magic walls is one catalog level holding its own list; each wall level gets a card. */
  private wallCards(wall: Level): LevelCard[] {
    const suggested = wallLevels.find((level) => !this.walls.hasStar(level)) ?? wallLevels[0];
    return wallLevels.map((level) => ({
      // Level 1 keeps the catalog id, so older links to the walls still land on a card.
      id: level === 1 ? wall.id : `${wall.id}-${level}`,
      level: { ...wall, group: rulesFor(level).group },
      link: ['/adventure', wall.id],
      query: { level },
      number: levelPosition(level),
      example: '',
      title: this.wallTitle(level),
      help: this.wallHelp(level),
      stars: this.walls.rating(level),
      best: 0,
      state: this.walls.rating(level) === 3 ? 'mastered' : null,
      recommended: wall.id === this.nextId() && level === suggested,
      hero: false,
    }));
  }
  /** The worked example a level shows on its card, when the game defines one. */
  private example(level: Level) {
    const divide = this.i.t('divide');
    const castle = level.practice?.example;
    if (castle) return localQuestion(castle, { halfOf: this.i.t('halfOf'), divide });
    const race = raceStage(level.id)?.example;
    if (race) return raceSumText(race, (n) => this.i.t('raceHalfOf', { n }), divide);
    const crocodile = comparisonStage(level.id)?.example;
    if (crocodile) return localSide(crocodile, this.i.t('crocHalfOf'), divide);
    const potion = potionStage(level.id)?.example;
    if (potion) return localOps(potion, divide);
    const bakery = bakeryStage(level.id)?.example;
    if (bakery) return bakery;
    const drums = drumStage(level.id)?.example;
    if (drums) return drums;
    const star = starStage(level.id)?.example;
    if (star) return star;
    const firework = fireworkLevel(level.id)?.example;
    if (firework) return firework;
    const gondola = gondolaStage(level.id)?.example;
    if (gondola) return gondola;
    const scales = scalesStage(level.id)?.example;
    if (scales) return scales;
    const market = marketStage(level.id)?.example;
    if (market) return market;
    return lockStage(level.id)?.example ?? '';
  }
  private wallTitle(level: WallLevel): MessageKey {
    return `wallLevel${level}` as MessageKey;
  }
  private wallHelp(level: WallLevel): MessageKey {
    return `wallLevel${level}Help` as MessageKey;
  }
}
