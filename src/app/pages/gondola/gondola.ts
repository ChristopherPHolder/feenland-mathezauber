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
import { GondolaCard } from './gondola-card';
import { GondolaCoach } from './gondola-coach';
import { GondolaDemo } from './gondola-demo';
import { countGuidedCabin, GUIDED_CABINS, guidedCabins } from './gondola-guide';
import { GondolaFrame, GondolaPhase } from './gondola-frame';
import {
  answerChoices,
  canExpress,
  canSwap,
  canTakeTen,
  checkSplit,
  classifyAnswer,
  cloudSeconds,
  createRound,
  expressMove,
  GOLDEN_STREAK,
  GONDOLA_PACES,
  GondolaItem,
  GondolaPace,
  gondolaPosition,
  gondolaStage,
  gondolaStages,
  isMastered,
  Move,
  parseGondolaPace,
  quickSplit,
  Random,
  roundStars,
  RuleCard,
  ruleCard,
  shapeOf,
  sumText,
  swapped,
  TARP_STREAK,
  TOTAL_STAGES,
  turnPoints,
} from './gondola-levels';
import { gondolaText, GondolaMessageKey } from './gondola-messages';
import { GondolaPlatform } from './gondola-platform';
import { GondolaReward, GondolaRewardKind } from './gondola-reward';
import { GondolaScores } from './gondola-scores';
import { GondolaSounds } from './gondola-sounds';
import { GondolaCherry, GondolaKeypad, GondolaSplit } from './gondola-split';

interface Round {
  readonly items: readonly GondolaItem[];
  readonly index: number;
  /** This turn's sum; swapped when the child put the other group in the cabin. */
  readonly item: GondolaItem;
  readonly swapped: boolean;
  readonly phase: GondolaPhase;
  readonly split: number;
  /** Drags, taps and key steps on the split this turn: one earns the one-move bonus. */
  readonly moves: number;
  readonly splitSlips: number;
  readonly answerSlips: number;
  readonly move: Move | null;
  readonly clever: boolean;
  readonly typed: string;
  readonly choices: readonly number[];
  readonly showBunnies: boolean;
  /** The tarp is due on this turn (three quick first tries in a row) and is it down yet. */
  readonly tarpDue: boolean;
  readonly tarpDown: boolean;
  readonly help: 'none' | 'seats' | 'pulse';
  readonly card: RuleCard | null;
  readonly cocoa: 'none' | 'warm' | 'cold';
  readonly vipTurn: number;
  /** First-try turns in a row: three make the golden express. */
  readonly streak: number;
  readonly bestStreak: number;
  readonly golden: boolean;
  /** Quick first tries in a row: three bring the snow tarp. */
  readonly quick: number;
  readonly firstTries: number;
  readonly cleverCount: number;
  readonly delivered: number;
  /** One entry per delivered cabin: was its split right on the first try? */
  readonly log: readonly boolean[];
  readonly score: number;
  readonly gain: number;
  readonly badges: readonly GondolaMessageKey[];
  readonly hops: number;
  readonly bounces: number;
  readonly jams: number;
  readonly cheers: number;
  readonly slips: number;
  readonly colds: number;
}

interface Status {
  readonly key: GondolaMessageKey;
  readonly values?: Record<string, string | number>;
  readonly extras?: readonly GondolaMessageKey[];
}

const PACE_KEY = 'feenland.gondola-pace.v1';
/**
 * The group hops in and the full cabin rides off before step 2. In 3D the scene needs the time
 * for the rest to board the next cabin, so the child reads "10 and 3" before answering.
 */
const MOVE_DELAY_3D = 2800;
const MOVE_DELAY_FLAT = 900;
/** The bunnies show for a moment before the snow tarp comes down. */
const TARP_DELAY = 1400;
const SOLVE_DELAY = 2800;
/** How long a child may wait before the next thing to tap hops again. */
const IDLE_MS = 6000;

