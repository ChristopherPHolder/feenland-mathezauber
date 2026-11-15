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
import { FrameBottle, liquid, PotionFrame } from './potion-frame';
import { potionText, PotionMessageKey } from './potion-messages';
import {
  blockReason,
  createRound,
  FEVER_STREAK,
  hourglassSeconds,
  isMastered,
  localOps,
  mix,
  MixStep,
  POTION_PACES,
  potionCoins,
  PotionOp,
  PotionPace,
  PotionPuzzle,
  potionPosition,
  potionStage,
  potionStages,
  potionStars,
  parsePotionPace,
  ROUND_LENGTH,
  roundStars,
  solve,
  TOTAL_STAGES,
} from './potion-puzzles';
import { PotionCoach } from './potion-coach';
import { PotionDemo } from './potion-demo';
import { countGuidedBrew, GUIDED_BREWS, guidedBrews } from './potion-guide';
import { PotionReward, PotionRewardKind } from './potion-reward';
import { PotionScores } from './potion-scores';
import { PotionShelf } from './potion-shelf';
import { PotionSounds } from './potion-sounds';

interface Round {
  readonly potions: readonly PotionPuzzle[];
  readonly index: number;
  readonly bottles: readonly FrameBottle[];
  /** The shelf before each mix, so a mix can be undone. */
  readonly history: readonly (readonly FrameBottle[])[];
  readonly steps: readonly MixStep[];
  readonly picked: number | null;
  readonly op: PotionOp | null;
  /** Wrong potions on this cauldron: they cost stars. */
  readonly fizzles: number;
  /** Undos and fresh starts on this cauldron: none earns a moon drop. */
  readonly undos: number;
  /** Stars won per brewed potion. */
  readonly stars: readonly number[];
  readonly score: number;
  /** Coins the last brewed potion paid, for the reward card. */
  readonly gain: number;
  readonly streak: number;
  readonly sparkle: 'none' | 'shining' | 'faded';
  readonly phase: 'ready' | 'fizzing' | 'brewed' | 'complete';
  readonly nextId: number;
  readonly mixes: number;
  readonly fizzleCount: number;
  readonly brews: number;
}

/** The last mix, shown on the mix line until the next tap. */
interface LastMix {
  readonly a: number;
  readonly op: PotionOp;
  readonly b: number;
  readonly r: number;
  readonly outcome: 'mixed' | 'fizzle' | 'brewed';
}

/** Which group of controls the child taps next. */
type NextTap = 'bottle' | 'spell' | 'second';

interface Status {
  readonly key: PotionMessageKey;
  readonly values?: Record<string, string | number>;
  readonly extras?: readonly PotionMessageKey[];
}

const PACE_KEY = 'feenland.potion-pace.v1';
const FIZZLE_DELAY = 1900;
const BREW_DELAY = 3000;
/** Waiting this long without a tap makes the controls show what to tap next again. */
const IDLE_GUIDE = 6000;
const OP_KEYS: Readonly<Record<string, PotionOp>> = {
  '+': '+',
  '-': '−',
  '*': '×',
  x: '×',
  '/': '÷',
  ':': '÷',
};

@Component({
  selector: 'app-potions',
  imports: [
    RouterLink,
    Icon,
    GameHeader,
    ThreeStage,
    PotionShelf,
    PotionReward,
    PotionDemo,
    PotionCoach,
  ],
  providers: [PotionSounds],
  templateUrl: './potions.html',
  styleUrls: ['./potions.css', './potions-play.css', './potions-guide.css'],
  host: {
    '(document:keydown)': 'onKey($event)',
    '(document:visibilitychange)': 'visibilityChanged()',
  },
})
export class Potions {
  protected readonly i = inject(LocaleService);
  private readonly p = inject(ProgressService);
  private readonly hatchery = inject(HatcheryStore);
  private readonly completion = inject(CompletionService);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  protected readonly sounds = inject(PotionSounds);
  protected readonly scores = inject(PotionScores);
  private readonly params = toSignal(inject(ActivatedRoute).paramMap);

  protected readonly total = TOTAL_STAGES;
  protected readonly roundLength = ROUND_LENGTH;
  protected readonly stage = computed(
    () => potionStage(this.params()?.get('id')) ?? potionStage('potion-1')!,
  );
  protected readonly levelId = computed(() => `potion-${this.stage().stage}`);
  protected readonly position = computed(() => potionPosition(this.stage()));
  protected readonly levelLinks = potionStages.map((stage, index) => ({
    stage: stage.stage,
    position: index + 1,
    route: ['/adventure', `potion-${stage.stage}`],
  }));
  protected readonly nextLink = computed(() => {
    const next = potionStages[this.position()];
    return next ? ['/adventure', `potion-${next.stage}`] : null;
  });
  protected readonly example = computed(() => localOps(this.stage().example, this.i.t('divide')));

