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
import { Icon } from '@feenland/ui';
import { ThreeStage, WorldLoader } from '../../shared/three/three-stage';
import { HatcheryStore } from '../hatchery/hatchery-store';
import { StarBridge } from './star-bridge';
import { CONSTELLATIONS } from './star-constellations';
import { BRIDGE, FrameTick, StarFrame } from './star-frame';
import {
  catchPoints,
  COMET_STREAK,
  createRound,
  fallSeconds,
  FINALE_LENGTH,
  isMastered,
  landmarkHint,
  middleOf,
  roundLength,
  roundStars,
  share,
  STAR_PACES,
  StarItem,
  StarPace,
  starPosition,
  starStage,
  starStages,
  stardust,
  tryCatch,
  whereabouts,
} from './star-levels';
import { starText, StarMessageKey } from './star-messages';
import { StarDemo } from './star-demo';
import { countGuidedCatch, GUIDED_CATCHES, guidedCatches, IDLE_GUIDE } from './star-guide';
import { StarPicture } from './star-picture';
import { StarReward } from './star-reward';
import { StarScores } from './star-scores';
import { StarSounds } from './star-sounds';

type Phase = 'falling' | 'caught' | 'bounced' | 'complete';

interface Round {
  readonly items: readonly StarItem[];
  readonly index: number;
  /** Nova's lantern net along the bridge, from 0 to 1. */
  readonly net: number;
  /** Misses on this star: they bring the direction cue, then the landmark card. */
  readonly misses: number;
  readonly cue: 'further' | 'back' | null;
  /** Options already tried on a landed star or a pair: they stay greyed out. */
  readonly wrong: readonly number[];
  /** How far this star has fallen, from 0 to 1. */
  readonly fall: number;
  readonly firstTries: number;
  readonly score: number;
  readonly gain: number;
  readonly golden: boolean;
  readonly goldenCount: number;
  readonly streak: number;
  readonly bestStreak: number;
  readonly phase: Phase;
  readonly lit: number;
  readonly catches: number;
  readonly goldens: number;
  readonly bounces: number;
  /** Nova has moved since this star appeared: the hop moves on to Catch!. */
  readonly moved: boolean;
  readonly drained: number;
  readonly completes: number;
}

interface Status {
  readonly key: StarMessageKey;
  readonly values?: Record<string, string | number>;
  readonly extras?: readonly StarMessageKey[];
}

/** How long a catch, a bounce and the finished picture stay on screen before moving on. */
const CATCH_DELAY = 1500;
const BOUNCE_DELAY = 900;
const COMPLETE_DELAY = 2400;
/** Keyboard steps along the bridge: 1/50 of it, or 1/10 with Shift. */
const STEP = 1 / 50;
const BIG_STEP = 1 / 10;

@Component({
  selector: 'app-star-catcher',
  imports: [
    RouterLink,
    Icon,
    GameHeader,
    ThreeStage,
    StarBridge,
    StarDemo,
    StarPicture,
    StarReward,
  ],
  providers: [StarSounds],
  templateUrl: './star-catcher.html',
  styleUrls: ['./star-catcher.css', './star-catcher-play.css', './star-catcher-guide.css'],
  host: { '(document:visibilitychange)': 'visibilityChanged()' },
})
export class StarCatcher {
  protected readonly i = inject(LocaleService);
  private readonly p = inject(ProgressService);
  private readonly hatchery = inject(HatcheryStore);
  private readonly completion = inject(CompletionService);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  protected readonly sounds = inject(StarSounds);
  protected readonly scores = inject(StarScores);
  private readonly params = toSignal(inject(ActivatedRoute).paramMap);

  protected readonly total = starStages.length;
  protected readonly bridge = BRIDGE;
  protected readonly stage = computed(
    () => starStage(this.params()?.get('id')) ?? starStage('star-catcher-1')!,
  );
  protected readonly levelId = computed(() => `star-catcher-${this.stage().stage}`);
  protected readonly position = computed(() => starPosition(this.stage()));
  protected readonly levelLinks = starStages.map((stage, index) => ({
    stage: stage.stage,
    position: index + 1,
    route: ['/adventure', `star-catcher-${stage.stage}`],
  }));
  protected readonly nextLink = computed(() => {
    const next = starStages[this.position()];
    return next ? ['/adventure', `star-catcher-${next.stage}`] : null;
  });
  protected readonly count = computed(() => roundLength(this.stage()));
  protected readonly finaleLength = FINALE_LENGTH;