@Component({
  selector: 'app-gondola',
  imports: [
    RouterLink,
    Icon,
    GameHeader,
    ThreeStage,
    GondolaPlatform,
    GondolaSplit,
    GondolaCherry,
    GondolaKeypad,
    GondolaReward,
    GondolaCard,
    GondolaDemo,
    GondolaCoach,
  ],
  providers: [GondolaSounds],
  templateUrl: './gondola.html',
  styleUrls: ['./gondola.css', './gondola-play.css', './gondola-motion.css'],
  host: {
    '(document:keydown)': 'onKey($event)',
    '(document:visibilitychange)': 'visibilityChanged()',
  },
})
export class Gondola {
  protected readonly i = inject(LocaleService);
  private readonly p = inject(ProgressService);
  private readonly hatchery = inject(HatcheryStore);
  private readonly completion = inject(CompletionService);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  protected readonly sounds = inject(GondolaSounds);
  protected readonly scores = inject(GondolaScores);
  private readonly params = toSignal(inject(ActivatedRoute).paramMap);
  /** Swapped out by tests for a seeded source. */
  random: Random = Math.random;

  protected readonly total = TOTAL_STAGES;
  protected readonly stage = computed(
    () => gondolaStage(this.params()?.get('id')) ?? gondolaStage('gondola-1')!,
  );
  protected readonly levelId = computed(() => `gondola-${this.stage().stage}`);
  protected readonly position = computed(() => gondolaPosition(this.stage()));
  protected readonly levelLinks = gondolaStages.map((stage, index) => ({
    stage: stage.stage,
    position: index + 1,
    route: ['/adventure', `gondola-${stage.stage}`],
  }));
  protected readonly nextLink = computed(() => {
    const next = gondolaStages[this.position()];
    return next ? ['/adventure', `gondola-${next.stage}`] : null;
  });

  protected readonly round = linkedSignal<Round>(() => this.fresh());
  protected readonly started = linkedSignal<boolean>(() => {
    this.stage();
    return false;
  });
  protected readonly paces = GONDOLA_PACES;
  protected readonly pace = signal<GondolaPace>(this.readPace());
  protected readonly timed = computed(() => this.pace() !== 'off');
  /** How far the cloud has drifted in this turn, 0 to 1. */
  protected readonly cloud = signal(0);
  protected readonly status = signal<Status | null>(null);
  protected readonly saveFailed = signal(false);
  protected readonly newBest = signal(false);
  protected readonly newBuilding = signal<number | null>(null);
  /** The "how to ride" film is open over the game; the cloud waits. */
  protected readonly coaching = signal(false);
  /** The first cabins on a device show what to tap next. */
  protected readonly guided = signal(guidedCabins() < GUIDED_CABINS);
  /** The child has waited a while: show what to tap next again. */
  protected readonly idle = signal(false);
  protected readonly guideSplit = computed(
    () => this.splitting() && !this.coaching() && (this.guided() || this.idle()),
  );
  protected readonly guideAnswer = computed(
    () => this.answering() && !this.coaching() && (this.guided() || this.idle()),
  );

  protected readonly turns = computed(() => this.stage().turns);
  protected readonly item = computed(() => this.round().item);
  protected readonly shape = computed(() => shapeOf(this.item()));
  /** The film's usual sum is 9 + 4; on that very turn it shows 8 + 5 instead. */
  protected readonly demoClash = computed(() => {
    const item = this.item();
    return item.kind === 'add' && item.a + item.b === 13 && (item.a === 9 || item.b === 9);
  });
  protected readonly big = computed(() => this.round().index === this.turns() - 1);
  protected readonly sum = computed(() => sumText(this.item()));
  protected readonly splitting = computed(() => this.started() && this.round().phase === 'split');
  protected readonly answering = computed(() => this.started() && this.round().phase === 'answer');
  /** Numbers-only levels hide the bunnies until "Show the bunnies" is tapped. */
  protected readonly representation = computed(() => {
    const stage = this.stage().representation;
    if (stage !== 'numbers' || !this.round().showBunnies) return stage;
    return this.shape().tens || this.shape().groupTens ? 'tens' : 'bunnies';
  });
  protected readonly numbersOnly = computed(() => this.representation() === 'numbers');
  protected readonly swappable = computed(
    () => canSwap(this.stage(), this.item()) && this.round().phase === 'split',
  );
  protected readonly expressOffer = computed(() => canExpress(this.stage(), this.item()));
  protected readonly takeTenOffer = computed(() => canTakeTen(this.stage(), this.item()));
  protected readonly express = computed(() => expressMove(this.item()));
  protected readonly tapCounts = computed(() =>
    Array.from({ length: this.shape().group }, (_, index) => index + 1),
  );
  protected readonly vipIndex = computed(() =>
    // The 3D queue crowns its last bunny; the row matches it.
    this.round().vipTurn === this.round().index ? this.shape().group - 1 : -1,
  );
  protected readonly cabinSlots = computed(() =>
    Array.from({ length: this.turns() }, (_, index) => index),
  );
  protected readonly stars = computed(() => roundStars(this.round().firstTries, this.turns()));
  protected readonly starSlots = [1, 2, 3];
  protected readonly best = computed(() => this.scores.best()[this.levelId()] ?? 0);
  protected readonly villageSlots = Array.from({ length: TOTAL_STAGES }, (_, index) => index);