  protected readonly round = linkedSignal<Round>(() => this.fresh());
  protected readonly started = linkedSignal<boolean>(() => {
    this.stage();
    return false;
  });
  protected readonly paces = POTION_PACES;
  protected readonly pace = signal<PotionPace>(this.readPace());
  protected readonly timed = computed(() => this.pace() !== 'off');
  protected readonly secondsLeft = signal(0);
  protected readonly status = signal<Status | null>(null);
  protected readonly saveFailed = signal(false);
  protected readonly newBest = signal(false);
  protected readonly lastMix = signal<LastMix | null>(null);
  protected readonly coachOpen = signal(false);
  /** The first few potions on a device always show what to tap next. */
  private readonly learning = signal(guidedBrews() < GUIDED_BREWS);
  /** The child has waited a while without tapping. */
  private readonly idle = signal(false);

  protected readonly potion = computed(() => {
    const round = this.round();
    return round.potions[Math.min(round.index, ROUND_LENGTH - 1)];
  });
  protected readonly big = computed(() => this.round().index === ROUND_LENGTH - 1);
  protected readonly ready = computed(
    () => this.started() && this.round().phase === 'ready' && !this.coachOpen(),
  );
  protected readonly first = computed(() => {
    const round = this.round();
    return round.bottles.find((bottle) => bottle.id === round.picked) ?? null;
  });
  protected readonly nextTap = computed<NextTap | null>(() => {
    if (!this.ready()) return null;
    const round = this.round();
    return round.picked === null ? 'bottle' : round.op === null ? 'spell' : 'second';
  });
  /** The group that bounces to say "tap one of these": always while learning, else after a wait. */
  protected readonly guide = computed(() =>
    this.learning() || this.idle() ? this.nextTap() : null,
  );
  /** The mix line under the spells: the mix being built, or the last mix and how it went. */
  protected readonly mixLine = computed(() => {
    const last = this.lastMix();
    if (last) return last;
    const first = this.first();
    return {
      a: first?.value ?? null,
      op: first ? this.round().op : null,
      b: null,
      r: null,
      outcome: 'building',
    } as const;
  });
  protected readonly sandShare = computed(() => {
    const seconds = hourglassSeconds(this.pace(), this.potion().values.length);
    return seconds ? Math.min(1, this.secondsLeft() / seconds) : 0;
  });
  protected readonly fever = computed(() => this.round().streak >= FEVER_STREAK);
  protected readonly cauldrons = Array.from({ length: ROUND_LENGTH }, (_, index) => index);
  protected readonly starSlots = [1, 2, 3];
  protected readonly stars = computed(() => roundStars(this.round().stars));
  protected readonly starsWon = computed(() => this.round().stars.reduce((sum, n) => sum + n, 0));
  protected readonly best = computed(() => this.scores.best()[this.levelId()] ?? 0);
  /** After two fizzles Olli reminds the child of the level's trick, never of a recipe. */
  protected readonly showHint = computed(() => this.round().fizzles >= 2);
  /** What the reward card over the cauldron shows while a brewed potion stands ready. */
  protected readonly reward = computed(() => {
    const round = this.round();
    if (round.phase !== 'brewed') return null;
    const stars = round.stars.at(-1) ?? 1;
    const kind: PotionRewardKind = this.big()
      ? 'big'
      : round.streak === FEVER_STREAK
        ? 'fever'
        : stars === 3
          ? 'perfect'
          : 'brewed';
    const cheers = {
      big: 'rewardBig',
      fever: 'rewardFever',
      perfect: 'rewardPerfect',
      brewed: 'rewardBrewed',
    } as const;
    return {
      kind,
      stars,
      cheer: this.t(cheers[kind]),
      coins: this.t('rewardCoins', { n: this.i.format(round.gain) }),
    };
  });
  protected readonly frame = computed<PotionFrame>(() => {
    const round = this.round();
    return {
      potion: round.index,
      target: this.potion().target,
      bottles: round.bottles,
      picked: round.picked,
      brewed: round.phase === 'brewed' || round.phase === 'complete',
      fizzing: round.phase === 'fizzing',
      big: this.big(),
      fever: this.fever(),
      sparkle: round.sparkle,
      mixes: round.mixes,
      fizzles: round.fizzleCount,
      brews: round.brews,
    };
  });
  protected readonly loadWorld: WorldLoader<PotionFrame> = () =>
    import('./potion-world').then((m) => m.PotionWorld);