  protected readonly round = linkedSignal<Round>(() => this.fresh());
  protected readonly started = linkedSignal<boolean>(() => {
    this.stage();
    return false;
  });
  /** The finish card is up: the round is over and the picture has been admired. */
  protected readonly finished = linkedSignal<boolean>(() => {
    this.stage();
    return false;
  });
  protected readonly paces = STAR_PACES;
  protected readonly pace = signal<StarPace>(this.scores.pace());
  protected readonly timed = computed(() => this.pace() !== 'off');
  protected readonly status = signal<Status | null>(null);
  protected readonly saveFailed = signal(false);
  protected readonly newBest = signal(false);
  /** The first few catches on a device, and any wait of 6 s, show what to tap next. */
  private readonly learning = signal(guidedCatches() < GUIDED_CATCHES);
  private readonly idle = signal(false);
  /** The "how to play" film is open in its dialog: the star holds still. */
  protected readonly howToOpen = signal(false);
  /** The bridge the intro film shows: the level's own, or 0 to 100 for the mystery bridge. */
  protected readonly demoMax = computed(() => this.stage().max || 100);
  /** What hops next: Nova's handle, then Catch!, or the answer buttons. Never one answer. */
  protected readonly guide = computed<'handle' | 'catch' | 'options' | null>(() => {
    if (!(this.learning() || this.idle()) || !this.falling() || this.howToOpen()) return null;
    if (this.item().kind !== 'place') return 'options';
    return this.round().moved ? 'catch' : 'handle';
  });

  protected readonly item = computed(() => {
    const round = this.round();
    return round.items[Math.min(round.index, round.items.length - 1)];
  });
  protected readonly line = computed(() => this.item().line);
  protected readonly falling = computed(
    () => this.started() && !this.finished() && this.round().phase === 'falling',
  );
  protected readonly finale = computed(() => this.item().finale);
  protected readonly comet = computed(() => this.round().streak >= COMET_STREAK);
  protected readonly stardustLeft = computed(() =>
    this.timed() ? stardust(this.round().fall) : 0,
  );
  protected readonly stars = computed(() =>
    roundStars(this.round().firstTries, this.round().items.length),
  );
  protected readonly starSlots = [1, 2, 3];
  protected readonly best = computed(() => this.scores.best()[this.levelId()] ?? 0);
  protected readonly collection = computed(() => this.scores.constellations());
  protected readonly allConstellations = CONSTELLATIONS.map((item) => item.id);
  protected readonly progressDots = computed(() =>
    Array.from({ length: this.round().items.length }, (_, index) => index),
  );

  /** The posts on this star's bridge, with faded ones back after the second miss. */
  protected readonly ticks = computed<readonly FrameTick[]>(() => {
    const line = this.line();
    const ticks: FrameTick[] = line.ticks.map((tick) => ({
      at: share(line, tick.value),
      label: tick.labelled ? this.i.format(tick.value) : null,
      hint: false,
    }));
    if (line.mystery) ticks.push({ at: 1, label: '?', hint: false });
    if (this.round().misses >= 2 && this.item().kind === 'place')
      for (const value of line.hintTicks)
        ticks.push({ at: share(line, value), label: null, hint: true });
    return ticks;
  });

  /** What the star asks beside the board, with the star's number or sum shown big. */
  protected readonly question = computed(() => {
    const item = this.item();
    const plain = (lead: string, help: string) => ({ before: lead, big: '', after: '', help });
    if (item.kind === 'landed') return plain(this.t('askLanded'), this.t('askLandedHelp'));
    if (item.kind === 'compare') return plain(this.t('askCompare'), this.t('askCompareHelp'));
    if (item.between) {
      const values = { a: item.between[0], b: item.between[1] };
      return plain(this.t('askMiddle', values), this.t('askMiddleHelp', values));
    }
    const sums = this.stage().sums;
    const [before, after = ''] = this.t(sums ? 'askSum' : 'askPlace').split('{n}');
    const mystery = item.line.mystery
      ? this.t('mysteryEnd', { n: this.i.format(item.line.unit) })
      : '';
    return { before, big: item.label, after, help: sums ? this.t('askSumHelp') : mystery };
  });