  protected readonly frame = computed<GondolaFrame>(() => {
    const round = this.round();
    const shape = this.shape();
    const express = this.express();
    const representation = this.representation();
    return {
      turn: round.index,
      kind: shape.kind,
      tens: shape.tens,
      cabin: shape.cabin,
      groupTens: shape.groupTens,
      group: shape.group,
      split: round.split,
      phase: this.started() ? round.phase : 'split',
      move: round.move,
      expressCabins: express.cabins,
      fix: express.fix,
      representation,
      tarp: round.tarpDown && representation !== 'numbers',
      golden: round.golden,
      vip: round.vipTurn === round.index,
      big: this.big(),
      cloud: this.timed() && this.started() ? this.cloud() : 0,
      cocoa: round.cocoa,
      lanterns: round.delivered,
      village: this.scores.village(),
      help: round.help,
      hops: round.hops,
      bounces: round.bounces,
      jams: round.jams,
      cheers: round.cheers,
      slips: round.slips,
      colds: round.colds,
    };
  });
  /** The intro picture: the first turn of the level, before anything moves. */
  protected readonly introFrame = computed<GondolaFrame>(() => ({
    ...this.frame(),
    phase: 'split',
    cloud: 0,
    help: 'none',
  }));
  protected readonly outcomeFrame = computed<GondolaFrame>(() => ({
    ...this.frame(),
    phase: 'complete',
    cloud: 0,
    cocoa: 'none',
  }));
  protected readonly loadWorld: WorldLoader<GondolaFrame> = () =>
    import('./gondola-world').then((m) => m.GondolaWorld);

  /** The reward card while a delivered cabin stands ready. */
  protected readonly reward = computed(() => {
    const round = this.round();
    if (round.phase !== 'solved') return null;
    const kind: GondolaRewardKind = this.big()
      ? 'big'
      : round.golden
        ? 'golden'
        : round.splitSlips === 0
          ? 'first'
          : 'ride';
    const cheers = {
      big: 'rewardBig',
      golden: 'rewardGolden',
      first: 'rewardFirst',
      ride: round.item.kind === 'add' ? 'rewardRide' : 'rewardDown',
    } as const;
    return {
      kind,
      cheer: this.t(cheers[kind]),
      points: this.t('rewardPoints', { n: this.i.format(round.gain) }),
      badges: round.badges.map((key) => this.t(key)),
    };
  });

  private readonly outcome = viewChild<ElementRef<HTMLElement>>('outcome');
  private readonly splitControl = viewChild<GondolaSplit>('splitter');
  private readonly sceneStage = viewChild<ThreeStage<GondolaFrame>>('scene');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private timer?: ReturnType<typeof setTimeout>;
  private tarpTimer?: ReturnType<typeof setTimeout>;
  private tick?: ReturnType<typeof setInterval>;
  private idleTimer?: ReturnType<typeof setTimeout>;
  private cloudDue = 0;
  private cloudTotal = 0;
  private cloudLeft = 0;
  private splitStarted = 0;

