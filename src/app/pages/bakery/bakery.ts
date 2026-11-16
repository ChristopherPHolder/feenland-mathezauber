import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
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
import { dragonById } from '../hatchery/dragons';
import { HatcheryStore } from '../hatchery/hatchery-store';
import { BakeryCard } from './bakery-card';
import { BakeryCoach } from './bakery-coach';
import { BakeryDemo, DemoKind } from './bakery-demo';
import { countGuidedBake, GUIDED_BAKES, guidedBakes, IDLE_GUIDE } from './bakery-guide';
import { ANIMALS, BakeryFrame, Customer } from './bakery-frame';
import {
  BAKERY_PACES,
  BakeryPace,
  bakePoints,
  bakeryPosition,
  bakeryStage,
  bakeryStages,
  createRound,
  CutDir,
  factKey,
  GOLDEN_STREAK,
  isMastered,
  ORDERS,
  ovenSeconds,
  parseBakeryPace,
  POINTS,
  rehearse,
  ROUND_LENGTH,
  roundStars,
  TOTAL_STAGES,
  type Fact,
} from './bakery-levels';
import { bakeryText, BakeryMessageKey } from './bakery-messages';
import {
  addGhost,
  answerGhost,
  answerPiece,
  answerTotal,
  canCut,
  canTurn,
  cut,
  doneCutting,
  ghostDir,
  ghostFact,
  ghostLine,
  guideGaps,
  Help,
  orderPieces,
  OrderState,
  pieceChoices,
  removeGhost,
  shownFact,
  startOrder,
  trickCard,
  tryAnotherWay,
  turn,
  uncut,
  usedTrick,
} from './bakery-order';
import { BakeryReward, BakeryRewardKind } from './bakery-reward';
import { BakeryScores } from './bakery-scores';
import { BakerySounds } from './bakery-sounds';
import { BakeryTray } from './bakery-tray';
import { fitTray, nearestGap, pieceAt, trayGeometry } from './tray-geometry';

type Note = { readonly key: BakeryMessageKey; readonly values?: Record<string, string | number> };

interface Counters {
  readonly chops: number;
  readonly turns: number;
  readonly rights: number;
  readonly wrongs: number;
  readonly twins: number;
  readonly bakes: number;
  readonly nibbles: number;
  readonly pulses: number;
}

interface Round {
  readonly orders: readonly Fact[];
  readonly index: number;
  readonly order: OrderState;
  /** Four choices for the piece (or ghost tray) being named. */
  readonly choices: readonly number[];
  /** What the child typed on the number pad. */
  readonly entry: string;
  readonly score: number;
  /** Points the last bake (or second way) paid, and its bonus tags, for the reward card. */
  readonly gain: number;
  readonly tags: readonly BakeryMessageKey[];
  readonly reward: BakeryRewardKind | null;
  readonly streak: number;
  readonly bestStreak: number;
  readonly firstTries: number;
  readonly tricks: number;
  /** Menu board squares filled for the first time this round. */
  readonly squares: number;
  /** The oven timer ran out on this tray. */
  readonly crispy: boolean;
  /** Facts already put back later in this round. */
  readonly rehearsed: readonly string[];
  readonly complete: boolean;
  readonly counters: Counters;
  readonly pulse: BakeryFrame['pulse'];
  readonly help: Help | null;
  readonly note: Note | null;
}

const PACE_KEY = 'feenland.bakery-pace.v1';
const ADVANCE_DELAY = 4200;
const BANNER_TIME = 2600;
const NO_COUNTERS: Counters = {
  chops: 0,
  turns: 0,
  rights: 0,
  wrongs: 0,
  twins: 0,
  bakes: 0,
  nibbles: 0,
  pulses: 0,
};

@Component({
  selector: 'app-bakery',
  imports: [
    RouterLink,
    Icon,
    GameHeader,
    ThreeStage,
    BakeryTray,
    BakeryReward,
    BakeryCard,
    BakeryDemo,
    BakeryCoach,
  ],
  providers: [BakerySounds],
  templateUrl: './bakery.html',
  styleUrls: ['./bakery.css', './bakery-play.css', './bakery-guide.css'],
  host: {
    '(document:keydown)': 'onKey($event)',
    '(document:visibilitychange)': 'visibilityChanged()',
  },
})
export class Bakery {
  protected readonly i = inject(LocaleService);
  private readonly p = inject(ProgressService);
  private readonly hatchery = inject(HatcheryStore);
  private readonly completion = inject(CompletionService);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  protected readonly sounds = inject(BakerySounds);
  protected readonly scores = inject(BakeryScores);
  private readonly params = toSignal(inject(ActivatedRoute).paramMap);

