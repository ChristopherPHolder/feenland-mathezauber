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
import { FilmDialog, Icon, RewardBurst } from '@feenland/ui';
import { CompletionService } from '../../core/completion';
import { LocaleService } from '../../core/locale';
import { MessageKey } from '../../core/messages';
import { ProgressService } from '../../core/progress';
import { GameHeader } from '../../shared/game-header';
import { ThreeStage, WorldLoader } from '../../shared/three/three-stage';
import { HatcheryStore } from '../hatchery/hatchery-store';
import { ScalesItem } from './scales-art';
import { ScalesDemo, DemoKind } from './scales-demo';
import { DISHES, PanThing, ScalesFrame } from './scales-frame';
import { countGuidedLine, GUIDED_LINES, guidedLines, IDLE_GUIDE } from './scales-guide';
import {
  cookPoints,
  HEARTY_STREAK,
  isMastered,
  ItemId,
  LINES,
  Load,
  MAX_PIECES,
  parseScalesPace,
  ROUND_LENGTH,
  roundStars,
  SCALES_PACES,
  ScalesPace,
  scalesPosition,
  scalesStage,
  scalesStages,
  soupSeconds,
  Task,
  TOTAL_STAGES,
  createRound,
} from './scales-levels';
import {
  addWeight,
  answerCompare,
  canPour,
  checkPour,
  emptyPot,
  eraseDigit,
  LineState,
  lineTilt,
  Pick,
  pour,
  poured,
  removeWeight,
  startLine,
  submitEntry,
  typeDigit,
  usedFewest,
  weigh,
} from './scales-line';
import { formatAmount, formatNumber, sum, unitSymbol, Unit } from './scales-math';
import { scalesText, ScalesMessageKey } from './scales-messages';
import { ScalesScene } from './scales-scene';
import { ScalesScores } from './scales-scores';
import { ScalesSounds } from './scales-sounds';

type RewardKind = 'cooked' | 'first' | 'hearty' | 'feast';

interface Counters {
  readonly cooks: number;
  readonly slips: number;
  readonly adds: number;
  readonly pours: number;
}

interface Round {
  readonly tasks: readonly Task[];
  readonly index: number;
  readonly line: LineState;
  readonly score: number;
  /** Points the last line paid, and its bonus tags, for the reward card. */
  readonly gain: number;
  readonly tags: readonly ScalesMessageKey[];
  readonly reward: RewardKind | null;
  readonly streak: number;
  readonly bestStreak: number;
  /** Whether each cooked line went right first time, for the recipe card at the end. */
  readonly results: readonly boolean[];
  readonly fewest: number;
  /** The soup bubbled over on this line. */
  readonly bubbled: boolean;
  readonly complete: boolean;
  readonly counters: Counters;
}

const PACE_KEY = 'feenland.scales-pace.v1';
const ADVANCE_DELAY = 4200;
const BANNER_TIME = 2600;
/** The film each level shows, by level. */
const DEMO_KINDS: readonly DemoKind[] = [
  'compare',
  'balance',
  'balance',
  'dial',
  'balance',
  'dial',
  'balance',
  'missing',
  'missing',
  'pour',
  'pour',
  'balance',
];
const NO_COUNTERS: Counters = { cooks: 0, slips: 0, adds: 0, pours: 0 };

@Component({
  selector: 'app-scales',
  imports: [
    RouterLink,
    Icon,
    RewardBurst,
    FilmDialog,
    GameHeader,
    ThreeStage,
    ScalesScene,
    ScalesDemo,
    ScalesItem,
  ],
  providers: [ScalesSounds],
  templateUrl: './scales.html',
  styleUrls: ['./scales.css', './scales-play.css'],
  host: {
    '(document:keydown)': 'onKey($event)',
    '(document:visibilitychange)': 'visibilityChanged()',
  },
})
export class Scales {
  protected readonly i = inject(LocaleService);
  private readonly p = inject(ProgressService);
  private readonly hatchery = inject(HatcheryStore);
  private readonly completion = inject(CompletionService);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  protected readonly sounds = inject(ScalesSounds);
  protected readonly scores = inject(ScalesScores);
  private readonly params = toSignal(inject(ActivatedRoute).paramMap);