  constructor() {
    effect(() => {
      if (this.started()) this.p.explore('tens');
    });
    inject(DestroyRef).onDestroy(() => this.stopTimers());
  }

  protected t(key: GondolaMessageKey, values: Record<string, string | number> = {}) {
    return gondolaText(this.i.locale(), key, values);
  }
  protected levelKey(stage: number) {
    return `gondola${stage}` as MessageKey;
  }
  protected paceSeconds(pace: GondolaPace) {
    return cloudSeconds(pace, this.stage());
  }
  protected tapText(n: number) {
    const add = this.item().kind === 'add';
    return n === 1
      ? this.t(add ? 'tapOneAdd' : 'tapOneSub')
      : this.t(add ? 'tapManyAdd' : 'tapManySub', { n });
  }
  protected splitValueText() {
    const split = this.round().split;
    if (!split) return this.t('splitNone');
    return this.t(this.item().kind === 'add' ? 'splitValueAdd' : 'splitValueSub', {
      first: split,
      rest: this.shape().group - split,
    });
  }
  protected expressText() {
    const { cabins, fix } = this.express();
    const ten = 10 * cabins;
    if (this.item().kind === 'sub') return this.t('expressSub1', { ten });
    return this.t(fix === -2 ? 'expressAdd2' : 'expressAdd1', { ten });
  }
  /** The split as the cherry shows it once the move is made. */
  protected cherryFirst() {
    const round = this.round();
    if (round.move === 'takeTen') return 0;
    if (round.move === 'fill') return this.shape().fill;
    return null;
  }
  protected buildingName(building: number) {
    return this.t(`village${Math.min(12, Math.max(1, building))}` as GondolaMessageKey);
  }
  protected cardCaption(card: RuleCard) {
    switch (card.kind) {
      case 'fill':
        return this.t('cardFill');
      case 'down':
        return this.t('cardDown');
      case 'teen':
        return this.t('cardTeen', { b: card.b, n: card.a + card.b });
      default:
        return this.t('cardTens', { a: card.a, b: card.b, n: card.a + card.b });
    }
  }

  protected selectPace(pace: GondolaPace) {
    this.pace.set(pace);
    try {
      this.document.defaultView?.localStorage.setItem(PACE_KEY, pace);
    } catch {
      /* The pace stays for this visit. */
    }
    if (!this.started()) return;
    if (pace === 'off') {
      this.stopCloud();
      this.cloud.set(0);
      if (this.round().cocoa === 'warm') this.round.update((r) => ({ ...r, cocoa: 'none' }));
    }
  }

  protected play() {
    this.stopTimers();
    this.round.set(this.fresh());
    this.saveFailed.set(false);
    this.newBest.set(false);
    this.newBuilding.set(null);
    this.started.set(true);
    this.sounds.play('start');
    this.beginTurn();
  }

  /** Sets up the current turn: the cloud starts, the tarp is planned, the scene is announced. */
  private beginTurn() {
    const round = this.round();
    this.splitStarted = Date.now();
    this.announceScene();
    this.startCloud();
    clearTimeout(this.tarpTimer);
    if (round.tarpDue) {
      this.tarpTimer = setTimeout(
        () => this.round.update((r) => (r.tarpDue ? { ...r, tarpDown: true } : r)),
        TARP_DELAY,
      );
    }
    if (round.golden && round.index > 0) this.sounds.play('whistle');
    this.armIdle();
    this.focusSplit();
  }

  /** Says what stands where, as sentences the screen reader reads at the start of a turn. */
  private announceScene() {
    const shape = this.shape();
    const item = this.item();
    const values = { ...shape, b: item.b };
    if (item.kind === 'sub') {
      this.status.set({
        key: shape.tens === 1 ? 'sceneFullOne' : 'sceneFullMany',
        values,
        extras: [shape.cabin === 1 ? 'sceneLooseOne' : 'sceneLooseMany', 'sceneNeed'],
      });
    } else if (shape.tens || shape.groupTens) {
      const extras: GondolaMessageKey[] = ['sceneCabin'];
      extras.push(
        shape.groupTens === 0
          ? 'sceneWait'
          : shape.groupTens === 1
            ? 'sceneWaitTensOne'
            : 'sceneWaitTensMany',
      );
      this.status.set({
        key: shape.tens === 1 ? 'sceneUpOne' : 'sceneUpMany',
        values,
        extras,
      });
    } else {
      this.status.set({ key: 'sceneAdd', values });
    }
  }