  protected readonly total = TOTAL_STAGES;
  protected readonly orderSlots = Array.from({ length: ROUND_LENGTH }, (_, index) => index);
  protected readonly starSlots = [1, 2, 3];
  protected readonly digits = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];
  protected readonly stage = computed(
    () => bakeryStage(this.params()?.get('id')) ?? bakeryStage('bakery-1')!,
  );
  protected readonly levelId = computed(() => `bakery-${this.stage().stage}`);
  protected readonly position = computed(() => bakeryPosition(this.stage()));
  protected readonly levelLinks = bakeryStages.map((stage, index) => ({
    stage: stage.stage,
    position: index + 1,
    route: ['/adventure', `bakery-${stage.stage}`],
  }));
  protected readonly nextLink = computed(() => {
    const next = bakeryStages[this.position()];
    return next ? ['/adventure', `bakery-${next.stage}`] : null;
  });

  protected readonly round = linkedSignal<Round>(() => this.fresh());
  protected readonly started = linkedSignal<boolean>(() => {
    this.stage();
    return false;
  });
  protected readonly paces = BAKERY_PACES;
  protected readonly pace = signal<BakeryPace>(this.readPace());
  protected readonly timed = computed(() => this.pace() !== 'off');
  protected readonly secondsLeft = signal(0);
  protected readonly ovenTotal = signal(0);
  protected readonly knife = signal<{ dir: CutDir; at: number }>({ dir: 'rows', at: 1 });
  protected readonly showCookies = signal(false);
  protected readonly banner = signal<BakeryMessageKey | null>(null);
  protected readonly boardSize = signal({ width: 480, height: 400 });
  protected readonly saveFailed = signal(false);
  protected readonly newBest = signal(false);
  protected readonly treatAdded = signal(false);
  /** Whether the 3D bakery is drawing; the reward card waits for the oven in 3D. */
  protected readonly scene3d = signal(false);

  protected readonly coachOpen = signal(false);
  /** The first few trays on a device always show what to tap next. */
  private readonly learning = signal(guidedBakes() < GUIDED_BAKES);
  /** The child has waited a while without tapping. */
  private readonly idle = signal(false);
  /** The film on the level card and in the ? dialog: the level's trick with made-up numbers. */
  protected readonly demoCard = computed(() => trickCard(this.stage(), this.order()));
  protected readonly demoKind = computed<DemoKind>(() => {
    const trick = this.stage().trick;
    return trick === 'read' || trick === 'turn' || trick === 'ghost' ? trick : 'cut';
  });
  /** Which controls hop to say "tap one of these": always while learning, else after a wait. */
  protected readonly nextTap = computed(() => {
    if (!this.started() || this.round().complete || this.coachOpen()) return null;
    if (!this.learning() && !this.idle()) return null;
    const phase = this.phase();
    return phase === 'cut'
      ? 'knife'
      : phase === 'total'
        ? 'pad'
        : phase === 'baked'
          ? null
          : 'choices';
  });
  protected readonly order = computed(() => this.round().order);
  protected readonly phase = computed(() => this.order().phase);
  protected readonly shown = computed(() => shownFact(this.order()));
  protected readonly cake = computed(() => this.round().index === ROUND_LENGTH - 1);
  protected readonly pieces = computed(() => orderPieces(this.order()));
  protected readonly guide = computed(() => guideGaps(this.stage(), this.order()));
  protected readonly ghostOffer = computed(() => ghostDir(this.stage(), this.order()));
  protected readonly ghostTray = computed(() => ghostFact(this.order()));
  protected readonly golden = computed(
    () => this.round().streak >= GOLDEN_STREAK && this.order().slips === 0,
  );
  protected readonly canTurnTray = computed(() => this.stage().stage >= 2 && canTurn(this.order()));
  protected readonly customer = computed<Customer>(() => {
    const index = this.round().index;
    const hatched = this.hatchery.hatchery().hatched;
    if (hatched.length && (index === 2 || index === ROUND_LENGTH - 1))
      return `dragon:${hatched[(index + this.stage().stage) % hatched.length]}`;
    return ANIMALS[(index + this.stage().stage) % ANIMALS.length];
  });
  protected readonly customerName = computed(() => {
    const customer = this.customer();
    if (customer.startsWith('dragon:')) {
      const dragon = dragonById(customer.slice(7));
      return dragon ? this.hatchery.name(dragon) : this.t('fox');
    }
    return this.t(customer as 'fox' | 'rabbit' | 'hedgehog' | 'squirrel');
  });
  protected readonly ovenShare = computed(() =>
    this.ovenTotal() ? Math.min(1, this.secondsLeft() / this.ovenTotal()) : 0,
  );
  protected readonly stars = computed(() => roundStars(this.round().firstTries));
  protected readonly best = computed(() => this.scores.best()[this.levelId()] ?? 0);
  protected readonly card = computed(() =>
    this.round().help?.card ? trickCard(this.stage(), this.order()) : null,
  );
  protected readonly cardLines = computed(() => {
    const card = this.card();
    if (!card) return [];
    const { rows, cols, parts } = card;
    if (parts.length === 1) {
      if (this.stage().trick === 'turn')
        return [this.t('cardTurn', { a: cols, b: rows }), `${rows} × ${cols} = ${rows * cols}`];
      const counts = Array.from({ length: Math.min(rows, 3) }, (_, i) => cols * (i + 1));
      return [
        this.t('cardCount', { list: counts.join(', ') }),
        `${rows} × ${cols} = ${rows * cols}`,
      ];
    }
    if (parts[1] < 0) {
      const full = parts[0] * cols;
      return [`${parts[0]} × ${cols} = ${full}`, `${full} − ${cols} = ${full - cols}`];
    }
    const values = parts.map((part) => part * cols);
    return [
      ...parts.map((part, index) => `${part} × ${cols} = ${values[index]}`),
      `${values.join(' + ')} = ${rows * cols}`,
    ];
  });

  protected readonly geometry = computed(() => {
    const order = this.order();
    const shown = this.shown();
    return trayGeometry({ ...shown, dir: order.dir, cuts: order.cuts, ghost: order.ghost });
  });
  protected readonly fit = computed(() =>
    fitTray(this.boardSize().width, this.boardSize().height, this.geometry()),
  );
  /** Labels on each piece, placed over the tray in board pixels. */
  protected readonly pieceLabels = computed(() => {
    const order = this.order();
    const fit = this.fit();
    const geometry = this.geometry();
    if (order.ghost && order.ghostValue === null) {
      const full = this.ghostTray()!;
      return [
        {
          index: -1,
          text: `${full.rows} × ${full.cols}`,
          left: fit.x + fit.width / 2,
          top: fit.y + fit.height / 2,
          active: true,
          named: false,
        },
      ];
    }
    if (!order.cuts.length || order.phase === 'baked') return [];
    return geometry.pieceRects.map((rect, index) => {
      const piece = geometry.pieces[index];
      const value = order.values[index];
      return {
        index,
        text:
          value === null || value === undefined
            ? `${piece.rows} × ${piece.cols}`
            : `${piece.rows} × ${piece.cols} = ${value}`,
        left: fit.x + (rect.x + rect.width / 2) * fit.scale,
        top: fit.y + (rect.y + rect.height / 2) * fit.scale,
        active: order.phase === 'pieces' && order.active === index,
        named: value !== null && value !== undefined,
      };
    });
  });
  /** Row and column counts along the edges of each piece, for the labelled trays. */
  protected readonly sideLabels = computed(() => {
    const order = this.order();
    if (
      this.stage().look === 'cookies' ||
      order.phase === 'baked' ||
      (order.ghost && order.ghostValue === null)
    )
      return [];
    const fit = this.fit();
    const geometry = this.geometry();
    return geometry.pieceRects.flatMap((rect, index) => {
      const piece = geometry.pieces[index];
      return [
        {
          text: piece.rows,
          left: fit.x + rect.x * fit.scale - 2,
          top: fit.y + (rect.y + rect.height / 2) * fit.scale,
          side: 'left',
        },
        {
          text: piece.cols,
          left: fit.x + (rect.x + rect.width / 2) * fit.scale,
          top: fit.y + rect.y * fit.scale - 2,
          side: 'top',
        },
      ];
    });
  });
  protected readonly knifeHandle = computed(() => {
    const knife = this.knife();
    const fit = this.fit();
    const geometry = this.geometry();
    if (knife.dir === 'rows') {
      const y = geometry.rowGaps[knife.at - 1] ?? 0;
      return { left: fit.x, top: fit.y + y * fit.scale };
    }
    const x = geometry.colGaps[knife.at - 1] ?? 0;
    return { left: fit.x + x * fit.scale, top: fit.y };
  });

  protected readonly frame = computed<BakeryFrame>(() => {
    const round = this.round();
    const order = round.order;
    const shown = this.shown();
    const timer = this.timed() && this.ovenTotal() ? this.ovenShare() : null;
    return {
      order: round.index,
      rows: shown.rows,
      cols: shown.cols,
      dir: order.dir,
      cuts: order.cuts,
      ghost: order.ghost,
      look: this.stage().look,
      cookies: this.showCookies(),
      values: order.values,
      ghostValue: order.ghostValue,
      active: order.phase === 'pieces' ? order.active : null,
      phase: round.complete ? 'baked' : order.phase,
      knife: order.phase === 'cut' ? this.knife() : null,
      guide: this.guide(),
      browning: timer === null ? 0 : 1 - timer,
      crispy: round.crispy,
      timer: order.phase === 'baked' ? null : timer,
      golden: this.golden(),
      cake: this.cake(),
      customer: this.customer(),
      board: this.scores.board(),
      treats: this.scores.treats(),
      finished: round.complete,
      ...round.counters,
      pulse: round.pulse,
    };
  });
  protected readonly loadWorld: WorldLoader<BakeryFrame> = () =>
    import('./bakery-world').then((m) => m.BakeryWorld);

  protected readonly reward = computed(() => {
    const round = this.round();
    if (round.order.phase !== 'baked' || !round.reward || round.complete) return null;
    const cheers: Record<BakeryRewardKind, BakeryMessageKey> = {
      baked: 'rewardBaked',
      perfect: 'rewardPerfect',
      golden: 'rewardGolden',
      cake: 'rewardCake',
      second: 'rewardSecond',
    };
    return {
      kind: round.reward,
      cheer: this.t(cheers[round.reward]),
      tags: round.tags.map((key) => this.t(key)),
      points: this.t('rewardPoints', { n: this.i.format(round.gain) }),
    };
  });

  private readonly outcome = viewChild<ElementRef<HTMLElement>>('outcome');
  private readonly boardRef = viewChild<ElementRef<HTMLElement>>('board');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private timer?: ReturnType<typeof setTimeout>;
  private idleTimer?: ReturnType<typeof setTimeout>;
  private bannerTimer?: ReturnType<typeof setTimeout>;
  private tick?: ReturnType<typeof setInterval>;
  private ovenDue = 0;
  private ovenRemaining = 0;
  private resize?: ResizeObserver;
  private drag: { pointer: number; dir: CutDir | null } | null = null;

  constructor() {
    effect(() => {
      if (this.started()) this.p.explore('tens');
    });
    // Measure the board so the knife and piece targets sit on the tray, in 3D and flat.
    effect(() => {
      const board = this.boardRef()?.nativeElement;
      this.resize?.disconnect();
      if (!board || typeof ResizeObserver === 'undefined') return;
      this.resize = new ResizeObserver(() => {
        if (board.clientWidth && board.clientHeight)
          this.boardSize.set({ width: board.clientWidth, height: board.clientHeight });
      });
      this.resize.observe(board);
    });
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.timer);
      clearTimeout(this.bannerTimer);
      clearTimeout(this.idleTimer);
      clearInterval(this.tick);
      this.resize?.disconnect();
    });
    afterNextRender(() => this.resetKnife());
  }

  protected t(key: BakeryMessageKey, values: Record<string, string | number> = {}) {
    return bakeryText(this.i.locale(), key, values);
  }
  protected levelKey(stage: number) {
    return `bakery${stage}` as MessageKey;
  }
  protected tipKey(stage: number) {
    return `tip${stage}` as BakeryMessageKey;
  }
  protected paceSeconds(pace: BakeryPace) {
    return ovenSeconds(pace, { rows: 6, cols: 7 }, this.stage().cut);
  }

  protected selectPace(pace: BakeryPace) {
    this.pace.set(pace);
    try {
      this.document.defaultView?.localStorage.setItem(PACE_KEY, pace);
    } catch {
      /* The choice stays for this visit. */
    }
    if (this.started() && pace === 'off') {
      this.stopOven();
      this.ovenTotal.set(0);
    }
  }

  protected play() {
    clearTimeout(this.timer);
    this.stopOven();
    this.round.set(this.fresh());
    this.saveFailed.set(false);
    this.newBest.set(false);
    this.treatAdded.set(false);
    this.started.set(true);
    this.sounds.play('start');
    this.beginOrder();
    this.armIdle();
  }

  // ---- Cutting ----------------------------------------------------------------------------

  /** Moves the knife to a gap, skipping lines already cut. */
  protected moveKnife(dir: CutDir, at: number) {
    if (this.phase() !== 'cut') return;
    const order = this.order();
    if (order.dir && order.dir !== dir) return;
    const size = dir === 'rows' ? this.shown().rows : this.shown().cols;
    if (at < 1 || at >= size) return;
    if (this.knife().dir !== dir || this.knife().at !== at) this.sounds.play('knife');
    this.knife.set({ dir, at });
  }

  protected nudgeKnife(step: number, dir = this.knife().dir) {
    const order = this.order();
    if (order.dir && order.dir !== dir) return;
    const size = dir === 'rows' ? this.shown().rows : this.shown().cols;
    let at = this.knife().dir === dir ? this.knife().at : Math.ceil(size / 2);
    do at += step;
    while (order.cuts.includes(at) && at > 0 && at < size);
    this.moveKnife(dir, Math.max(1, Math.min(size - 1, at)));
  }

  protected setKnifeDir(dir: CutDir) {
    if (this.phase() !== 'cut' || (this.order().dir && this.order().dir !== dir)) return;
    const size = dir === 'rows' ? this.shown().rows : this.shown().cols;
    if (size < 2) return;
    this.knife.set({ dir, at: this.freeGap(dir, Math.floor(size / 2)) });
  }

  protected canCutHere() {
    return canCut(this.stage(), this.order(), this.knife().dir, this.knife().at);
  }

  protected doCut() {
    const round = this.round();
    const knife = this.knife();
    const hadGuide = !!this.guide();
    const step = cut(this.stage(), round.order, knife.dir, knife.at);
    if (step.result === 'invalid') return;
    if (step.result === 'same') {
      this.patch({ order: step.state, note: { key: 'sameCut' }, help: null });
      this.sounds.play('oops');
      this.resetKnife();
      return;
    }
    const counters = { ...round.counters, chops: round.counters.chops + 1 };
    this.sounds.play('chop');
    if (step.result === 'more') {
      this.patch({ order: step.state, counters, note: { key: 'statusCutMore' }, help: null });
      this.resetKnife();
      return;
    }
    this.sounds.play('slide');
    this.toPieces(step.state, counters, hadGuide);
  }

  protected finishCutting() {
    const round = this.round();
    const hadGuide = !!guideGaps(this.stage(), { ...round.order, cuts: [] });
    const step = doneCutting(round.order);
    if (step.result === 'same') {
      this.patch({ order: step.state, note: { key: 'sameCut' } });
      return;
    }
    if (step.result === 'cut') this.toPieces(step.state, round.counters, hadGuide);
  }

  private toPieces(order: OrderState, counters: Counters, hadGuide: boolean) {
    const pieces = orderPieces(order);
    const twins =
      pieces.length > 1 &&
      pieces.every((p) => p.rows === pieces[0].rows && p.cols === pieces[0].cols);
    const list = this.joinList(pieces.map((p) => `${p.rows} × ${p.cols}`));
    const trick = !order.firstWay && usedTrick(this.stage(), order);
    const key: BakeryMessageKey =
      hadGuide && !trick && !order.firstWay
        ? 'cutWorks'
        : pieces.length > 2
          ? 'cutDoneMany'
          : 'cutDone';
    if (twins) this.sounds.play('boing');
    this.patch({
      order,
      counters: twins ? { ...counters, twins: counters.twins + 1 } : counters,
      choices: this.choicesFor(order),
      note: twins && key !== 'cutWorks' ? { key: 'twinsCut' } : { key, values: { pieces: list } },
      help: null,
    });
    this.focusChoices();
  }

  protected join() {
    const order = uncut(this.order());
    if (order === this.order()) return;
    this.patch({ order, note: null, help: null });
    this.resetKnife();
  }

  protected turnTray() {
    if (!this.canTurnTray()) return;
    const round = this.round();
    const order = turn(round.order);
    const shown = shownFact(order);
    this.patch({
      order,
      counters: { ...round.counters, turns: round.counters.turns + 1 },
      note: { key: 'turned', values: { rows: shown.rows, cols: shown.cols } },
      help: null,
    });
    this.sounds.play('slide');
    this.resetKnife();
  }

  protected addGhostRow() {
    const order = addGhost(this.stage(), this.order());
    if (order === this.order()) return;
    const full = ghostFact(order)!;
    this.patch({
      order,
      choices: pieceChoices(full),
      note: { key: 'ghostAdded', values: { rows: full.rows, cols: full.cols } },
      help: null,
    });
    this.sounds.play('pop');
    this.focusChoices();
  }

  protected dropGhost() {
    const order = removeGhost(this.order());
    if (order === this.order()) return;
    this.patch({ order, note: null, help: null });
    this.resetKnife();
  }

  // ---- Naming pieces ----------------------------------------------------------------------

  protected selectPiece(index: number) {
    const order = this.order();
    if (order.phase !== 'pieces' || order.values[index] !== null || order.active === index) return;
    const next = { ...order, active: index };
    this.patch({ order: next, choices: this.choicesFor(next), help: null, note: null });
  }

  protected choose(value: number) {
    const round = this.round();
    const order = round.order;
    if (order.phase === 'ghost') {
      const answer = answerGhost(order, value);
      if (!answer.right) return this.slip(answer.state, answer.help);
      this.scores.bake(ghostFact(order)!);
      this.sounds.play('crunch');
      this.patch({
        order: answer.state,
        counters: {
          ...round.counters,
          rights: round.counters.rights + 1,
          nibbles: round.counters.nibbles + 1,
        },
        note: { key: 'ghostRight', values: { n: ghostLine(order) } },
        help: null,
        entry: '',
      });
      this.focusPad();
      return;
    }
    if (order.phase !== 'pieces') return;
    const piece = this.pieces()[order.active];
    const answer = answerPiece(order, order.active, value);
    if (!answer.right) return this.slip(answer.state, answer.help);
    this.scores.bake(piece);
    const counters = {
      ...round.counters,
      rights: round.counters.rights + 1,
      twins: round.counters.twins + (answer.twins ? 1 : 0),
    };
    const values = { a: piece.rows, b: piece.cols, n: value };
    this.sounds.play(answer.twins ? 'boing' : 'pop');
    if (answer.state.phase === 'baked') {
      // The second way is done: the bonus, and on to the next order.
      this.patch({
        order: answer.state,
        counters: { ...counters, bakes: counters.bakes + 1 },
        score: round.score + POINTS.secondWay,
        gain: POINTS.secondWay,
        tags: [],
        reward: 'second',
        note: { key: 'secondWayDone' },
        help: null,
      });
      this.sounds.play('ding', round.streak);
      this.timer = setTimeout(() => this.next(), ADVANCE_DELAY);
      return;
    }
    this.patch({
      order: answer.state,
      counters,
      choices: this.choicesFor(answer.state),
      note: { key: answer.twins ? 'twinRight' : 'pieceRight', values },
      help: null,
      entry: '',
    });
    if (answer.state.phase === 'total') this.focusPad();
  }

  // ---- The total --------------------------------------------------------------------------

  protected type(digit: number) {
    if (this.phase() !== 'total') return;
    const entry = this.round().entry;
    if (entry.length >= 3) return;
    this.patch({ entry: entry === '0' ? String(digit) : entry + digit });
  }

  protected erase() {
    if (this.phase() !== 'total') return;
    this.patch({ entry: this.round().entry.slice(0, -1) });
  }

  protected submit() {
    const round = this.round();
    if (round.order.phase !== 'total' || !round.entry) return;
    const answer = answerTotal(round.order, Number(round.entry));
    if (!answer.right) {
      this.slip(answer.state, answer.help);
      this.patch({ entry: '' });
      return;
    }
    this.bake(answer.state);
  }

  private bake(order: OrderState) {
    this.stopOven();
    const round = this.round();
    const stage = this.stage();
    const shown = shownFact(order);
    const firstTry = order.slips === 0;
    const trick = usedTrick(stage, order);
    const perfect = this.timed() && this.ovenTotal() > 0 && !round.crispy;
    const golden = round.streak >= GOLDEN_STREAK && firstTry;
    const cake = this.cake();
    const gain = bakePoints({ firstTry, trick, perfect, golden, cake });
    const streak = firstTry ? round.streak + 1 : 0;
    const squares = this.scores.bake(shown, trick);
    this.hatchery.warm();
    let orders = round.orders;
    let rehearsed = round.rehearsed;
    if (firstTry) this.scores.learn(order.fact);
    else {
      this.scores.miss(order.fact);
      if (!rehearsed.includes(factKey(order.fact))) {
        orders = rehearse(orders, round.index, order.fact);
        rehearsed = [...rehearsed, factKey(order.fact)];
      }
    }
    const tags: BakeryMessageKey[] = [];
    if (firstTry) tags.push('rewardPerfect');
    if (trick) tags.push('trickBonus');
    if (perfect) tags.push('perfectBonus');
    this.patch({
      order,
      orders,
      rehearsed,
      score: round.score + gain,
      gain,
      tags: tags.filter((tag) => tag !== 'rewardPerfect' || !firstTry || golden || cake),
      reward: cake ? 'cake' : golden ? 'golden' : firstTry ? 'perfect' : 'baked',
      streak,
      bestStreak: Math.max(round.bestStreak, streak),
      firstTries: round.firstTries + (firstTry ? 1 : 0),
      tricks: round.tricks + (trick ? 1 : 0),
      squares: round.squares + squares,
      counters: {
        ...round.counters,
        rights: round.counters.rights + 1,
        bakes: round.counters.bakes + 1,
      },
      note: { key: firstTry ? 'bakedFirst' : 'baked' },
      help: null,
      entry: '',
    });
    if (countGuidedBake() >= GUIDED_BAKES) this.learning.set(false);
    this.sounds.play('oven');
    this.sounds.play('ding', streak);
    if (streak === GOLDEN_STREAK) {
      this.sounds.play('trumpet');
      this.showBanner('goldenBanner');
    }
    if (!stage.anotherWay) this.timer = setTimeout(() => this.next(), ADVANCE_DELAY);
    requestAnimationFrame(() =>
      this.host.nativeElement.querySelector<HTMLElement>('.after-bake .primary')?.focus({
        preventScroll: true,
      }),
    );
  }

  /** "Can you cut it another way?" after a baked tray. */
  protected another() {
    clearTimeout(this.timer);
    const order = tryAnotherWay(this.order());
    if (order === this.order()) return;
    this.patch({ order, note: { key: 'statusCutAgain' }, help: null, reward: null });
    this.resetKnife();
    this.focusKnife();
  }

  protected next() {
    clearTimeout(this.timer);
    const round = this.round();
    if (round.order.phase !== 'baked' || round.complete) return;
    if (round.index + 1 < ROUND_LENGTH) {
      const index = round.index + 1;
      this.patch({
        index,
        order: startOrder(this.stage(), round.orders[index]),
        choices: [],
        entry: '',
        crispy: false,
        reward: null,
        note: null,
        help: null,
      });
      if (index === ROUND_LENGTH - 1) this.showBanner('cakeBanner');
      this.beginOrder();
      return;
    }
    this.patch({ complete: true, reward: null });
    const stars = this.stars();
    this.saveFailed.set(!this.record());
    const result = this.scores.finish(this.levelId(), round.score);
    this.newBest.set(result.best);
    this.treatAdded.set(result.treat);
    this.sounds.play('jingle');
    requestAnimationFrame(() => this.outcome()?.nativeElement.focus({ preventScroll: true }));
    void stars;
  }

  private slip(order: OrderState, help: Help | undefined) {
    const round = this.round();
    this.sounds.play('oops');
    this.patch({
      order,
      streak: 0,
      counters: {
        ...round.counters,
        wrongs: round.counters.wrongs + 1,
        pulses: round.counters.pulses + (help?.pulse ? 1 : 0),
      },
      pulse: help?.pulse ? { kind: help.pulse, piece: help.piece ?? 0 } : round.pulse,
      help: help ?? null,
      note: null,
    });
  }

  // ---- Board pointer: tap or drag the knife to a gap, tap a piece to name it ----------------

  protected pointerDown(event: PointerEvent, fromHandle = false) {
    const point = this.trayPoint(event);
    if (!point) return;
    const phase = this.phase();
    if (phase === 'pieces') {
      const index = pieceAt(this.geometry(), point.x, point.y);
      if (index >= 0) this.selectPiece(index);
      return;
    }
    if (phase !== 'cut') return;
    const dir = fromHandle ? this.knife().dir : this.order().dir;
    const gap = nearestGap(this.geometry(), point.x, point.y, dir);
    if (!gap) return;
    event.preventDefault();
    this.drag = { pointer: event.pointerId, dir: gap.dir };
    (event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId);
    this.moveToFree(gap.dir, gap.at);
  }

  protected pointerMove(event: PointerEvent) {
    if (!this.drag || this.drag.pointer !== event.pointerId) return;
    const point = this.trayPoint(event);
    if (!point) return;
    const gap = nearestGap(this.geometry(), point.x, point.y, this.drag.dir);
    if (gap) this.moveToFree(gap.dir, gap.at);
  }

  protected pointerUp() {
    this.drag = null;
  }

  private moveToFree(dir: CutDir, at: number) {
    if (this.order().cuts.includes(at) && this.order().dir === dir) return;
    this.moveKnife(dir, at);
  }

  private trayPoint(event: PointerEvent) {
    const board = this.boardRef()?.nativeElement;
    if (!board) return null;
    const box = board.getBoundingClientRect();
    const fit = this.fit();
    return {
      x: (event.clientX - box.left - fit.x) / fit.scale,
      y: (event.clientY - box.top - fit.y) / fit.scale,
    };
  }

  /** Arrows move the knife (up and down between rows, left and right between columns). */
  protected knifeKey(event: KeyboardEvent) {
    const moves: Record<string, [CutDir, number]> = {
      ArrowUp: ['rows', -1],
      ArrowDown: ['rows', 1],
      ArrowLeft: ['cols', -1],
      ArrowRight: ['cols', 1],
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      if (this.knife().dir !== move[0]) this.setKnifeDir(move[0]);
      else this.nudgeKnife(move[1], move[0]);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.doCut();
    }
  }

  /** Keys: R and C pick the knife's direction, 1–4 pick a choice, digits type the total. */
  protected onKey(event: KeyboardEvent) {
    if (
      event.repeat ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      !this.started() ||
      this.coachOpen()
    )
      return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('input, textarea, select')) return;
    const phase = this.phase();
    const key = event.key.toLowerCase();
    if (phase === 'cut' && (key === 'r' || key === 'c')) {
      event.preventDefault();
      this.setKnifeDir(key === 'r' ? 'rows' : 'cols');
      return;
    }
    if ((phase === 'pieces' || phase === 'ghost') && /^[1-4]$/.test(key)) {
      const value = this.round().choices[Number(key) - 1];
      if (value !== undefined) {
        event.preventDefault();
        this.choose(value);
      }
      return;
    }
    if (phase !== 'total') return;
    if (/^\d$/.test(key)) {
      event.preventDefault();
      this.type(Number(key));
    } else if (key === 'backspace') {
      event.preventDefault();
      this.erase();
    } else if (key === 'enter' && !target?.closest('button')) {
      event.preventDefault();
      this.submit();
    }
  }

  // ---- Status and help text ---------------------------------------------------------------

  protected statusText() {
    const round = this.round();
    const order = round.order;
    if (round.note) {
      const note = this.t(round.note.key, round.note.values);
      // After the last piece, go straight on to the total.
      return order.phase === 'total' && ['pieceRight', 'twinRight'].includes(round.note.key)
        ? `${note} ${this.totalPrompt()}`
        : note;
    }
    switch (order.phase) {
      case 'cut':
        return this.t(
          order.firstWay
            ? 'statusCutAgain'
            : order.cuts.length
              ? 'statusCutMore'
              : this.guide()
                ? 'statusCutGuide'
                : this.ghostOffer()
                  ? 'statusCutGhost'
                  : 'statusCut',
        );
      case 'ghost': {
        const full = this.ghostTray()!;
        return this.t('statusPiece', { a: full.rows, b: full.cols });
      }
      case 'pieces': {
        const piece = this.pieces()[order.active];
        return this.t('statusPiece', { a: piece.rows, b: piece.cols });
      }
      case 'total':
        return this.totalPrompt();
      default:
        return this.t('baked');
    }
  }

  protected totalPrompt() {
    const order = this.order();
    const shown = this.shown();
    const values = { a: shown.rows, b: shown.cols };
    if (order.ghost && order.ghostValue !== null)
      return this.t('statusTotalGhost', {
        ...values,
        full: order.ghostValue,
        line: ghostLine(order),
      });
    return this.t(order.cuts.length ? 'statusTotal' : 'statusTotalRead', values);
  }

  protected helpText() {
    const help = this.round().help;
    if (!help) return '';
    const values: Record<string, string | number> = { ...help.values };
    if (help.list) values['list'] = this.joinList(help.list.map(String));
    return this.t(help.key, values);
  }

  /** Bonus tag shown while cutting: the trick is worth extra. */
  protected pieceLabel(index: number) {
    const piece = this.pieces()[index];
    const value = this.order().values[index];
    return value === null || value === undefined
      ? this.t('pieceLabel', { a: piece.rows, b: piece.cols })
      : this.t('pieceNamed', { a: piece.rows, b: piece.cols, n: value });
  }

  protected knifeText() {
    const knife = this.knife();
    const shown = this.shown();
    return knife.dir === 'rows'
      ? this.t('knifeAtRows', { n: knife.at, total: shown.rows })
      : this.t('knifeAtCols', { n: knife.at, total: shown.cols });
  }

  private joinList(items: readonly string[]) {
    if (items.length < 2) return items.join('');
    return `${items.slice(0, -1).join(', ')} ${this.t('and')} ${items.at(-1)}`;
  }

  // ---- Timer ------------------------------------------------------------------------------

  private beginOrder() {
    this.resetKnife();
    this.startOven();
    if (this.phase() === 'cut') this.focusKnife();
    else this.focusPad();
  }

  private startOven() {
    this.stopOven();
    const seconds = ovenSeconds(this.pace(), this.order().fact, this.stage().cut);
    this.ovenTotal.set(seconds);
    if (!seconds) return;
    this.ovenRemaining = seconds * 1000;
    this.armOven();
  }

  private armOven() {
    clearInterval(this.tick);
    this.ovenDue = Date.now() + this.ovenRemaining;
    const count = () => {
      const left = Math.max(0, this.ovenDue - Date.now());
      this.secondsLeft.set(Math.ceil(left / 1000));
      if (left > 0) return;
      this.stopOven();
      this.patch({ crispy: true, note: this.round().help ? this.round().note : { key: 'crispy' } });
      this.sounds.play('timer');
    };
    count();
    this.tick = setInterval(count, 250);
  }

  private stopOven() {
    clearInterval(this.tick);
    this.tick = undefined;
  }

  protected visibilityChanged() {
    const round = this.round();
    if (
      !this.started() ||
      this.coachOpen() ||
      round.complete ||
      round.crispy ||
      round.order.phase === 'baked'
    )
      return;
    if (this.document.hidden && this.tick) {
      this.ovenRemaining = Math.max(0, this.ovenDue - Date.now());
      this.stopOven();
    } else if (!this.document.hidden && !this.tick && this.ovenTotal()) {
      this.armOven();
    }
  }

  // ---- Helpers ----------------------------------------------------------------------------

  private patch(change: Partial<Round>) {
    this.round.update((round) => ({ ...round, ...change }));
    this.armIdle();
  }

  /** After a quiet spell without a tap, the controls hop to show what to tap next. */
  private armIdle() {
    clearTimeout(this.idleTimer);
    this.idle.set(false);
    if (this.started()) this.idleTimer = setTimeout(() => this.idle.set(true), IDLE_GUIDE);
  }

  /** Opens "how to bake". The oven timer holds while the film is open. */
  protected openCoach() {
    if (!this.started() || this.coachOpen()) return;
    clearTimeout(this.idleTimer);
    this.idle.set(false);
    if (this.tick) {
      this.ovenRemaining = Math.max(0, this.ovenDue - Date.now());
      this.stopOven();
    }
    this.coachOpen.set(true);
  }

  protected closeCoach() {
    if (!this.coachOpen()) return;
    this.coachOpen.set(false);
    const round = this.round();
    if (this.ovenTotal() && !round.crispy && round.order.phase !== 'baked' && !this.document.hidden)
      this.armOven();
    this.armIdle();
    requestAnimationFrame(() =>
      this.host.nativeElement.querySelector<HTMLElement>('.help')?.focus({ preventScroll: true }),
    );
  }

  private showBanner(key: BakeryMessageKey) {
    clearTimeout(this.bannerTimer);
    this.banner.set(key);
    this.bannerTimer = setTimeout(() => this.banner.set(null), BANNER_TIME);
  }

  private choicesFor(order: OrderState) {
    const piece = orderPieces(order)[order.active];
    return piece ? pieceChoices(piece) : [];
  }

  private freeGap(dir: CutDir, at: number) {
    const cuts = this.order().dir === dir ? this.order().cuts : [];
    const size = dir === 'rows' ? this.shown().rows : this.shown().cols;
    for (let offset = 0; offset < size; offset++)
      for (const candidate of [at + offset, at - offset])
        if (candidate >= 1 && candidate < size && !cuts.includes(candidate)) return candidate;
    return Math.max(1, Math.min(size - 1, at));
  }

  /**
   * The knife starts near the middle, next to the glowing gap rather than on it, so the child
   * sees the glow and moves the knife there.
   */
  private resetKnife() {
    const guide = this.guide();
    const order = this.order();
    const shown = this.shown();
    const dir: CutDir = order.dir ?? guide?.dir ?? (shown.rows >= 2 ? 'rows' : 'cols');
    const size = dir === 'rows' ? shown.rows : shown.cols;
    const avoid = guide?.dir === dir ? guide.gaps : [];
    let at = this.freeGap(dir, Math.floor(size / 2));
    if (avoid.includes(at)) {
      const other = [at - 1, at + 1, 1, size - 1].find(
        (gap) => gap >= 1 && gap < size && !avoid.includes(gap) && !order.cuts.includes(gap),
      );
      if (other !== undefined) at = other;
    }
    this.knife.set({ dir, at });
  }

  private record() {
    return this.completion.finish({
      levelId: this.levelId(),
      completed: true,
      mastered: isMastered(this.stage(), this.stars()),
      stars: this.stars(),
    });
  }

  protected celebrate() {
    if (this.completion.result()?.levelId === this.levelId() || this.record())
      void this.router.navigate(['/complete', this.levelId()]);
    else this.saveFailed.set(true);
  }

  private focusKnife() {
    this.focus('.knife-handle');
  }
  private focusChoices() {
    this.focus('.choice');
  }
  private focusPad() {
    this.focus('.pad-key');
  }
  private focus(selector: string) {
    requestAnimationFrame(() =>
      this.host.nativeElement
        .querySelector<HTMLElement>(`${selector}:not([disabled])`)
        ?.focus({ preventScroll: true }),
    );
  }

  private readPace(): BakeryPace {
    try {
      return parseBakeryPace(this.document.defaultView?.localStorage.getItem(PACE_KEY));
    } catch {
      return 'off';
    }
  }

  private fresh(): Round {
    const stage = this.stage();
    const orders = createRound(stage, this.scores.missed());
    return {
      orders,
      index: 0,
      order: startOrder(stage, orders[0]),
      choices: [],
      entry: '',
      score: 0,
      gain: 0,
      tags: [],
      reward: null,
      streak: 0,
      bestStreak: 0,
      firstTries: 0,
      tricks: 0,
      squares: 0,
      crispy: false,
      rehearsed: [],
      complete: false,
      counters: NO_COUNTERS,
      pulse: { kind: 'rows', piece: 0 },
      help: null,
      note: null,
    };
  }

  protected readonly orders = ORDERS;
}
