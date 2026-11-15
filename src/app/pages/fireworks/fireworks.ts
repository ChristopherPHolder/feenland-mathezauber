import { DOCUMENT } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CompletionService } from '../../core/completion';
import { LocaleService } from '../../core/locale';
import { MessageKey } from '../../core/messages';
import { ProgressService } from '../../core/progress';
import { GameHeader } from '../../shared/game-header';
import { Icon } from '../../shared/icon';
import { ThreeStage, WorldLoader } from '../../shared/three/three-stage';
import { HatcheryStore } from '../hatchery/hatchery-store';
import {
  BLOOM,
  FADE_OUT,
  FIZZLE,
  FireworkFrame,
  FireworkPhase,
  RISE,
  SHOW,
} from './firework-frame';
import {
  adaptLook,
  BIG_SHOW,
  createPattern,
  createRound,
  FINALE,
  FireworkLevel,
  fireworkLevel,
  fireworkLevels,
  fireworkPoints,
  fireworkPosition,
  FireworkPace,
  HintKey,
  hintFor,
  HUES,
  isMastered,
  Look,
  lookSeconds,
  PACES,
  padNumbers,
  paceOf,
  Pattern,
  ROUND_LENGTH,
  roundStars,
  seeded,
  SPOTTER_BONUS,
  startLook,
  TOTAL_LEVELS,
  Way,
  waysToSee,
} from './firework-levels';
import { fireworkText, FireworkMessageKey } from './firework-messages';
import { FireworkReward } from './firework-reward';
import { FireworkScores } from './firework-scores';
import { BOOK_SHAPES, BookShape, shapePath } from './firework-shapes';
import { FireworkSky } from './firework-sky';
import { FireworkSounds } from './firework-sounds';

interface Round {
  readonly patterns: readonly Pattern[];
  readonly index: number;
  readonly phase: FireworkPhase;
  /** Wrong answers on this firework. */
  readonly misses: number;
  /** Whether the child used the Peek on this firework. */
  readonly peeked: boolean;
  readonly look: Look;
  /** How long the current burst holds. */
  readonly lookNow: number;
  readonly score: number;
  /** Points the last firework paid, for the float-up. */
  readonly gain: number;
  readonly streak: number;
  readonly bestStreak: number;
  /** First looks among the twelve fireworks (the finale is extra). */
  readonly firstLooks: number;
  /** Whether each finished firework was a first look, for the HUD. */
  readonly results: readonly boolean[];
  readonly launched: readonly number[];
  readonly ways: readonly Way[] | null;
  readonly spotted: boolean;
  readonly hint: HintKey | null;
  readonly launches: number;
  readonly bursts: number;
  readonly blooms: number;
  readonly fizzles: number;
  readonly peeks: number;
  readonly shows: number;
  readonly done: boolean;
}

interface Status {
  readonly key: FireworkMessageKey;
  readonly values?: Record<string, string | number>;
  readonly extras?: readonly FireworkMessageKey[];
}

const ANSWERABLE: readonly FireworkPhase[] = ['look', 'fade', 'gone'];
const BANNER_MS = 1800;
/** How long a typed first digit waits for a second one on a 1–20 pad. */
const TYPE_WAIT = 900;

@Component({
  selector: 'app-fireworks',
  imports: [RouterLink, Icon, GameHeader, ThreeStage, FireworkSky, FireworkReward],
  providers: [FireworkSounds],
  templateUrl: './fireworks.html',
  styleUrls: ['./fireworks.css', './fireworks-play.css'],
  host: {
    '(document:keydown)': 'onKey($event)',
  },
})
export class Fireworks {
  protected readonly i = inject(LocaleService);
  private readonly p = inject(ProgressService);
  private readonly hatchery = inject(HatcheryStore);
  private readonly completion = inject(CompletionService);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  protected readonly sounds = inject(FireworkSounds);
  protected readonly scores = inject(FireworkScores);
  private readonly params = toSignal(inject(ActivatedRoute).paramMap);