  /** The handle moved by a drag, tap or arrow key. */
  protected setSplit(split: number) {
    if (!this.splitting()) return;
    this.round.update((round) => ({
      ...round,
      split,
      help: round.help === 'seats' ? 'none' : round.help,
    }));
  }
  protected countGesture() {
    if (!this.splitting()) return;
    this.armIdle();
    this.round.update((round) => ({ ...round, moves: round.moves + 1 }));
  }

  /** "Hop in!" with the handle where it stands. */
  protected hopIn() {
    const round = this.round();
    if (!this.splitting() || round.split < 1) return;
    this.trySplit(round.split, round.moves);
  }

  /** A tap fallback button: one tap says how many go first. */
  protected tapSplit(first: number) {
    const round = this.round();
    if (!this.splitting()) return;
    this.round.set({ ...round, split: first });
    this.trySplit(first, round.moves + 1);
  }

  private trySplit(first: number, moves: number) {
    const round = this.round();
    const result = checkSplit(this.shape(), first);
    if (result === 'fill') {
      const clever = canSwap(this.stage(), round.items[round.index]) && round.item.a > round.item.b;
      this.accept('fill', moves, clever);
      return;
    }
    const add = round.item.kind === 'add';
    const splitSlips = round.splitSlips + 1;
    this.round.set({
      ...round,
      moves,
      splitSlips,
      streak: 0,
      quick: 0,
      golden: false,
      tarpDue: false,
      tarpDown: false,
      help: result === 'tooFew' ? 'seats' : 'none',
      card: splitSlips >= 2 ? ruleCard(round.item, 'split') : round.card,
      bounces: round.bounces + (result === 'tooMany' ? 1 : 0),
      jams: round.jams + (result === 'tooFew' ? 1 : 0),
    });
    const key =
      result === 'tooMany' ? (add ? 'tooManyAdd' : 'tooManySub') : add ? 'tooFewAdd' : 'tooFewSub';
    this.status.set({ key });
    this.sounds.play(result === 'tooMany' ? 'bounce' : 'jam');
  }

  protected takeTen() {
    if (!this.splitting() || !this.takeTenOffer()) return;
    this.accept('takeTen', this.round().moves + 1, true);
  }

  protected sendExpress() {
    if (!this.splitting() || !this.expressOffer()) return;
    this.accept('express', this.round().moves + 1, true);
  }

  protected swap() {
    const round = this.round();
    if (!this.swappable()) return;
    this.round.set({
      ...round,
      item: swapped(round.item),
      swapped: !round.swapped,
      split: 0,
      help: 'none',
    });
    this.status.set({ key: 'swapped' });
    this.sounds.play('swap');
    this.focusSplit();
  }

  protected revealBunnies() {
    if (!this.started() || this.round().showBunnies) return;
    this.round.update((round) => ({
      ...round,
      showBunnies: true,
      tarpDue: false,
      tarpDown: false,
    }));
    this.focusSplit();
  }

  /** The move fits: the group hops in, the full cabin rides off, then step 2. */
  private accept(move: Move, moves: number, clever: boolean) {
    const round = this.round();
    const seconds = (Date.now() - this.splitStarted) / 1000;
    const first = round.splitSlips === 0;
    this.round.set({
      ...round,
      phase: 'moving',
      move,
      moves,
      clever,
      help: 'none',
      card: null,
      hops: round.hops + 1,
      quick: first && quickSplit(this.shape(), seconds) ? round.quick + 1 : 0,
    });
    const add = round.item.kind === 'add';
    const key: GondolaMessageKey =
      move === 'takeTen'
        ? 'takeTenDone'
        : move === 'express'
          ? add
            ? 'expressAddDone'
            : 'expressSubDone'
          : clever
            ? 'swapDone'
            : add
              ? 'filled'
              : 'filledSub';
    this.status.set({ key });
    this.sounds.play(move === 'express' ? 'whistle' : 'hop');
    clearTimeout(this.timer);
    this.timer = setTimeout(
      () => {
        this.sounds.play('door');
        this.sounds.play('bell');
        this.round.update((r) =>
          r.phase === 'moving'
            ? { ...r, phase: 'answer', choices: answerChoices(r.item, this.random), typed: '' }
            : r,
        );
        this.status.set({ key: this.item().kind === 'add' ? 'askAdd' : 'askSub' });
        this.armIdle();
        this.focusAnswer();
      },
      this.sceneStage()?.ready() ? MOVE_DELAY_3D : MOVE_DELAY_FLAT,
    );
  }