  private readonly outcome = viewChild<ElementRef<HTMLElement>>('outcome');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private timer?: ReturnType<typeof setTimeout>;
  private idleTimer?: ReturnType<typeof setTimeout>;
  private tick?: ReturnType<typeof setInterval>;
  private sandDue = 0;
  private sandRemaining = 0;

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

  protected t(key: PotionMessageKey, values: Record<string, string | number> = {}) {
    return potionText(this.i.locale(), key, values);
  }
  protected levelKey(stage: number) {
    return `potion${stage}` as MessageKey;
  }
  /** The spell's sign as the child's school writes it. */
  protected sign(op: PotionOp) {
    return op === '÷' ? this.i.t('divide') : op;
  }
  protected color(bottle: FrameBottle) {
    return liquid(bottle.id);
  }
  /** Why a bottle cannot be poured in with the chosen spell, or '' when it can. */
  protected blockedText(bottle: FrameBottle) {
    const round = this.round();
    const first = this.first();
    if (!first || round.op === null || bottle.id === first.id) return '';
    const reason = blockReason(first.value, round.op, bottle.value, this.potion().max);
    return reason ? this.t(reason, { a: first.value, b: bottle.value }) : '';
  }
  protected paceSeconds(pace: PotionPace) {
    return hourglassSeconds(pace, this.stage().bottles);
  }

  protected selectPace(pace: PotionPace) {
    this.pace.set(pace);
    try {
      this.document.defaultView?.localStorage.setItem(PACE_KEY, pace);
    } catch {
      /* The pace stays for this visit. */
    }
    if (!this.started()) return;
    if (pace === 'off') {
      this.stopSand();
      if (this.round().sparkle === 'shining') this.round.update((r) => ({ ...r, sparkle: 'none' }));
    }
  }

  protected play() {
    clearTimeout(this.timer);
    this.stopSand();
    this.round.set(this.fresh());
    this.status.set(null);
    this.saveFailed.set(false);
    this.newBest.set(false);
    this.lastMix.set(null);
    this.coachOpen.set(false);
    this.started.set(true);
    this.sounds.play('start');
    this.startSand();
    this.armIdle();
    this.focusBottles();
  }

  /** Picks the first bottle, swaps it, or pours a second bottle in once a spell is chosen. */
  protected tapBottle(id: number) {
    const round = this.round();
    if (!this.ready()) return;
    this.armIdle();
    this.lastMix.set(null);
    if (round.picked !== null && round.picked !== id && round.op !== null) {
      this.pour(round, round.picked, round.op, id);
      return;
    }
    const picked = round.picked === id ? null : id;
    this.round.set({ ...round, picked, op: null });
    this.status.set(null);
    if (picked !== null) this.sounds.play('pick');
  }

  protected chooseOp(op: PotionOp) {
    const round = this.round();
    if (!this.ready() || round.picked === null) return;
    this.armIdle();
    this.round.set({ ...round, op: round.op === op ? null : op });
    this.status.set(null);
  }

  private pour(round: Round, firstId: number, op: PotionOp, secondId: number) {
    const potion = this.potion();
    const first = round.bottles.find((bottle) => bottle.id === firstId)!;
    const second = round.bottles.find((bottle) => bottle.id === secondId)!;
    const result = mix(first.value, op, second.value, potion.max);
    if (result === null) return;
    const made: FrameBottle = { id: round.nextId, value: result };
    const step: MixStep = { a: first.value, op, b: second.value, result };
    const updated: Round = {
      ...round,
      bottles: round.bottles.flatMap((bottle) =>
        bottle.id === firstId ? [] : bottle.id === secondId ? [made] : [bottle],
      ),
      history: [...round.history, round.bottles],
      steps: [...round.steps, step],
      picked: null,
      op: null,
      nextId: round.nextId + 1,
      mixes: round.mixes + 1,
    };
    const values = { a: step.a, op: this.sign(op), b: step.b, r: result };
    const recipe = solve(
      updated.bottles.map((bottle) => bottle.value),
      potion.target,
      potion.ops,
      potion.max,
    );
    const outcome = recipe === null ? 'fizzle' : updated.bottles.length > 1 ? 'mixed' : 'brewed';
    this.lastMix.set({ a: step.a, op, b: step.b, r: result, outcome });
    if (outcome === 'mixed') {
      this.round.set(updated);
      this.status.set({ key: 'mixed', values });
      this.sounds.play('pour');
      this.focusBottles();
    } else if (outcome === 'brewed') {
      this.brew(updated);
    } else {
      this.fizzle(updated, result);
    }
  }