  protected readonly total = TOTAL_LEVELS;
  protected readonly roundLength = ROUND_LENGTH;
  protected readonly level = computed<FireworkLevel>(
    () => fireworkLevel(this.params()?.get('id')) ?? fireworkLevels[0],
  );
  protected readonly levelId = computed(() => `fireworks-${this.level().level}`);
  protected readonly position = computed(() => fireworkPosition(this.level()));
  protected readonly levelLinks = fireworkLevels.map((level, index) => ({
    level: level.level,
    position: index + 1,
    route: ['/adventure', `fireworks-${level.level}`],
  }));
  protected readonly nextLink = computed(() => {
    const next = fireworkLevels[this.position()];
    return next ? ['/adventure', `fireworks-${next.level}`] : null;
  });
  protected readonly pad = computed(() => padNumbers(this.level()));
  protected readonly wide = computed(() => this.pad().length > 10);
  protected readonly paces = PACES;
  protected readonly pace = signal<FireworkPace>(this.scores.pace());
  protected readonly bookShapes = BOOK_SHAPES;

  protected readonly round = linkedSignal<Round>(() => this.fresh());
  protected readonly started = linkedSignal<boolean>(() => {
    this.level();
    return false;
  });
  protected readonly status = signal<Status | null>(null);
  protected readonly banner = signal<'bigShow' | 'finale' | null>(null);
  protected readonly saveFailed = signal(false);
  protected readonly newBest = signal(false);
  protected readonly newShape = signal(false);
  /** Digits typed on the keyboard, waiting for a second one. */
  protected readonly typed = signal('');

  protected readonly pattern = computed(() => {
    const round = this.round();
    return round.patterns[Math.min(round.index, FINALE)];
  });
  protected readonly finale = computed(() => this.round().index === FINALE);
  protected readonly phase = computed(() => this.round().phase);
  protected readonly answerable = computed(
    () => this.started() && ANSWERABLE.includes(this.phase()),
  );
  protected readonly canPeek = computed(
    () => !this.round().peeked && (this.phase() === 'fade' || this.phase() === 'gone'),
  );
  protected readonly bigShow = computed(() => this.round().streak >= BIG_SHOW);
  protected readonly freePeek = computed(() => paceOf(this.pace()).freePeek);
  protected readonly stars = computed(() => roundStars(this.round().firstLooks));
  protected readonly best = computed(() => this.scores.best()[this.levelId()] ?? 0);
  protected readonly makeTen = computed(() => this.level().kinds.includes('makeTen'));
  protected readonly slots = Array.from({ length: ROUND_LENGTH + 1 }, (_, index) => index);
  protected readonly sentence = computed(() => this.sentenceOf(this.pattern()));
  /** A picture of the level for the intro: one of its fireworks, glowing with its groups. */
  protected readonly preview = computed<FireworkFrame>(() => {
    const level = this.level();
    const pattern = createPattern(
      level.kinds[0],
      { jitter: level.jitter },
      seeded(level.level * 7),
    );
    return this.frameFor(pattern, {
      phase: 'look',
      outlines: false,
      look: 3,
      firework: 0,
      launched: [],
    });
  });
  protected readonly frame = computed<FireworkFrame>(() => {
    const round = this.round();
    return {
      ...this.frameFor(this.pattern(), {
        phase: round.phase,
        outlines: round.phase === 'bloom' || round.misses >= 2,
        look: round.lookNow,
        firework: round.index,
        launched: round.launched,
      }),
      bigShow: this.bigShow(),
      finale: this.finale(),
      launches: round.launches,
      bursts: round.bursts,
      blooms: round.blooms,
      fizzles: round.fizzles,
      peeks: round.peeks,
      shows: round.shows,
    };
  });
  protected readonly loadWorld: WorldLoader<FireworkFrame> = () =>
    import('./firework-world').then((m) => m.FireworkWorld);