  protected typeDigit(digit: number) {
    if (!this.answering()) return;
    this.round.update((round) =>
      round.typed.length >= 2
        ? round
        : { ...round, typed: (round.typed + digit).replace(/^0+(?=\d)/, '') },
    );
  }
  protected eraseDigit() {
    if (!this.answering()) return;
    this.round.update((round) => ({ ...round, typed: round.typed.slice(0, -1) }));
  }
  protected submitTyped() {
    const typed = this.round().typed;
    if (typed) this.answer(Number(typed));
  }

  protected answer(value: number) {
    const round = this.round();
    if (!this.answering()) return;
    const shape = this.shape();
    if (value === shape.answer) {
      this.solve(round);
      return;
    }
    const answerSlips = round.answerSlips + 1;
    this.round.set({
      ...round,
      answerSlips,
      typed: '',
      streak: 0,
      golden: false,
      help: 'pulse',
      card: answerSlips >= 2 ? ruleCard(round.item, 'answer') : round.card,
      slips: round.slips + 1,
    });
    const add = round.item.kind === 'add';
    const slip = classifyAnswer(round.item, round.move ?? 'fill', value);
    const key: GondolaMessageKey =
      slip === 'stopAtTen'
        ? add
          ? 'stopAtTenAdd'
          : 'stopAtTenSub'
        : slip === 'wrongWay'
          ? add
            ? 'wrongWayAdd'
            : 'wrongWaySub'
          : slip === 'keptTens'
            ? 'keptTens'
            : answerSlips === 1
              ? shape.tens || shape.groupTens
                ? 'firstWrongTens'
                : 'firstWrong'
              : 'tryAgain';
    this.status.set({ key });
    this.sounds.play('slip');
  }

  private solve(round: Round) {
    this.stopCloud();
    this.stopIdle();
    this.guided.set(countGuidedCabin() < GUIDED_CABINS);
    clearTimeout(this.tarpTimer);
    const firstTry = round.splitSlips === 0;
    const oneMove = firstTry && round.moves <= 1 && !round.showBunnies;
    const cocoa = round.cocoa === 'warm';
    const vip = round.vipTurn === round.index;
    const gain = turnPoints({
      firstTry,
      oneMove,
      cocoa,
      clever: round.clever,
      vip,
      golden: round.golden,
      big: this.big(),
    });
    const streak = firstTry && round.answerSlips === 0 ? round.streak + 1 : 0;
    const badges = (
      [
        [firstTry, 'badgeFirst'],
        [oneMove, 'badgeOneMove'],
        [round.clever, 'badgeClever'],
        [cocoa, 'badgeCocoa'],
        [vip, 'badgeVip'],
      ] as const
    )
      .filter(([earned]) => earned)
      .map(([, key]) => key);
    this.round.set({
      ...round,
      phase: 'solved',
      help: 'none',
      card: null,
      typed: '',
      streak,
      bestStreak: Math.max(round.bestStreak, streak),
      firstTries: round.firstTries + (firstTry ? 1 : 0),
      cleverCount: round.cleverCount + (round.clever ? 1 : 0),
      delivered: round.delivered + 1,
      log: [...round.log, firstTry],
      score: round.score + gain,
      gain,
      badges,
      cheers: round.cheers + 1,
    });
    this.hatchery.warm();
    const extras: GondolaMessageKey[] = [];
    if (firstTry) extras.push('firstTryBonus');
    if (cocoa) extras.push('cocoaBonus');
    if (vip) extras.push('vipBonus');
    if (streak === GOLDEN_STREAK) extras.push('goldenStart');
    this.status.set({
      key: 'right',
      values: { sum: this.sum(), answer: this.shape().answer },
      extras,
    });
    this.sounds.play('chime', streak * 2);
    this.timer = setTimeout(() => this.advance(), SOLVE_DELAY);
  }