  /** A mix leaves no recipe for the target: Olli pours it back to the last solvable shelf. */
  private fizzle(round: Round, result: number) {
    this.round.set({
      ...round,
      phase: 'fizzing',
      fizzles: round.fizzles + 1,
      fizzleCount: round.fizzleCount + 1,
    });
    this.status.set({
      key: round.bottles.length > 1 ? 'deadEnd' : 'fizzle',
      values: { n: result, target: this.potion().target },
    });
    this.sounds.play('fizzle');
    this.timer = setTimeout(() => {
      this.round.update((r) => ({
        ...r,
        bottles: r.history.at(-1)!,
        history: r.history.slice(0, -1),
        steps: r.steps.slice(0, -1),
        phase: 'ready',
      }));
      this.lastMix.set(null);
      this.armIdle();
      this.focusBottles();
    }, FIZZLE_DELAY);
  }

  private brew(round: Round) {
    this.stopSand();
    const stars = potionStars(round.fizzles);
    const streak = stars === 3 ? round.streak + 1 : 0;
    const moon = round.undos === 0 && round.fizzles === 0;
    const coins = potionCoins({
      stars,
      moon,
      sparkle: round.sparkle === 'shining',
      streak,
      big: this.big(),
    });
    this.round.set({
      ...round,
      phase: 'brewed',
      stars: [...round.stars, stars],
      streak,
      score: round.score + coins,
      gain: coins,
      brews: round.brews + 1,
    });
    this.hatchery.warm();
    clearTimeout(this.idleTimer);
    this.idle.set(false);
    if (this.learning()) this.learning.set(countGuidedBrew() < GUIDED_BREWS);
    const extras: PotionMessageKey[] = [];
    if (moon) extras.push('moon');
    if (streak === FEVER_STREAK) extras.push('fever');
    this.status.set({ key: stars === 3 ? 'brewedPerfect' : 'brewed', extras });
    this.sounds.play(streak === FEVER_STREAK ? 'fever' : stars === 3 ? 'perfect' : 'brew');
    this.timer = setTimeout(() => this.advance(), BREW_DELAY);
  }

  /** Moves on to the next potion now instead of waiting. */
  protected advance() {
    clearTimeout(this.timer);
    const round = this.round();
    if (round.phase !== 'brewed') return;
    if (round.index + 1 < ROUND_LENGTH) {
      const index = round.index + 1;
      const bottles = this.bottlesFor(round.potions[index], round.nextId);
      this.round.set({
        ...round,
        index,
        bottles,
        history: [],
        steps: [],
        picked: null,
        op: null,
        fizzles: 0,
        undos: 0,
        sparkle: 'none',
        phase: 'ready',
        nextId: round.nextId + bottles.length,
      });
      this.status.set(null);
      this.lastMix.set(null);
      this.startSand();
      this.armIdle();
      this.focusBottles();
      return;
    }
    this.round.set({ ...round, phase: 'complete' });
    this.lastMix.set(null);
    this.saveFailed.set(!this.record());
    this.newBest.set(this.scores.record(this.levelId(), round.score));
    this.sounds.play('win');
    requestAnimationFrame(() => this.outcome()?.nativeElement.focus({ preventScroll: true }));
  }

  protected undo() {
    const round = this.round();
    if (!this.ready() || !round.steps.length) return;
    this.round.set({
      ...round,
      bottles: round.history.at(-1)!,
      history: round.history.slice(0, -1),
      steps: round.steps.slice(0, -1),
      picked: null,
      op: null,
      undos: round.undos + 1,
    });
    this.status.set(null);
    this.lastMix.set(null);
    this.armIdle();
  }

  protected restart() {
    const round = this.round();
    if (!this.ready() || !round.steps.length) return;
    this.round.set({
      ...round,
      bottles: round.history[0],
      history: [],
      steps: [],
      picked: null,
      op: null,
      undos: round.undos + 1,
    });
    this.status.set(null);
    this.lastMix.set(null);
    this.armIdle();
  }

  /** Opens "how to brew". The hourglass holds its sand until the child closes it. */
  protected openCoach() {
    if (!this.started() || this.coachOpen()) return;
    clearTimeout(this.idleTimer);
    this.idle.set(false);
    if (this.tick) {
      this.sandRemaining = Math.max(0, this.sandDue - Date.now());
      this.stopSand();
    }
    this.coachOpen.set(true);
  }

  protected closeCoach() {
    if (!this.coachOpen()) return;
    this.coachOpen.set(false);
    const round = this.round();
    if (round.sparkle === 'shining' && round.phase === 'ready' && !this.document.hidden)
      this.armSand();
    this.armIdle();
    requestAnimationFrame(() =>
      this.host.nativeElement.querySelector<HTMLElement>('.help')?.focus({ preventScroll: true }),
    );
  }