  private readonly outcome = viewChild<ElementRef<HTMLElement>>('outcome');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private timer?: ReturnType<typeof setTimeout>;
  private bannerTimer?: ReturnType<typeof setTimeout>;
  private typeTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    effect(() => {
      if (this.started()) this.p.explore('numbers');
    });
    inject(DestroyRef).onDestroy(() => this.stopTimers());
  }

  protected t(key: FireworkMessageKey, values: Record<string, string | number> = {}) {
    return fireworkText(this.i.locale(), key, values);
  }
  protected levelKey(level: number) {
    return `fireworks${level}` as MessageKey;
  }
  protected trickKey(level: number) {
    return `trick${level}` as FireworkMessageKey;
  }
  protected hue(index: number) {
    return HUES[index];
  }
  protected paceSeconds(pace: FireworkPace) {
    return this.i.format(startLook(pace, this.level()).seconds);
  }
  protected readonly spotterBonus = SPOTTER_BONUS;
  protected shapePathOf(shape: BookShape) {
    return shapePath(shape);
  }
  /** Which five a pad key belongs to, so the pad shows the 5 and 10 structure. */
  protected tone(n: number) {
    return this.pad()[0] === 0 ? Math.floor(n / 5) : Math.floor((n - 1) / 5);
  }
  protected found(shape: string) {
    return this.scores.book().includes(shape as BookShape);
  }

  protected selectPace(pace: FireworkPace) {
    this.pace.set(pace);
    this.scores.choosePace(pace);
  }

  protected play() {
    this.stopTimers();
    this.round.set(this.fresh());
    this.status.set(null);
    this.banner.set(null);
    this.saveFailed.set(false);
    this.newBest.set(false);
    this.newShape.set(false);
    this.started.set(true);
    this.sounds.play('start');
    this.launch();
  }

  /** Flick lights a rocket. Under calm motion it skips the rise and glows in place. */
  private launch() {
    const round = this.round();
    this.status.set({
      key: 'launching',
      values: { n: Math.min(round.index + 1, ROUND_LENGTH + 1), total: ROUND_LENGTH + 1 },
    });
    if (this.calm()) {
      this.glow();
      return;
    }
    this.round.set({ ...round, phase: 'launch', launches: round.launches + 1 });
    this.sounds.play('whoosh');
    this.later(() => this.glow(), RISE * 1000);
    this.focusPad();
  }

  /** The pattern bursts and holds for the look time. */
  private glow() {
    const round = this.round();
    const lookNow = lookSeconds(round.look, this.pattern(), round.misses);
    this.round.set({ ...round, phase: 'look', lookNow, bursts: round.bursts + 1 });
    this.sounds.play('pop');
    if (round.misses === 0 && !round.peeked && round.phase === 'launch')
      this.status.set({ key: 'look' });
    this.later(() => this.fadeAway(), lookNow * 1000);
    this.focusPad();
  }

  private fadeAway() {
    this.round.update((r) => ({ ...r, phase: 'fade' }));
    this.later(() => {
      this.round.update((r) => ({ ...r, phase: 'gone' }));
      if (!this.round().hint) this.status.set({ key: this.makeTen() ? 'askEmpty' : 'ask' });
    }, FADE_OUT * 1000);
  }

  /** The child's answer. It is never timed: the pad waits as long as it takes. */
  protected answer(n: number) {
    if (!this.answerable()) return;
    this.typed.set('');
    clearTimeout(this.typeTimer);
    if (n === this.pattern().answer) this.right();
    else this.miss(n);
  }

  private right() {
    this.stopTimers();
    const round = this.round();
    const finale = this.finale();
    const firstLook = round.misses === 0 && (!round.peeked || this.freePeek());
    const points = fireworkPoints({
      firstLook,
      bigShow: round.streak >= BIG_SHOW,
      finale,
    });
    const streak = firstLook ? round.streak + 1 : round.streak;
    const startsBigShow = streak === BIG_SHOW;
    this.round.set({
      ...round,
      phase: 'bloom',
      score: round.score + points,
      gain: points,
      streak,
      bestStreak: Math.max(round.bestStreak, streak),
      firstLooks: round.firstLooks + (firstLook && !finale ? 1 : 0),
      results: [...round.results, firstLook],
      launched: [...round.launched, this.pattern().hue],
      look: adaptLook(this.pace(), round.look, firstLook ? 'firstLook' : 'right'),
      ways: finale ? null : waysToSee(this.pattern()),
      spotted: false,
      hint: null,
      blooms: round.blooms + 1,
    });
    this.hatchery.warm();
    this.sounds.play('aah');
    const extras: FireworkMessageKey[] = [];
    if (firstLook) extras.push('rightFirst');
    if (startsBigShow) {
      extras.push('bigShowBanner');
      this.showBanner('bigShow');
      this.sounds.play('bigShow');
    }
    this.status.set({ key: 'right', values: { sentence: this.sentence() }, extras });
    if (finale) this.later(() => this.show(), BLOOM * 1000);
    else this.focusWays();
  }

  /** A gentle fizzle, Flick's help, and the same pattern bursts again. */
  private miss(given: number) {
    this.stopTimers();
    const round = this.round();
    const misses = round.misses + 1;
    const hint = hintFor(this.pattern(), misses, given);
    this.round.set({
      ...round,
      phase: 'fizzle',
      misses,
      streak: 0,
      hint,
      look: adaptLook(this.pace(), round.look, 'miss'),
      fizzles: round.fizzles + 1,
    });
    this.sounds.play('fizzle');
    this.status.set({ key: hint });
    this.later(() => this.glow(), FIZZLE * 1000);
  }

  /** Bursts the same pattern once more. It only costs the first-look bonus. */
  protected peek() {
    if (!this.canPeek()) return;
    const round = this.round();
    this.stopTimers();
    this.round.set({
      ...round,
      peeked: true,
      peeks: round.peeks + 1,
      look: adaptLook(this.pace(), round.look, 'peek'),
    });
    this.sounds.play('peek');
    this.glow();
  }

  /** "How did you see it?": any honest answer earns the spotter points, then the next rocket. */
  protected see(way: Way | null) {
    const round = this.round();
    if (round.phase !== 'bloom' || !round.ways) return;
    if (way && !round.spotted) {
      this.round.set({
        ...round,
        score: round.score + SPOTTER_BONUS,
        spotted: true,
        look: way.kind === 'counted' ? adaptLook(this.pace(), round.look, 'counted') : round.look,
      });
      this.sounds.play('spotter');
    }
    this.next();
  }

  private next() {
    this.stopTimers();
    const round = this.round();
    const index = round.index + 1;
    this.round.set({
      ...round,
      index,
      phase: 'idle',
      misses: 0,
      peeked: false,
      ways: null,
      spotted: false,
      hint: null,
    });
    if (index === FINALE) {
      this.showBanner('finale');
      this.sounds.play('finale');
      this.status.set({ key: 'finaleBanner' });
      this.later(() => this.launch(), BANNER_MS);
    } else this.launch();
  }

  /** Every firework of the round goes up together, then the finish card. */
  private show() {
    this.round.update((r) => ({ ...r, phase: 'show', shows: r.shows + 1 }));
    this.sounds.play('show');
    this.status.set({ key: 'showTitle', extras: ['showHelp'] });
    this.later(() => this.finish(), (this.calm() ? SHOW / 2 : SHOW) * 1000);
  }

  private finish() {
    const round = this.round();
    this.round.set({ ...round, done: true, phase: 'idle' });
    this.saveFailed.set(!this.record());
    this.newBest.set(this.scores.record(this.levelId(), round.score));
    this.newShape.set(this.scores.collect(this.level().shape));
    requestAnimationFrame(() => this.outcome()?.nativeElement.focus({ preventScroll: true }));
  }

  private record() {
    const stars = this.stars();
    return this.completion.finish({
      levelId: this.levelId(),
      completed: true,
      mastered: isMastered(this.level(), stars),
      stars,
    });
  }

  protected celebrate() {
    if (this.completion.result()?.levelId === this.levelId() || this.record())
      void this.router.navigate(['/complete', this.levelId()]);
    else this.saveFailed.set(true);
  }

  /** Number keys answer (two digits on a 1–20 pad) and P peeks. */
  protected onKey(event: KeyboardEvent) {
    if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || !this.started()) return;
    const target = event.target;
    if (target instanceof Element && target.closest('input, textarea, select')) return;
    if (event.key === 'p' || event.key === 'P') {
      if (!this.canPeek()) return;
      event.preventDefault();
      this.peek();
      return;
    }
    if (!/^\d$/.test(event.key) || !this.answerable()) return;
    event.preventDefault();
    const pad = this.pad();
    const max = pad.at(-1)!;
    const typed = this.typed() + event.key;
    const value = Number(typed);
    clearTimeout(this.typeTimer);
    // Up to ten, one key is enough: 0 means 10 on a 1–10 pad.
    if (max <= 10) {
      this.answer(typed === '0' && !pad.includes(0) ? 10 : value);
      return;
    }
    if (typed.length >= 2 || value * 10 > max) {
      if (pad.includes(value)) this.answer(value);
      this.typed.set('');
      return;
    }
    this.typed.set(typed);
    this.typeTimer = setTimeout(() => {
      if (pad.includes(value)) this.answer(value);
      this.typed.set('');
    }, TYPE_WAIT);
  }

  protected statusText() {
    const status = this.status();
    if (!status) return '';
    return [status.key, ...(status.extras ?? [])]
      .map((key) => this.t(key, status.values))
      .join(' ');
  }

  protected wayText(way: Way): string {
    const and = ` ${this.t('and')} `;
    switch (way.kind) {
      case 'parts':
        return way.parts.map((n) => this.i.format(n)).join(and);
      case 'double':
        return this.t('wayDouble', { n: way.n });
      case 'doubleMore':
        return this.t('wayDoubleMore', { n: way.n });
      case 'doubleLess':
        return this.t('wayDoubleLess', { n: way.n });
      case 'takeAway':
        return this.t('wayTakeAway', { from: way.from, n: way.n });
      case 'empty':
        return this.t('wayEmpty');
      case 'saw':
        return this.t('waySaw');
      case 'counted':
        return this.t('wayCounted');
    }
  }

  /** The number sentence shown after a right answer: 5 + 3 = 8. */
  private sentenceOf(pattern: Pattern) {
    const total = pattern.kind === 'makeTen' ? 10 : pattern.answer;
    return pattern.parts.length > 1
      ? `${pattern.parts.join(' + ')} = ${total}`
      : String(pattern.answer);
  }

  private frameFor(
    pattern: Pattern,
    part: Pick<FireworkFrame, 'phase' | 'outlines' | 'look' | 'firework' | 'launched'>,
  ): FireworkFrame {
    return {
      ...part,
      pattern,
      bigShow: false,
      finale: false,
      shape: this.level().shape,
      launches: 0,
      bursts: 0,
      blooms: 0,
      fizzles: 0,
      peeks: 0,
      shows: 0,
    };
  }

  private showBanner(kind: 'bigShow' | 'finale') {
    clearTimeout(this.bannerTimer);
    this.banner.set(kind);
    this.bannerTimer = setTimeout(() => this.banner.set(null), BANNER_MS);
  }

  private later(run: () => void, ms: number) {
    clearTimeout(this.timer);
    this.timer = setTimeout(run, ms);
  }

  private stopTimers() {
    clearTimeout(this.timer);
    clearTimeout(this.typeTimer);
    clearTimeout(this.bannerTimer);
  }

  /** True while motion should be kept to what carries meaning, as in the 3D stage. */
  private calm(): boolean {
    const view = this.document.defaultView;
    return (
      !!view?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ||
      this.document.documentElement.classList.contains('calm-motion')
    );
  }

  private focusPad() {
    requestAnimationFrame(() => {
      const active = this.document.activeElement as HTMLButtonElement | null;
      if (
        active &&
        active !== this.document.body &&
        this.host.nativeElement.contains(active) &&
        !active.disabled
      )
        return;
      this.host.nativeElement
        .querySelector<HTMLElement>('.pad button')
        ?.focus({ preventScroll: true });
    });
  }

  private focusWays() {
    requestAnimationFrame(() =>
      this.host.nativeElement
        .querySelector<HTMLElement>('.ways .next')
        ?.focus({ preventScroll: true }),
    );
  }

  private fresh(): Round {
    const level = this.level();
    return {
      patterns: createRound(level),
      index: 0,
      phase: 'idle',
      misses: 0,
      peeked: false,
      look: startLook(this.pace(), level),
      lookNow: startLook(this.pace(), level).seconds,
      score: 0,
      gain: 0,
      streak: 0,
      bestStreak: 0,
      firstLooks: 0,
      results: [],
      launched: [],
      ways: null,
      spotted: false,
      hint: null,
      launches: 0,
      bursts: 0,
      blooms: 0,
      fizzles: 0,
      peeks: 0,
      shows: 0,
      done: false,
    };
  }
}