  /** Moves on to the next cabin now instead of waiting. */
  protected advance() {
    clearTimeout(this.timer);
    const round = this.round();
    if (round.phase !== 'solved') return;
    if (round.index + 1 < this.turns()) {
      const index = round.index + 1;
      const tarpDue = round.quick >= TARP_STREAK && this.stage().representation !== 'numbers';
      this.round.set({
        ...this.turnState(round, index),
        tarpDue,
        quick: tarpDue ? 0 : round.quick,
      });
      this.beginTurn();
      return;
    }
    this.finish(round);
  }

  private finish(round: Round) {
    this.round.set({ ...round, phase: 'complete' });
    this.saveFailed.set(!this.record());
    const result = this.scores.record(this.levelId(), round.score);
    this.newBest.set(result.best);
    this.newBuilding.set(result.building);
    this.sounds.play('win');
    this.status.set(null);
    requestAnimationFrame(() => this.outcome()?.nativeElement.focus({ preventScroll: true }));
  }

  private record() {
    const stars = this.stars();
    return this.completion.finish({
      levelId: this.levelId(),
      completed: true,
      mastered: isMastered(this.stage(), stars),
      stars,
    });
  }

  protected celebrate() {
    if (this.completion.result()?.levelId === this.levelId() || this.record())
      void this.router.navigate(['/complete', this.levelId()]);
    else this.saveFailed.set(true);
  }

  // The snow cloud: it drifts in over the turn; on arrival the cocoa goes cold.
  private startCloud() {
    this.stopCloud();
    this.cloud.set(0);
    const seconds = cloudSeconds(this.pace(), this.stage());
    if (!seconds) {
      this.round.update((round) => ({ ...round, cocoa: 'none' }));
      return;
    }
    this.round.update((round) => ({ ...round, cocoa: 'warm' }));
    this.cloudTotal = seconds * 1000;
    this.cloudLeft = this.cloudTotal;
    this.armCloud();
  }

  private armCloud() {
    clearInterval(this.tick);
    this.cloudDue = Date.now() + this.cloudLeft;
    const step = () => {
      const left = Math.max(0, this.cloudDue - Date.now());
      this.cloud.set(1 - left / this.cloudTotal);
      if (left > 0) return;
      this.stopCloud();
      this.round.update((round) => ({ ...round, cocoa: 'cold', colds: round.colds + 1 }));
      this.status.set({ key: 'cold' });
      this.sounds.play('brrr');
    };
    step();
    this.tick = setInterval(step, 250);
  }

  private stopCloud() {
    clearInterval(this.tick);
    this.tick = undefined;
  }

  private stopTimers() {
    this.stopIdle();
    clearTimeout(this.timer);
    clearTimeout(this.tarpTimer);
    this.stopCloud();
  }

  protected visibilityChanged() {
    const round = this.round();
    if (round.cocoa !== 'warm' || round.phase === 'solved' || round.phase === 'complete') return;
    if (this.document.hidden && this.tick) {
      this.cloudLeft = Math.max(0, this.cloudDue - Date.now());
      this.stopCloud();
    } else if (!this.document.hidden && !this.tick && this.started() && !this.coaching()) {
      this.armCloud();
    }
  }