  protected readonly total = TOTAL_STAGES;
  protected readonly lineSlots = Array.from({ length: ROUND_LENGTH }, (_, index) => index);
  protected readonly starSlots = [1, 2, 3];
  protected readonly digits = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];
  protected readonly lines = LINES;
  protected readonly dishColors = DISHES;
  protected readonly stage = computed(
    () => scalesStage(this.params()?.get('id')) ?? scalesStage('scales-1')!,
  );
  protected readonly levelId = computed(() => `scales-${this.stage().stage}`);
  protected readonly position = computed(() => scalesPosition(this.stage()));
  protected readonly levelLinks = scalesStages.map((stage, index) => ({
    stage: stage.stage,
    position: index + 1,
    route: ['/adventure', `scales-${stage.stage}`],
  }));
  protected readonly nextLink = computed(() => {
    const next = scalesStages[this.position()];
    return next ? ['/adventure', `scales-${next.stage}`] : null;
  });

  protected readonly round = linkedSignal<Round>(() => this.fresh());
  protected readonly started = linkedSignal<boolean>(() => {
    this.stage();
    return false;
  });
  protected readonly paces = SCALES_PACES;
  protected readonly pace = signal<ScalesPace>(this.readPace());
  protected readonly timed = computed(() => this.pace() !== 'off');
  protected readonly secondsLeft = signal(0);
  protected readonly soupTotal = signal(0);
  protected readonly banner = signal<ScalesMessageKey | null>(null);
  protected readonly saveFailed = signal(false);
  protected readonly newBest = signal(false);
  protected readonly dishAdded = signal(false);

  protected readonly coachOpen = signal(false);
  /** The first few lines on a device always show what to tap next. */
  private readonly learning = signal(guidedLines() < GUIDED_LINES);
  /** The child has waited a while without tapping. */
  private readonly idle = signal(false);

  protected readonly line = computed(() => this.round().line);
  protected readonly task = computed(() => this.line().task);
  protected readonly feast = computed(() => this.round().index === LINES);
  protected readonly golden = computed(() => this.round().streak >= HEARTY_STREAK);
  protected readonly stars = computed(() => roundStars(this.firstTries()));
  protected readonly firstTries = computed(() => this.round().results.filter(Boolean).length);
  protected readonly best = computed(() => this.scores.best()[this.levelId()] ?? 0);
  protected readonly soupShare = computed(() =>
    this.soupTotal() ? Math.min(1, this.secondsLeft() / this.soupTotal()) : 0,
  );

  /** The film on the level card and in the ? dialog: what this level's lines mostly ask. */
  protected readonly demoKind = computed<DemoKind>(() => DEMO_KINDS[this.stage().stage - 1]);
  /** Which controls hop to say "tap one of these": always while learning, else after a wait. */
  protected readonly nextTap = computed(() => {
    if (!this.started() || this.round().complete || this.coachOpen()) return null;
    if (!this.learning() && !this.idle()) return null;
    const line = this.line();
    if (line.done) return 'next';
    switch (line.task.kind) {
      case 'compare':
        return 'pick';
      case 'balance':
        return line.placed.length ? 'weigh' : 'weights';
      case 'pour':
        return 'jugs';
      default:
        return line.entry ? 'check' : 'pad';
    }
  });

  protected readonly unit = computed<Unit>(() => this.task().unit);
  protected readonly unitText = computed(() => unitSymbol(this.unit()));
  protected readonly claimTask = computed(() => {
    const task = this.task();
    return task.kind === 'compare' && task.ask === 'claim';
  });
  protected readonly maxPieces = MAX_PIECES;

  protected amount(value: number, unit: Unit = this.unit()) {
    return formatAmount(value, unit, this.i.locale(), (n) =>
      this.t(value === 1 ? 'blocksOne' : 'blocksMany', { n }),
    );
  }

  /** What the child adds to the pan, biggest first. */
  protected readonly sizes = computed(() => {
    const task = this.task();
    return task.kind === 'balance' ? task.sizes : [];
  });
  protected readonly jugs = computed(() => {
    const task = this.task();
    return task.kind === 'pour' ? task.jugs : [];
  });

  /** The recipe card over the board: what goes in and how much. */
  protected readonly recipe = computed(() => {
    const task = this.task();
    switch (task.kind) {
      case 'balance':
        return task.equation ? null : { item: task.item, amount: this.amount(task.need) };
      case 'dial':
        return { item: task.item, amount: '?' };
      case 'pour':
        return { item: task.item, amount: this.amount(task.target) };
      default:
        return null;
    }
  });

  /** "7 + □ = 4 + 5", with the gap filled once the line is cooked. */
  protected readonly equation = computed(() => {
    const task = this.task();
    const line = this.line();
    if (task.kind !== 'missing' && !(task.kind === 'balance' && task.equation)) return null;
    const gap = line.done
      ? formatNumber(task.kind === 'missing' ? task.answer : task.need, this.i.locale())
      : '□';
    const side = (loads: readonly Load[], mine: boolean) => {
      const sacks = loads.filter((load) => load.kind === 'sack');
      const parts = loads
        .filter((load) => load.kind !== 'sack')
        .map((load) =>
          load.kind === 'mystery' ? gap : formatNumber(load.amount, this.i.locale()),
        );
      if (sacks.length) parts.unshift(`${sacks.length} × ${sacks[0].amount}`);
      if (mine) parts.push(gap);
      return parts.join(' + ');
    };
    const balance = task.kind === 'balance';
    return `${side(task.left, balance && task.side === 'left')} = ${side(task.right, balance && task.side === 'right')}`;
  });

  protected readonly question = computed(() => {
    const task = this.task();
    switch (task.kind) {
      case 'compare':
        return task.ask === 'claim'
          ? this.claim(
              task.claim === 'left' ? task.left.item : task.right.item,
              task.claim === 'left' ? task.right.item : task.left.item,
            )
          : this.t(task.ask === 'heavier' ? 'askHeavier' : 'askLighter');
      case 'balance':
        return this.t(task.equation ? 'askEquation' : 'askBalance');
      case 'missing':
        return this.t('askMissing');
      case 'dial':
        return this.t('askDial');
      case 'pour':
        return this.t('askPour');
    }
  });

  private claim(a: ItemId, b: ItemId) {
    const sentence = this.t('claim', { a: this.the(a), b: this.the(b) });
    return sentence.charAt(0).toUpperCase() + sentence.slice(1);
  }
  private the(item: ItemId) {
    return this.t(`the${item.charAt(0).toUpperCase()}${item.slice(1)}` as ScalesMessageKey);
  }

  protected readonly compareItems = computed(() => {
    const task = this.task();
    return task.kind === 'compare' ? [task.left.item, task.right.item] : [];
  });

  protected readonly frame = computed<ScalesFrame>(() => {
    const round = this.round();
    const line = round.line;
    const task = line.task;
    const timer = this.timed() && this.soupTotal() ? this.soupShare() : null;
    const cooked = round.index + (line.done ? 1 : 0);
    return {
      line: round.index,
      mode: task.kind === 'dial' ? 'dial' : task.kind === 'pour' ? 'pour' : 'balance',
      left: this.pan('left'),
      right: this.pan('right'),
      tilt: lineTilt(line),
      held: line.held,
      dial:
        task.kind === 'dial'
          ? {
              dial: task.dial,
              value: task.amount,
              labels: Array.from({ length: task.dial.max / task.dial.label + 1 }, (_, index) =>
                formatNumber(index * task.dial.label, this.i.locale()),
              ),
              unit: unitSymbol(task.unit),
              item: task.item,
            }
          : null,
      pot:
        task.kind === 'pour'
          ? {
              capacity: task.capacity,
              target: task.target,
              filled: poured(line),
              line: this.amount(task.target),
              item: task.item,
              jugs: task.jugs.map((jug) => ({ amount: jug, label: this.amount(jug) })),
              lastJug: line.placed.at(-1) ?? 0,
            }
          : null,
      soup: cooked / ROUND_LENGTH,
      soupColor: DISHES[this.stage().stage - 1].color,
      timer: line.done ? null : timer,
      bubbling: round.bubbled && !line.done,
      golden: this.golden(),
      feast: this.feast(),
      dishes: this.scores.table(),
      finished: round.complete,
      mood: line.done ? 'happy' : line.verdict ? 'oops' : 'wait',
      ...round.counters,
    };
  });
  protected readonly loadWorld: WorldLoader<ScalesFrame> = () =>
    import('./scales-world').then((m) => m.ScalesWorld);

  /** What lies on one pan, worded for the world and the flat picture. */
  private pan(side: 'left' | 'right'): PanThing[] {
    const line = this.line();
    const task = line.task;
    if (task.kind === 'dial' || task.kind === 'pour') return [];
    const loads: readonly Load[] = side === 'left' ? [task.left].flat() : [task.right].flat();
    const biggest = Math.max(
      1,
      ...(task.kind === 'balance' ? task.sizes : []),
      ...loads.map((load) => (load.kind === 'item' ? 0 : load.amount)),
    );
    const weight = (amount: number, added: boolean): PanThing => ({
      kind: 'weight',
      item: null,
      size: Math.sqrt(amount / biggest),
      label: this.amount(amount, task.unit),
      added,
    });
    const things = loads.map((load): PanThing => {
      switch (load.kind) {
        case 'item': {
          const labelled =
            (task.kind === 'compare' && task.labelled) ||
            (task.kind === 'balance' && !task.equation);
          return {
            kind: 'item',
            item: load.item,
            size: 1,
            label: labelled ? this.amount(load.amount, task.unit) : '',
            added: false,
          };
        }
        case 'weight':
          return weight(load.amount, false);
        case 'mystery':
          return line.guess !== null
            ? weight(line.guess, true)
            : { kind: 'mystery', item: null, size: 1, label: '?', added: false };
        case 'sack':
          return {
            kind: 'sack',
            item: null,
            size: 1,
            label: this.amount(load.amount, 'kg'),
            added: false,
          };
      }
    });
    if (task.kind === 'balance' && task.side === side)
      things.push(...line.placed.map((amount) => weight(amount, true)));
    return things;
  }

  /** What a screen reader hears about the scale or the pot. */
  protected readonly sceneText = computed(() => {
    const frame = this.frame();
    const line = this.line();
    const task = line.task;
    if (task.kind === 'dial') {
      const dial = task.dial;
      const from = Math.floor(task.amount / dial.label) * dial.label;
      return this.t('dialSr', {
        max: this.amount(dial.max, task.unit),
        label: this.amount(dial.label, task.unit),
        n: (task.amount - from) / dial.step,
        from: this.amount(from, task.unit),
      });
    }
    if (task.kind === 'pour') {
      const filled = poured(line);
      return this.t(
        !filled
          ? 'potEmpty'
          : filled === task.target
            ? 'potOn'
            : filled > task.target
              ? 'potOver'
              : 'potBelow',
      );
    }
    const list = (things: readonly PanThing[]) =>
      things.length
        ? things
            .map((thing) =>
              thing.kind === 'item'
                ? `${this.t(thing.item!)}${thing.label ? ` ${thing.label}` : ''}`
                : thing.kind === 'mystery'
                  ? this.t('box')
                  : thing.kind === 'sack'
                    ? this.t('sack', { w: thing.label })
                    : thing.label,
            )
            .join(', ')
        : this.t('panNothing');
    const state = frame.held
      ? 'scaleHeld'
      : frame.tilt > 0
        ? 'scaleLeft'
        : frame.tilt < 0
          ? 'scaleRight'
          : 'scaleLevel';
    return `${this.t('panSr', { left: list(frame.left), right: list(frame.right) })} ${this.t(state)}`;
  });

  protected readonly reward = computed(() => {
    const round = this.round();
    if (!round.line.done || !round.reward || round.complete) return null;
    const cheers: Record<RewardKind, ScalesMessageKey> = {
      cooked: 'rewardCooked',
      first: 'rewardFirst',
      hearty: 'rewardHearty',
      feast: 'rewardFeast',
    };
    return {
      kind: round.reward,
      cheer: this.t(cheers[round.reward]),
      tags: round.tags.map((key) => this.t(key)),
      points: this.t('rewardPoints', { n: this.i.format(round.gain) }),
    };
  });

  /** The finished recipe card: one line per task, ticked, with a star for a first try. */
  protected readonly recipeLines = computed(() =>
    this.round().tasks.map((task, index) => ({
      item: this.taskItem(task),
      text: this.taskText(task),
      first: this.round().results[index] ?? false,
    })),
  );

  private taskItem(task: Task): ItemId {
    switch (task.kind) {
      case 'compare':
        return task.left.amount > task.right.amount ? task.left.item : task.right.item;
      case 'missing':
        return 'salt';
      default:
        return task.item;
    }
  }

  private taskText(task: Task): string {
    switch (task.kind) {
      case 'compare':
        return this.t(this.taskItem(task));
      case 'balance':
        return task.equation
          ? `${this.t('salt')} · ${this.amount(task.need)}`
          : `${this.t(task.item)} · ${this.amount(task.need)}`;
      case 'missing':
        return `${this.t('salt')} · ${this.amount(task.answer)}`;
      case 'dial':
        return `${this.t(task.item)} · ${this.amount(task.amount)}`;
      case 'pour':
        return `${this.t(task.item)} · ${this.amount(task.target)}`;
    }
  }

  private readonly outcome = viewChild<ElementRef<HTMLElement>>('outcome');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private timer?: ReturnType<typeof setTimeout>;
  private idleTimer?: ReturnType<typeof setTimeout>;
  private bannerTimer?: ReturnType<typeof setTimeout>;
  private tick?: ReturnType<typeof setInterval>;
  private soupDue = 0;
  private soupRemaining = 0;

  constructor() {
    effect(() => {
      if (this.started()) this.p.explore('tens');
    });
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.timer);
      clearTimeout(this.bannerTimer);
      clearTimeout(this.idleTimer);
      clearInterval(this.tick);
    });
  }

  protected t(key: ScalesMessageKey, values: Record<string, string | number> = {}) {
    return scalesText(this.i.locale(), key, values);
  }
  protected levelKey(stage: number) {
    return `scales${stage}` as MessageKey;
  }
  protected tipKey(stage: number) {
    return `tip${stage}` as ScalesMessageKey;
  }
  protected dishKey(index: number) {
    return `dish${index + 1}` as ScalesMessageKey;
  }
  protected paceSeconds(pace: ScalesPace) {
    return soupSeconds(pace, 'balance');
  }

  protected selectPace(pace: ScalesPace) {
    this.pace.set(pace);
    try {
      this.document.defaultView?.localStorage.setItem(PACE_KEY, pace);
    } catch {
      /* The choice stays for this visit. */
    }
    if (this.started() && pace === 'off') {
      this.stopSoup();
      this.soupTotal.set(0);
    }
  }

  protected play() {
    clearTimeout(this.timer);
    this.stopSoup();
    this.round.set(this.fresh());
    this.saveFailed.set(false);
    this.newBest.set(false);
    this.dishAdded.set(false);
    this.started.set(true);
    this.sounds.play('start');
    this.beginLine();
    this.armIdle();
  }

  // ---- Weights ------------------------------------------------------------------------------

  protected add(size: number) {
    const round = this.round();
    const line = addWeight(round.line, size);
    if (line === round.line) return;
    const biggest = Math.max(...this.sizes());
    this.sounds.play('clunk', size / biggest);
    this.patch({ line, counters: { ...round.counters, adds: round.counters.adds + 1 } });
  }

  protected remove(index: number) {
    const line = removeWeight(this.line(), index);
    if (line === this.line()) return;
    this.sounds.play('lift');
    this.patch({ line });
    this.focus('.weight-button');
  }

  protected weighIt() {
    const line = weigh(this.line());
    if (line === this.line()) return;
    this.settle(line);
  }

  // ---- Jugs ---------------------------------------------------------------------------------

  protected pourJug(jug: number) {
    const round = this.round();
    const line = pour(round.line, jug);
    if (line === round.line) return;
    this.sounds.play('glug');
    this.patch({ line, counters: { ...round.counters, pours: round.counters.pours + 1 } });
  }

  protected canPourJug(jug: number) {
    return canPour(this.line(), jug);
  }

  protected empty() {
    const line = emptyPot(this.line());
    if (line === this.line()) return;
    this.sounds.play('splash');
    this.patch({ line });
  }

  protected donePouring() {
    const line = checkPour(this.line());
    if (line === this.line()) return;
    this.settle(line);
  }

  // ---- Typing -------------------------------------------------------------------------------

  protected type(digit: number) {
    const line = typeDigit(this.line(), digit);
    if (line !== this.line()) this.patch({ line });
  }

  protected erase() {
    const line = eraseDigit(this.line());
    if (line !== this.line()) this.patch({ line });
  }

  protected submit() {
    const line = submitEntry(this.line());
    if (line === this.line()) return;
    this.settle(line);
  }

  // ---- Heavier or lighter -------------------------------------------------------------------

  protected pick(choice: Pick) {
    const line = answerCompare(this.line(), choice);
    if (line === this.line()) return;
    this.settle(line);
  }

  // ---- Cooking ------------------------------------------------------------------------------

  /** After a check: cook a finished line, or let the beam (or pot) show what is off. */
  private settle(line: LineState) {
    if (line.done) {
      this.cook(line);
      return;
    }
    const round = this.round();
    this.sounds.play(
      line.verdict === 'leftDown' || line.verdict === 'rightDown' ? 'creak' : 'oops',
    );
    this.patch({
      line,
      streak: 0,
      counters: { ...round.counters, slips: round.counters.slips + 1 },
    });
    this.focusAfterSlip(line);
  }

  private cook(line: LineState) {
    this.stopSoup();
    const round = this.round();
    const firstTry = line.slips === 0;
    const fewest = usedFewest(line);
    const inTime = this.timed() && this.soupTotal() > 0 && !round.bubbled;
    const hearty = round.streak >= HEARTY_STREAK && firstTry;
    const feast = this.feast();
    const gain = cookPoints({ firstTry, fewest, inTime, hearty, feast });
    const streak = firstTry ? round.streak + 1 : 0;
    this.hatchery.warm();
    const tags: ScalesMessageKey[] = [];
    if (firstTry && (hearty || feast)) tags.push('firstTryTag');
    if (fewest) tags.push(line.task.kind === 'pour' ? 'fewestPour' : 'fewestBonus');
    if (inTime) tags.push('inTimeBonus');
    this.patch({
      line,
      score: round.score + gain,
      gain,
      tags,
      reward: feast ? 'feast' : hearty ? 'hearty' : firstTry ? 'first' : 'cooked',
      streak,
      bestStreak: Math.max(round.bestStreak, streak),
      results: [...round.results, firstTry],
      fewest: round.fewest + (fewest ? 1 : 0),
      counters: { ...round.counters, cooks: round.counters.cooks + 1 },
    });
    if (countGuidedLine() >= GUIDED_LINES) this.learning.set(false);
    this.sounds.play('level', streak);
    this.sounds.play('splash');
    if (streak === HEARTY_STREAK) {
      this.sounds.play('trumpet');
      this.showBanner('heartyBanner');
    }
    this.timer = setTimeout(() => this.next(), ADVANCE_DELAY);
    this.focus('.after-cook .primary');
  }

  protected next() {
    clearTimeout(this.timer);
    const round = this.round();
    if (!round.line.done || round.complete) return;
    if (round.index + 1 < ROUND_LENGTH) {
      const index = round.index + 1;
      this.patch({
        index,
        line: startLine(round.tasks[index]),
        bubbled: false,
        reward: null,
      });
      if (index === LINES) this.showBanner('feastBanner');
      this.beginLine();
      return;
    }
    this.patch({ complete: true, reward: null });
    this.saveFailed.set(!this.record());
    const result = this.scores.finish(this.levelId(), round.score);
    this.newBest.set(result.best);
    this.dishAdded.set(result.dish);
    this.sounds.play('jingle');
    requestAnimationFrame(() => this.outcome()?.nativeElement.focus({ preventScroll: true }));
  }

  /** Keys: digits and Backspace type, Enter checks; A and B pick the left or right thing. */
  protected onKey(event: KeyboardEvent) {
    if (
      event.repeat ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      !this.started() ||
      this.coachOpen() ||
      this.round().complete
    )
      return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('input, textarea, select')) return;
    const kind = this.task().kind;
    if (kind !== 'dial' && kind !== 'missing') return;
    if (/^\d$/.test(event.key)) {
      event.preventDefault();
      this.type(Number(event.key));
    } else if (event.key === 'Backspace') {
      event.preventDefault();
      this.erase();
    } else if (event.key === 'Enter' && !target?.closest('button')) {
      event.preventDefault();
      this.submit();
    }
  }

  // ---- Status and help text -----------------------------------------------------------------

  protected statusText() {
    const line = this.line();
    if (line.done) return this.t(line.slips === 0 ? 'statusCookedFirst' : 'statusCooked');
    if (this.round().bubbled && !line.verdict) return this.t('bubbled');
    if (line.task.kind === 'balance' && line.held && line.placed.length)
      return this.t('statusHeld');
    if (line.task.kind === 'pour' && line.placed.length && !line.verdict)
      return this.t('statusPoured');
    if (line.entry) return this.t('statusTyped');
    return this.question();
  }

  protected helpText() {
    const line = this.line();
    const task = line.task;
    switch (line.verdict) {
      case 'leftDown':
      case 'rightDown': {
        const side = this.t(line.verdict === 'leftDown' ? 'helpLeftDown' : 'helpRightDown');
        if (task.kind === 'missing' && line.guess !== null)
          return `${this.t('helpGuess', { w: this.amount(line.guess) })} ${side}`;
        return side;
      }
      case 'misread':
        return this.t('helpMisread');
      case 'over':
        return this.t('helpOver');
      case 'under':
        return this.t('helpUnder');
      case 'wrongPick':
        if (task.kind !== 'compare') return '';
        if (task.labelled) return this.t('helpLabelled');
        return this.t(
          task.ask === 'heavier'
            ? 'helpHeavier'
            : task.ask === 'lighter'
              ? 'helpLighter'
              : 'helpClaim',
        );
      default:
        return '';
    }
  }

  protected weightLabel(amount: number) {
    return this.amount(amount);
  }

  protected placedTotal() {
    return sum(this.line().placed);
  }

  // ---- Soup timer ---------------------------------------------------------------------------

  private beginLine() {
    this.startSoup();
    const kind = this.task().kind;
    this.focus(
      kind === 'balance'
        ? '.weight-button'
        : kind === 'pour'
          ? '.jug-button'
          : kind === 'compare'
            ? '.pick'
            : '.pad-key',
    );
  }

  private startSoup() {
    this.stopSoup();
    const seconds = soupSeconds(this.pace(), this.task().kind);
    this.soupTotal.set(seconds);
    if (!seconds) return;
    this.soupRemaining = seconds * 1000;
    this.armSoup();
  }

  private armSoup() {
    clearInterval(this.tick);
    this.soupDue = Date.now() + this.soupRemaining;
    const count = () => {
      const left = Math.max(0, this.soupDue - Date.now());
      this.secondsLeft.set(Math.ceil(left / 1000));
      if (left > 0) return;
      this.stopSoup();
      this.patch({ bubbled: true });
      this.sounds.play('bubble');
    };
    count();
    this.tick = setInterval(count, 250);
  }

  private stopSoup() {
    clearInterval(this.tick);
    this.tick = undefined;
  }

  protected visibilityChanged() {
    const round = this.round();
    if (!this.started() || this.coachOpen() || round.complete || round.bubbled || round.line.done)
      return;
    if (this.document.hidden && this.tick) {
      this.soupRemaining = Math.max(0, this.soupDue - Date.now());
      this.stopSoup();
    } else if (!this.document.hidden && !this.tick && this.soupTotal()) {
      this.armSoup();
    }
  }

  // ---- Helpers ------------------------------------------------------------------------------

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

  /** Opens "how to cook". The soup timer holds while the film is open. */
  protected openCoach() {
    if (!this.started() || this.coachOpen()) return;
    clearTimeout(this.idleTimer);
    this.idle.set(false);
    if (this.tick) {
      this.soupRemaining = Math.max(0, this.soupDue - Date.now());
      this.stopSoup();
    }
    this.coachOpen.set(true);
  }

  protected closeCoach() {
    if (!this.coachOpen()) return;
    this.coachOpen.set(false);
    const round = this.round();
    if (this.soupTotal() && !round.bubbled && !round.line.done && !this.document.hidden)
      this.armSoup();
    this.armIdle();
    this.focus('.help');
  }

  private showBanner(key: ScalesMessageKey) {
    clearTimeout(this.bannerTimer);
    this.banner.set(key);
    this.bannerTimer = setTimeout(() => this.banner.set(null), BANNER_TIME);
  }

  private focusAfterSlip(line: LineState) {
    const kind = line.task.kind;
    if (kind === 'dial' || kind === 'missing') this.focus('.pad-key');
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

  private focus(selector: string) {
    requestAnimationFrame(() =>
      this.host.nativeElement
        .querySelector<HTMLElement>(`${selector}:not([disabled])`)
        ?.focus({ preventScroll: true }),
    );
  }

  private readPace(): ScalesPace {
    try {
      return parseScalesPace(this.document.defaultView?.localStorage.getItem(PACE_KEY));
    } catch {
      return 'off';
    }
  }

  private fresh(): Round {
    const tasks = createRound(this.stage());
    return {
      tasks,
      index: 0,
      line: startLine(tasks[0]),
      score: 0,
      gain: 0,
      tags: [],
      reward: null,
      streak: 0,
      bestStreak: 0,
      results: [],
      fewest: 0,
      bubbled: false,
      complete: false,
      counters: NO_COUNTERS,
    };
  }
}