  protected readonly landedOptions = computed(() => {
    const item = this.item();
    return item.kind === 'landed' ? item.options : [];
  });
  protected readonly pairValues = computed(() => {
    const item = this.item();
    return item.kind === 'compare' ? item.pair : [];
  });
  /** Over Nova, but kept clear of the board's edges so the bubble never squeezes. */
  protected readonly cueLeft = computed(() => {
    const at = (BRIDGE.left + (BRIDGE.right - BRIDGE.left) * this.round().net) * 100;
    return `clamp(120px, ${at}%, calc(100% - 120px))`;
  });
  /** A coarse slider value (0 to 10) so the exact spot is never read out. */
  protected readonly valueStep = computed(() => Math.round(this.round().net * 10));

  /** Where Nova is, for screen readers: about a numbered post, or only a coarse zone. */
  protected readonly valueText = computed(() => {
    const where = whereabouts(this.line(), this.round().net);
    if (where.kind === 'about') return this.t('about', { n: this.i.format(where.value) });
    const keys = {
      start: 'zoneStart',
      nearStart: 'zoneNearStart',
      beforeHalf: 'zoneBeforeHalf',
      half: 'zoneHalf',
      pastHalf: 'zonePastHalf',
      nearEnd: 'zoneNearEnd',
      end: 'zoneEnd',
    } as const;
    return this.t(keys[where.zone]);
  });

  /** The help card after the second miss: the rule or a landmark question, never the spot. */
  protected readonly help = computed(() => {
    const round = this.round();
    const item = this.item();
    if (round.misses < 2 || round.phase === 'caught' || round.phase === 'complete') return null;
    if (item.kind === 'landed') return { text: this.t('hintLanded'), extras: [] as string[] };
    if (item.kind === 'compare') return { text: this.t('hintCompare'), extras: [] as string[] };
    const line = item.line;
    const mid = this.i.format(middleOf(line));
    const text = item.between
      ? this.t('hintMiddleStar', { a: item.between[0], b: item.between[1] })
      : this.t(landmarkHint(this.stage(), line, round.misses), { n: item.label, mid });
    const extras: string[] = [];
    if (line.hintTicks.length) extras.push(this.t('hintTicks'));
    if (round.misses >= 3) extras.push(this.t('hintWider'));
    return { text, extras };
  });

  protected readonly frame = computed<StarFrame>(() => {
    const round = this.round();
    const item = this.item();
    const answered = round.phase === 'caught' || round.phase === 'complete';
    return {
      item: round.index,
      kind: item.kind,
      ticks: this.ticks(),
      label: item.kind === 'place' ? item.label : '',
      pair: item.kind === 'compare' ? [String(item.pair[0]), String(item.pair[1])] : null,
      landed:
        item.kind === 'landed'
          ? [share(item.line, item.target)]
          : item.kind === 'compare' && answered
            ? item.pair.map((value) => share(item.line, value))
            : [],
      net: round.net,
      fall: round.fall,
      hover: !this.timed(),
      stardust: this.timed() ? Math.max(0, 1 - round.fall) : 0.35,
      phase: round.phase,
      golden: round.golden,
      comet: this.comet(),
      finale: item.finale,
      queued: item.finale ? round.items.length - round.index - 1 : 0,
      gain: round.gain,
      constellation: this.stage().constellation,
      lit: round.lit,
      complete: round.phase === 'complete',
      collection: this.collection().filter((id) => id !== this.stage().constellation),
      catches: round.catches,
      goldens: round.goldens,
      bounces: round.bounces,
      drained: round.drained,
      completes: round.completes,
    };
  });
  protected readonly loadWorld: WorldLoader<StarFrame> = () =>
    import('./star-world').then((m) => m.StarWorld);