  /** Digits pick how many hop in (step 1) or type the answer (step 2). */
  protected onKey(event: KeyboardEvent) {
    if (
      event.repeat ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      !this.started() ||
      this.coaching()
    )
      return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('textarea, select, input:not([type="range"])')) return;
    const digit = /^\d$/.test(event.key) ? Number(event.key) : null;
    if (this.splitting() && digit !== null && digit >= 1 && digit <= this.shape().group) {
      if (target?.closest('input[type="range"]')) return;
      event.preventDefault();
      this.tapSplit(digit);
      return;
    }
    if (!this.answering() || this.stage().choices) return;
    if (digit !== null) {
      event.preventDefault();
      this.typeDigit(digit);
    } else if (event.key === 'Backspace') {
      event.preventDefault();
      this.eraseDigit();
    } else if (event.key === 'Enter' && !target?.closest('button')) {
      event.preventDefault();
      this.submitTyped();
    }
  }

  /** Opens the "how to ride" film; the snow cloud waits until it closes. */
  protected openHelp() {
    if (this.coaching()) return;
    this.stopIdle();
    if (this.tick) {
      this.cloudLeft = Math.max(0, this.cloudDue - Date.now());
      this.stopCloud();
    }
    this.coaching.set(true);
  }

  protected closeHelp() {
    this.coaching.set(false);
    const round = this.round();
    if (round.cocoa === 'warm' && round.phase !== 'solved' && round.phase !== 'complete')
      this.armCloud();
    if (round.phase === 'split' || round.phase === 'answer') this.armIdle();
    if (round.phase === 'split') this.focusSplit();
    else if (round.phase === 'answer') this.focusAnswer();
  }

  /** After six quiet seconds the next thing to tap hops again. */
  private armIdle() {
    this.stopIdle();
    this.idleTimer = setTimeout(() => this.idle.set(true), IDLE_MS);
  }

  private stopIdle() {
    clearTimeout(this.idleTimer);
    this.idle.set(false);
  }

  protected statusText() {
    const status = this.status();
    if (!status) return '';
    return [status.key, ...(status.extras ?? [])]
      .map((key) => this.t(key, status.values))
      .join(' ');
  }

  private focusSplit() {
    requestAnimationFrame(() => {
      const split = this.splitControl();
      if (split && !this.numbersOnly()) split.focus();
      else
        this.host.nativeElement
          .querySelector<HTMLElement>('.tap-button:not([disabled])')
          ?.focus({ preventScroll: true });
    });
  }

  private focusAnswer() {
    requestAnimationFrame(() =>
      this.host.nativeElement
        .querySelector<HTMLElement>('.choice, .key')
        ?.focus({ preventScroll: true }),
    );
  }

  private readPace(): GondolaPace {
    try {
      return parseGondolaPace(this.document.defaultView?.localStorage.getItem(PACE_KEY));
    } catch {
      return 'off';
    }
  }

  /** The per-turn part of the state reset for turn `index`; the round's tallies carry on. */
  private turnState(round: Round, index: number): Round {
    return {
      ...round,
      index,
      item: round.items[index],
      swapped: false,
      phase: 'split',
      split: 0,
      moves: 0,
      splitSlips: 0,
      answerSlips: 0,
      move: null,
      clever: false,
      typed: '',
      choices: [],
      showBunnies: false,
      tarpDue: false,
      tarpDown: false,
      help: 'none',
      card: null,
      cocoa: 'none',
      golden: round.streak >= GOLDEN_STREAK,
      gain: 0,
      badges: [],
    };
  }

  private fresh(): Round {
    const stage = this.stage();
    const items = createRound(stage, this.random);
    const base: Round = {
      items,
      index: 0,
      item: items[0],
      swapped: false,
      phase: 'split',
      split: 0,
      moves: 0,
      splitSlips: 0,
      answerSlips: 0,
      move: null,
      clever: false,
      typed: '',
      choices: [],
      showBunnies: false,
      tarpDue: false,
      tarpDown: false,
      help: 'none',
      card: null,
      cocoa: 'none',
      vipTurn: Math.floor(this.random() * (stage.turns - 1)),
      streak: 0,
      bestStreak: 0,
      golden: false,
      quick: 0,
      firstTries: 0,
      cleverCount: 0,
      delivered: 0,
      log: [],
      score: 0,
      gain: 0,
      badges: [],
      hops: 0,
      bounces: 0,
      jams: 0,
      cheers: 0,
      slips: 0,
      colds: 0,
    };
    return this.turnState(base, 0);
  }
}