  /** After a quiet spell without a tap, the controls bounce to show what to tap next. */
  private armIdle() {
    clearTimeout(this.idleTimer);
    this.idle.set(false);
    this.idleTimer = setTimeout(() => this.idle.set(true), IDLE_GUIDE);
  }

  private startSand() {
    const seconds = hourglassSeconds(this.pace(), this.potion().values.length);
    if (!seconds) return;
    this.round.update((round) => ({ ...round, sparkle: 'shining' }));
    this.sandRemaining = seconds * 1000;
    this.armSand();
  }

  private armSand() {
    clearInterval(this.tick);
    this.sandDue = Date.now() + this.sandRemaining;
    const count = () => {
      const left = Math.max(0, this.sandDue - Date.now());
      this.secondsLeft.set(Math.ceil(left / 1000));
      if (left > 0) return;
      this.stopSand();
      this.round.update((round) => ({ ...round, sparkle: 'faded' }));
      this.status.set({ key: 'sandOut' });
      this.sounds.play('sand');
    };
    count();
    this.tick = setInterval(count, 250);
  }

  private stopSand() {
    clearInterval(this.tick);
    this.tick = undefined;
  }

  protected visibilityChanged() {
    if (this.coachOpen() || this.round().sparkle !== 'shining' || this.round().phase === 'complete')
      return;
    if (this.document.hidden && this.tick) {
      this.sandRemaining = Math.max(0, this.sandDue - Date.now());
      this.stopSand();
    } else if (!this.document.hidden && !this.tick && this.round().phase !== 'brewed') {
      this.armSand();
    }
  }

  private record() {
    const stars = this.round().stars;
    return this.completion.finish({
      levelId: this.levelId(),
      completed: true,
      mastered: isMastered(stars),
      stars: roundStars(stars),
    });
  }

  protected celebrate() {
    if (this.completion.result()?.levelId === this.levelId() || this.record())
      void this.router.navigate(['/complete', this.levelId()]);
    else this.saveFailed.set(true);
  }

  /** Keys 1–4 pick bottles, + − × ÷ (or * / :) pick spells, Backspace undoes a mix. */
  protected onKey(event: KeyboardEvent) {
    if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || !this.ready()) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, select')) return;
    const op = OP_KEYS[event.key.toLowerCase()];
    if (op && this.potion().ops.includes(op)) {
      event.preventDefault();
      this.chooseOp(op);
      return;
    }
    if (event.key === 'Backspace') {
      event.preventDefault();
      this.undo();
      return;
    }
    const bottle = this.round().bottles[Number(event.key) - 1];
    if (!bottle || this.blockedText(bottle)) return;
    event.preventDefault();
    this.tapBottle(bottle.id);
  }

  protected statusText() {
    const status = this.status();
    if (status) {
      return [status.key, ...(status.extras ?? [])]
        .map((key) => this.t(key, status.values))
        .join(' ');
    }
    const round = this.round();
    const first = this.first();
    if (!first) return this.t('pickFirst');
    if (round.op === null) return this.t('pickSpell', { n: first.value });
    return this.t('pickSecond', { n: first.value, op: this.sign(round.op) });
  }

  private focusBottles() {
    requestAnimationFrame(() => {
      const active = this.document.activeElement;
      if (active && active !== this.document.body && this.host.nativeElement.contains(active))
        if (!(active as HTMLButtonElement).disabled) return;
      this.host.nativeElement
        .querySelector<HTMLElement>('.bottle:not([disabled])')
        ?.focus({ preventScroll: true });
    });
  }

  private readPace(): PotionPace {
    try {
      return parsePotionPace(this.document.defaultView?.localStorage.getItem(PACE_KEY));
    } catch {
      return 'off';
    }
  }

  private bottlesFor(potion: PotionPuzzle, firstId: number): FrameBottle[] {
    return potion.values.map((value, index) => ({ id: firstId + index, value }));
  }

  private fresh(): Round {
    const potions = createRound(this.stage());
    const bottles = this.bottlesFor(potions[0], 0);
    return {
      potions,
      index: 0,
      bottles,
      history: [],
      steps: [],
      picked: null,
      op: null,
      fizzles: 0,
      undos: 0,
      stars: [],
      score: 0,
      gain: 0,
      streak: 0,
      sparkle: 'none',
      phase: 'ready',
      nextId: bottles.length,
      mixes: 0,
      fizzleCount: 0,
      brews: 0,
    };
  }
}