  private readonly outcome = viewChild<ElementRef<HTMLElement>>('outcome');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private timer?: ReturnType<typeof setTimeout>;
  private tick?: ReturnType<typeof setInterval>;
  /** Milliseconds this star has been falling, and when the current stretch started. */
  private fallen = 0;
  private fallFrom = 0;
  private dragging = false;
  private idleTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    effect(() => {
      if (this.started()) this.p.explore('tens');
    });
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.timer);
      clearTimeout(this.idleTimer);
      clearInterval(this.tick);
    });
  }

  protected t(key: StarMessageKey, values: Record<string, string | number> = {}) {
    return starText(this.i.locale(), key, values);
  }
  protected levelKey(stage: number) {
    return `starCatcher${stage}` as MessageKey;
  }
  protected paceSeconds(pace: StarPace) {
    return fallSeconds(pace, this.stage().sums);
  }

  protected selectPace(pace: StarPace) {
    this.pace.set(pace);
    this.scores.rememberPace(pace);
    if (!this.started()) return;
    if (pace === 'off') this.stopFall();
    else if (this.falling()) this.startFall(false);
  }

  protected play() {
    clearTimeout(this.timer);
    this.stopFall();
    this.round.set(this.fresh());
    this.status.set(null);
    this.saveFailed.set(false);
    this.newBest.set(false);
    this.finished.set(false);
    this.started.set(true);
    this.sounds.play('start');
    this.startFall(true);
    this.restartIdle();
    this.focusControl();
  }

  /* ---------------------------------------------------------------------------------------- */
  /* Moving Nova                                                                                */
  /* ---------------------------------------------------------------------------------------- */

  protected setNet(value: number) {
    if (!this.falling() && this.round().phase !== 'bounced') return;
    const net = Math.max(0, Math.min(1, value));
    this.round.update((round) => ({ ...round, net, cue: null, moved: true }));
    this.restartIdle();
  }

  protected pointerDown(event: PointerEvent) {
    if (this.item().kind !== 'place' || event.button > 0) return;
    const track = event.currentTarget as HTMLElement;
    this.dragging = true;
    track.setPointerCapture?.(event.pointerId);
    this.moveTo(event, track);
    track.querySelector<HTMLElement>('[role="slider"]')?.focus({ preventScroll: true });
    event.preventDefault();
  }

  protected pointerMove(event: PointerEvent) {
    if (!this.dragging) return;
    this.moveTo(event, event.currentTarget as HTMLElement);
  }

  protected pointerUp(event: PointerEvent) {
    this.dragging = false;
    (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
  }

  private moveTo(event: PointerEvent, track: HTMLElement) {
    const rect = track.getBoundingClientRect();
    if (!rect.width) return;
    this.setNet((event.clientX - rect.left) / rect.width);
  }

  /** Arrows move Nova by 1/50 of the bridge, Shift+arrows by 1/10; Enter or Space catches. */
  protected sliderKey(event: KeyboardEvent) {
    const net = this.round().net;
    const step = event.shiftKey ? BIG_STEP : STEP;
    const moves: Record<string, number> = {
      ArrowLeft: net - step,
      ArrowDown: net - step,
      ArrowRight: net + step,
      ArrowUp: net + step,
      PageDown: net - BIG_STEP,
      PageUp: net + BIG_STEP,
      Home: 0,
      End: 1,
    };
    if (event.key in moves) {
      event.preventDefault();
      this.setNet(moves[event.key]);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.catchStar();
    }
  }

  /* ---------------------------------------------------------------------------------------- */
  /* Catching                                                                                   */
  /* ---------------------------------------------------------------------------------------- */

  protected catchStar() {
    const item = this.item();
    const round = this.round();
    if (!this.falling() || item.kind !== 'place') return;
    const result = tryCatch(this.stage(), item.line, item.target, round.net, round.misses);
    if (result.caught) {
      this.caught({ golden: result.golden, closeness: result.closeness });
      return;
    }
    this.missed(result.direction);
    this.status.set({ key: result.direction });
  }

  /** Picks a number for a landed star. */
  protected pickLanded(value: number) {
    const item = this.item();
    if (!this.falling() || item.kind !== 'landed' || this.round().wrong.includes(value)) return;
    if (value === item.target) {
      this.caught({ golden: false, closeness: 0.5 }, { key: 'rightLanded', n: value });
      return;
    }
    this.missed(null, value);
    this.status.set({ key: 'missedLanded' });
  }

  /** Picks the star of a pair that lands further along. */
  protected pickPair(index: number) {
    const item = this.item();
    if (!this.falling() || item.kind !== 'compare' || this.round().wrong.includes(index)) return;
    const further = item.pair[0] > item.pair[1] ? 0 : 1;
    if (index === further) {
      this.caught({ golden: false, closeness: 0.5 }, { key: 'rightCompare', n: item.pair[index] });
      return;
    }
    this.missed(null, index);
    this.status.set({ key: 'missedCompare' });
  }

  private caught(
    result: { golden: boolean; closeness: number },
    news?: { key: 'rightLanded' | 'rightCompare'; n: number },
  ) {
    this.stopFall();
    const round = this.round();
    const item = this.item();
    const firstTry = round.misses === 0;
    const streak = firstTry ? round.streak + 1 : 0;
    const gain = catchPoints({
      firstTry,
      golden: result.golden,
      closeness: result.closeness,
      comet: round.streak >= COMET_STREAK && firstTry,
      finale: item.finale,
      stardust: this.timed() ? stardust(round.fall) : 0,
    });
    this.round.set({
      ...round,
      phase: 'caught',
      firstTries: round.firstTries + (firstTry ? 1 : 0),
      score: round.score + gain,
      gain,
      golden: result.golden,
      goldenCount: round.goldenCount + (result.golden ? 1 : 0),
      streak,
      bestStreak: Math.max(round.bestStreak, streak),
      lit: round.lit + 1,
      catches: round.catches + 1,
      goldens: round.goldens + (result.golden ? 1 : 0),
      cue: null,
    });
    this.hatchery.warm();
    if (this.learning()) this.learning.set(countGuidedCatch() < GUIDED_CATCHES);
    this.idle.set(false);
    clearTimeout(this.idleTimer);
    const extras: StarMessageKey[] = [];
    if (streak === COMET_STREAK) extras.push('cometLit');
    this.status.set(
      news
        ? { key: news.key, values: { n: this.i.format(news.n), p: gain }, extras }
        : { key: result.golden ? 'caughtGolden' : 'caught', values: { n: gain }, extras },
    );
    if (result.golden) this.sounds.play('golden');
    else this.sounds.play('catch', result.closeness);
    if (streak === COMET_STREAK) this.sounds.play('comet');
    this.timer = setTimeout(() => this.advance(), CATCH_DELAY);
  }

  /** A miss keeps the same star: it bounces off the rim and floats back up. */
  private missed(direction: 'further' | 'back' | null, tried?: number) {
    this.restartIdle();
    this.round.update((round) => ({
      ...round,
      phase: 'bounced',
      misses: round.misses + 1,
      cue: direction,
      wrong: tried === undefined ? round.wrong : [...round.wrong, tried],
      streak: 0,
      bounces: round.bounces + 1,
    }));
    this.sounds.play('bounce');
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.round.update((round) =>
        round.phase === 'bounced' ? { ...round, phase: 'falling' } : round,
      );
      this.focusControl();
    }, BOUNCE_DELAY);
  }

  /** Moves on to the next star, or finishes the round with the whole picture in the sky. */
  protected advance() {
    clearTimeout(this.timer);
    const round = this.round();
    if (round.phase !== 'caught') return;
    if (round.index + 1 < round.items.length) {
      const index = round.index + 1;
      this.round.set({
        ...round,
        index,
        misses: 0,
        cue: null,
        wrong: [],
        fall: 0,
        golden: false,
        moved: false,
        phase: 'falling',
      });
      if (index === this.count()) {
        this.status.set({ key: 'finaleStart' });
        this.sounds.play('finale');
      } else {
        this.status.set(null);
        this.sounds.play('appear');
      }
      this.startFall(true);
      this.restartIdle();
      this.focusControl();
      return;
    }
    this.round.set({ ...round, phase: 'complete', completes: round.completes + 1 });
    this.status.set({
      key: 'drew',
      values: { name: this.t(this.stage().constellation) },
    });
    this.sounds.play('constellation');
    this.saveFailed.set(!this.record());
    this.newBest.set(this.scores.record(this.levelId(), round.score));
    this.scores.draw(this.stage().constellation);
    this.timer = setTimeout(() => this.finish(), COMPLETE_DELAY);
  }

  /** Shows the finish card now instead of waiting. */
  protected finish() {
    clearTimeout(this.timer);
    if (this.round().phase !== 'complete') return;
    this.finished.set(true);
    requestAnimationFrame(() => this.outcome()?.nativeElement.focus({ preventScroll: true }));
  }

  /* ---------------------------------------------------------------------------------------- */
  /* The fall                                                                                   */
  /* ---------------------------------------------------------------------------------------- */

  private startFall(fresh: boolean) {
    this.stopFall();
    const seconds = fallSeconds(this.pace(), this.stage().sums);
    if (fresh) this.fallen = 0;
    if (!seconds) return;
    if (!fresh) this.fallen = this.round().fall * seconds * 1000;
    this.fallFrom = Date.now();
    const step = () => {
      const round = this.round();
      if (round.phase === 'caught' || round.phase === 'complete') return;
      const fall = Math.min(1, (this.fallen + Date.now() - this.fallFrom) / (seconds * 1000));
      if (fall >= 1 && round.fall < 1) {
        // The star reached the bridge: its stardust is gone, and it waits there to be caught.
        this.round.set({ ...round, fall: 1, drained: round.drained + 1 });
        this.status.set({ key: 'drained' });
        this.sounds.play('drain');
        this.stopFall();
        return;
      }
      if (fall !== round.fall) this.round.set({ ...round, fall });
    };
    this.tick = setInterval(step, 250);
  }

  private stopFall() {
    if (this.tick) this.fallen += Date.now() - this.fallFrom;
    clearInterval(this.tick);
    this.tick = undefined;
  }

  /** Opens the "how to play" film; the falling star waits until it is closed. */
  protected openHowTo(dialog: HTMLDialogElement) {
    this.howToOpen.set(true);
    this.stopFall();
    dialog.showModal();
  }

  protected howToClosed() {
    this.howToOpen.set(false);
    if (this.timed() && this.falling() && this.round().fall < 1) this.startFall(false);
    this.restartIdle();
  }

  /** After a quiet 6 s the hop comes back to show what to tap next. */
  private restartIdle() {
    clearTimeout(this.idleTimer);
    this.idle.set(false);
    this.idleTimer = setTimeout(() => this.idle.set(true), IDLE_GUIDE);
  }

  protected visibilityChanged() {
    if (!this.timed() || !this.started() || this.finished() || this.howToOpen()) return;
    if (this.document.hidden) this.stopFall();
    else if (this.round().phase !== 'caught' && this.round().fall < 1) this.startFall(false);
  }

  /* ---------------------------------------------------------------------------------------- */
  /* Finishing                                                                                  */
  /* ---------------------------------------------------------------------------------------- */

  private record() {
    const stars = this.stars();
    return this.completion.finish({
      levelId: this.levelId(),
      completed: true,
      mastered: isMastered(stars),
      stars,
    });
  }

  protected celebrate() {
    if (this.completion.result()?.levelId === this.levelId() || this.record())
      void this.router.navigate(['/complete', this.levelId()]);
    else this.saveFailed.set(true);
  }

  protected statusText() {
    const status = this.status();
    if (!status) return '';
    return [status.key, ...(status.extras ?? [])]
      .map((key) => this.t(key, status.values))
      .join(' ');
  }

  protected goldenText() {
    const n = this.round().goldenCount;
    return n === 0
      ? this.t('goldenNone')
      : n === 1
        ? this.t('goldenOne')
        : this.t('goldenMany', { n });
  }

  /** Keeps focus on the lantern slider, or on the first answer button for the other stars. */
  private focusControl() {
    requestAnimationFrame(() => {
      const root = this.host.nativeElement;
      const active = this.document.activeElement as HTMLElement | null;
      if (
        active &&
        root.contains(active) &&
        active.matches('[role="slider"], .option:not([disabled])')
      )
        return;
      root
        .querySelector<HTMLElement>('[role="slider"], .option:not([disabled])')
        ?.focus({ preventScroll: true });
    });
  }

  private fresh(): Round {
    return {
      items: createRound(this.stage()),
      index: 0,
      net: 0.5,
      misses: 0,
      cue: null,
      wrong: [],
      fall: 0,
      firstTries: 0,
      score: 0,
      gain: 0,
      golden: false,
      goldenCount: 0,
      streak: 0,
      bestStreak: 0,
      phase: 'falling',
      lit: 0,
      catches: 0,
      goldens: 0,
      bounces: 0,
      drained: 0,
      completes: 0,
      moved: false,
    };
  }
}
