import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
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
import { CoachDialog, Icon, RewardBurst, StackedFraction } from '@feenland/ui';
import { CompletionService } from '../../core/completion';
import { GuideCounter, IDLE_GUIDE } from '../../core/guide-counter';
import { LocaleService } from '../../core/locale';
import { MessageKey } from '../../core/messages';
import { ProgressService } from '../../core/progress';
import { GameHeader } from '../../shared/game-header';
import { ThreeStage, WorldLoader } from '../../shared/three/three-stage';
import { HatcheryStore } from '../hatchery/hatchery-store';
import { piecePaths, foodBox } from './food-geometry';
import { equalSizes, frac, Fraction, fractionOfSet, TICKS } from './fractions';
import { PicnicCutter } from './picnic-cutter';
import { PicnicDeal } from './picnic-deal';
import { DemoCard, PicnicDemo } from './picnic-demo';
import { PicnicFace } from './picnic-face';
import { PicnicFood } from './picnic-food';
import { FoodOnBlanket, PicnicFrame } from './picnic-frame';
import { FRIENDS, FriendKind, guestsFor } from './picnic-friends';
import {
  antSeconds,
  bigger,
  createRound,
  Drawing,
  Food,
  GOLDEN_STREAK,
  isMastered,
  parsePicnicPace,
  PICNIC_PACES,
  PicnicPace,
  picnicPosition,
  picnicStage,
  picnicStages,
  ROUND_LENGTH,
  roundFood,
  roundStars,
  SHARES,
  sharePoints,
  Task,
  taskFriends,
  TOTAL_STAGES,
} from './picnic-levels';
import { fractionWords, picnicText, PicnicMessageKey } from './picnic-messages';
import { PicnicScene } from './picnic-scene';
import { PicnicScores } from './picnic-scores';
import { PicnicSounds } from './picnic-sounds';
import {
  answerCompare,
  answerDeal,
  answerFair,
  answerName,
  answerPick,
  basketLeft,
  canDeal,
  clearCuts,
  cutSizes,
  deal,
  fractionKey,
  Help,
  share,
  Side,
  startTask,
  Step,
  TaskState,
  toggleCut,
} from './picnic-task';

type Values = Record<string, string | number>;
type Note = {
  readonly key: PicnicMessageKey;
  readonly values?: Values;
  readonly fractions?: Fractions;
};
type Fractions = Partial<Record<'f' | 'g', Fraction>>;
/** A line of text with stacked fractions in it. */
export type Segment =
  | { readonly text: string }
  | { readonly fraction: Fraction; readonly words: string };
type RewardKind = 'yum' | 'first' | 'golden' | 'cake';

interface Counters {
  readonly rights: number;
  readonly wrongs: number;
  readonly cuts: number;
  readonly deals: number;
}

interface Round {
  readonly tasks: readonly Task[];
  readonly index: number;
  readonly state: TaskState;
  readonly score: number;
  readonly gain: number;
  readonly tags: readonly PicnicMessageKey[];
  readonly reward: RewardKind | null;
  readonly streak: number;
  readonly bestStreak: number;
  readonly firstTries: number;
  /** Shares made before the ants arrived. */
  readonly crumbs: number;
  /** The ants reached the blanket on this share. */
  readonly antsCame: boolean;
  /** Berries on each plate before the last handful, so only the new ones drop in. */
  readonly dealtBefore: number;
  /** The child's end to "More friends, so each slice is …". */
  readonly more: 'bigger' | 'smaller' | null;
  /** Goes up after each uneven share, to shake the food. */
  readonly wobble: number;
  readonly complete: boolean;
  readonly counters: Counters;
  readonly help: Help | null;
  readonly note: Note | null;
}

const PACE_KEY = 'feenland.picnic-pace.v1';
const ADVANCE_DELAY = 3800;
const BANNER_TIME = 2600;
const NO_COUNTERS: Counters = { rights: 0, wrongs: 0, cuts: 0, deals: 0 };

/** Fills "{f}" and "{g}" with stacked fractions and the other "{x}" with values. */
export function segments(
  template: string,
  values: Values,
  fractions: Fractions,
  words: (f: Fraction) => string,
): Segment[] {
  const filled = template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name === 'f' || name === 'g' ? match : name in values ? String(values[name]) : match,
  );
  return filled
    .split(/(\{[fg]\})/)
    .filter((part) => part !== '')
    .map((part) => {
      const name = /^\{([fg])\}$/.exec(part)?.[1] as 'f' | 'g' | undefined;
      const fraction = name ? fractions[name] : undefined;
      return fraction ? { fraction, words: words(fraction) } : { text: part };
    });
}

@Component({
  selector: 'app-picnic',
  imports: [
    NgTemplateOutlet,
    RouterLink,
    Icon,
    StackedFraction,
    RewardBurst,
    CoachDialog,
    GameHeader,
    ThreeStage,
    PicnicScene,
    PicnicCutter,
    PicnicDeal,
    PicnicDemo,
    PicnicFace,
    PicnicFood,
  ],
  providers: [PicnicSounds],
  templateUrl: './picnic.html',
  styleUrls: ['./picnic.css', './picnic-play.css', './picnic-work.css'],
  host: {
    '(document:keydown)': 'onKey($event)',
    '(document:visibilitychange)': 'visibilityChanged()',
  },
})
export class Picnic {
  protected readonly i = inject(LocaleService);
  private readonly p = inject(ProgressService);
  private readonly hatchery = inject(HatcheryStore);
  private readonly completion = inject(CompletionService);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  protected readonly sounds = inject(PicnicSounds);
  protected readonly scores = inject(PicnicScores);
  private readonly params = toSignal(inject(ActivatedRoute).paramMap);
  private readonly guideCounter = new GuideCounter('feenland.picnic-guided.v1');

  protected readonly total = TOTAL_STAGES;
  protected readonly shares = SHARES;
  protected readonly slots = Array.from({ length: ROUND_LENGTH }, (_, index) => index);
  protected readonly starSlots = [1, 2, 3];
  protected readonly friends = FRIENDS;
  protected readonly stage = computed(
    () => picnicStage(this.params()?.get('id')) ?? picnicStage('picnic-1')!,
  );
  protected readonly levelId = computed(() => `picnic-${this.stage().stage}`);
  protected readonly position = computed(() => picnicPosition(this.stage()));
  protected readonly levelLinks = picnicStages.map((stage, index) => ({
    stage: stage.stage,
    position: index + 1,
    route: ['/adventure', `picnic-${stage.stage}`],
  }));
  protected readonly nextLink = computed(() => {
    const next = picnicStages[this.position()];
    return next ? ['/adventure', `picnic-${next.stage}`] : null;
  });

  protected readonly round = linkedSignal<Round>(() => this.fresh());
  protected readonly started = linkedSignal<boolean>(() => {
    this.stage();
    return false;
  });
  protected readonly paces = PICNIC_PACES;
  protected readonly pace = signal<PicnicPace>(this.readPace());
  protected readonly timed = computed(() => this.pace() !== 'off');
  /** Milliseconds left before the ants reach the blanket, and the whole walk. */
  protected readonly antLeft = signal(0);
  protected readonly antTotal = signal(0);
  protected readonly secondsLeft = computed(() => Math.ceil(this.antLeft() / 1000));
  protected readonly banner = signal<PicnicMessageKey | null>(null);
  protected readonly saveFailed = signal(false);
  protected readonly newBest = signal(false);
  protected readonly newFriend = signal<FriendKind | null>(null);
  protected readonly coachOpen = signal(false);
  /** The first few shares on a device always show what to tap next. */
  private readonly learning = signal(this.guideCounter.learning());
  private readonly idle = signal(false);

  protected readonly state = computed(() => this.round().state);
  protected readonly task = computed(() => this.state().task);
  protected readonly phase = computed(() => this.state().phase);
  protected readonly cake = computed(() => this.round().index === ROUND_LENGTH - 1);
  protected readonly golden = computed(
    () => this.round().streak >= GOLDEN_STREAK && this.state().slips === 0,
  );
  protected readonly guests = computed(() =>
    guestsFor(this.round().index, this.stage().stage, Math.min(10, taskFriends(this.task()))),
  );
  /** The friend a naming share is about: the first at the blanket. */
  protected readonly hero = computed(() => this.guests()[0]);
  protected readonly heroName = computed(() => this.t(this.hero()));
  protected readonly stars = computed(() => roundStars(this.round().firstTries));
  protected readonly best = computed(() => this.scores.best()[this.levelId()] ?? 0);
  protected readonly antShare = computed(() =>
    this.antTotal() ? Math.max(0, Math.min(1, 1 - this.antLeft() / this.antTotal())) : 0,
  );

  /** The film on the level card and in the ? dialog, with numbers that are never the share. */
  protected readonly demoCard = computed<DemoCard>(() => {
    const task = this.started() ? this.task() : this.round().tasks[0];
    switch (task.kind) {
      case 'cut':
      case 'fair': {
        const parts = task.kind === 'cut' ? task.parts : task.sizes.length;
        return {
          kind: 'cut',
          food: task.food === 'pie' ? 'bar' : 'pie',
          parts: parts === 4 ? 3 : parts === 2 ? 2 : 4,
        };
      }
      case 'name':
      case 'pick': {
        const share = task.share.n === 1 && task.share.d === 4 ? frac(1, 3) : frac(1, 4);
        return {
          kind: 'name',
          food: 'pie',
          share,
          others: share.d === 3 ? [frac(1, 4), frac(1, 2)] : [frac(1, 3), frac(1, 2)],
        };
      }
      case 'compare':
        return { kind: 'compare', food: 'pie', left: frac(1, 2), right: frac(1, 5) };
      case 'deal':
        return { kind: 'deal', total: 6, plates: task.share.d === 2 ? 3 : 2, others: [2, 4] };
    }
  });

  /** Which controls hop to say "tap one of these": always while learning, else after a wait. */
  protected readonly nextTap = computed(() => {
    if (!this.started() || this.round().complete || this.coachOpen()) return null;
    if (!this.learning() && !this.idle()) return null;
    const phase = this.phase();
    if (phase === 'done') return 'next';
    const kind = this.task().kind;
    if (kind === 'cut') return 'cut';
    if (kind === 'deal') return phase === 'answer' ? 'choices' : 'deal';
    return 'choices';
  });

  // ---- What the work area shows ---------------------------------------------------------------

  protected readonly ask = computed<Segment[]>(() => {
    const task = this.task();
    const phase = this.phase();
    switch (task.kind) {
      case 'cut': {
        const keys: Record<Food, PicnicMessageKey> = {
          pie: 'askCutPie',
          bar: 'askCutBar',
          ribbon: 'askCutRibbon',
          cake: 'askCutCake',
        };
        return this.line(keys[task.food], { n: task.parts });
      }
      case 'fair':
        return this.line('askFair', { n: task.sizes.length });
      case 'name':
        return this.line('askName', { name: this.heroName() });
      case 'pick':
        return this.line('askPick', {}, { f: task.share });
      case 'compare':
        return this.line(task.same ? 'askCompareSame' : 'askCompare');
      case 'deal':
        return phase === 'work'
          ? this.line('askDeal', { total: task.total, n: task.share.d })
          : this.line('askDealAnswer', { total: task.total }, { f: task.share });
    }
  });

  protected readonly status = computed<Segment[]>(() => {
    const round = this.round();
    if (round.note) return this.line(round.note.key, round.note.values, round.note.fractions);
    const task = this.task();
    switch (task.kind) {
      case 'cut': {
        const pieces = cutSizes(this.state()).length;
        return pieces > 1 ? this.line('statusCutMore', { n: pieces }) : this.line('statusCut');
      }
      case 'fair':
        return this.line('statusFair');
      case 'name':
        return this.line('statusName');
      case 'pick':
        return this.line('statusPick');
      case 'compare':
        return this.line('statusCompare');
      case 'deal':
        return this.line(this.phase() === 'work' ? 'statusDeal' : 'statusDealAnswer');
    }
  });

  protected readonly helpLine = computed<Segment[]>(() => {
    const help = this.round().help;
    return help ? this.line(help.key, { name: this.heroName() }) : [];
  });

  /** The smallest and biggest piece side by side, after an uneven cut. */
  protected readonly helpPieces = computed(() => {
    const help = this.round().help;
    if (!help || (help.key !== 'helpSame' && help.key !== 'helpFair')) return null;
    const task = this.task();
    const food: Food = task.kind === 'cut' || task.kind === 'fair' ? task.food : 'pie';
    const box = foodBox(food);
    return {
      food,
      box: `0 0 ${box.width} ${box.height}`,
      round: roundFood(food),
      pieces: help.pieces.map((size) =>
        roundFood(food)
          ? piecePaths(food, [size, 1 - size])[0].d
          : piecePaths(food, [size, 1 - size])[0].d,
      ),
    };
  });

  protected readonly pieceCount = computed(() => cutSizes(this.state()).length);
  protected readonly markLabels = computed(() =>
    Array.from({ length: TICKS - 1 }, (_, index) => this.t('cutMark', { n: index + 1 })),
  );

  /** A drawn food's description for screen readers. */
  protected drawingLabel(drawing: {
    food: Food;
    sizes: readonly number[];
    shaded: readonly boolean[];
  }) {
    const equal = drawing.sizes.every((size) => Math.abs(size - drawing.sizes[0]) < 1e-9);
    const food = this.t(foodKey(drawing.food));
    const values = { food, d: drawing.sizes.length, k: drawing.shaded.filter(Boolean).length };
    return equal ? this.t('drawingLabel', values) : this.t('drawingUneven', values);
  }

  protected plateLabel(index: number, plate: Drawing) {
    const equal = plate.sizes.every((size) => Math.abs(size - plate.sizes[0]) < 1e-9);
    const values = { d: plate.sizes.length, k: plate.shaded.filter(Boolean).length };
    return `${this.t('plateLabel', { n: index + 1 })}: ${this.t(equal ? 'plateEqual' : 'plateUneven', values)}`;
  }

  protected readonly nameDrawing = computed(() => {
    const task = this.task();
    if (task.kind !== 'name') return null;
    const sizes = equalSizes(task.share.d);
    return { food: task.food, sizes, shaded: sizes.map((_, i) => i < task.share.n) };
  });

  protected readonly fairDrawing = computed(() => {
    const task = this.task();
    if (task.kind !== 'fair') return null;
    return { food: task.food, sizes: task.sizes, shaded: task.sizes.map(() => false) };
  });

  /** The two blankets of a comparison, left and right. */
  protected readonly blankets = computed(() => {
    const task = this.task();
    if (task.kind !== 'compare') return [];
    const units = task.left.n === 1 && task.right.n === 1;
    return (['left', 'right'] as const).map((side) => {
      const f = task[side];
      const sizes = equalSizes(f.d);
      const drawing = { food: task.food, sizes, shaded: sizes.map((_, i) => i < f.n) };
      return {
        side,
        fraction: f,
        words: this.words(f),
        drawing,
        friends: units ? guestsFor(side === 'left' ? 1 : 7, this.stage().stage, f.d) : [],
        // Read before the fraction's own words, which end the button's name.
        lead: units
          ? this.t('blanketLabel', { n: f.d }).replace('{f}', '').trim()
          : `${this.drawingLabel(drawing)}:`,
      };
    });
  });

  protected readonly dealPlates = computed(() => {
    const task = this.task();
    if (task.kind !== 'deal') return null;
    const dealt = this.state().dealt;
    const later = task.share.d - task.share.n;
    const guests = this.guests();
    const plateLabels = guests.map((guest, index) =>
      index >= guests.length - (task.share.n === 1 ? 0 : later)
        ? this.t('laterBerries', { n: dealt })
        : this.t('plateBerries', { name: this.t(guest), n: dealt }),
    );
    const left = basketLeft(this.state());
    return {
      total: task.total,
      dealt,
      before: this.round().dealtBefore,
      guests,
      later: task.share.n === 1 ? 0 : later,
      basketLabel: left ? this.t('basketLabel', { n: left }) : this.t('basketEmpty'),
      plateLabels,
      handfuls: task.handfuls.map((handful) => ({
        handful,
        ok: canDeal(this.state(), handful),
      })),
    };
  });

  protected readonly frame = computed<PicnicFrame>(() => {
    const round = this.round();
    const state = round.state;
    const task = state.task;
    const served = state.phase === 'done';
    let foods: FoodOnBlanket[] = [];
    let berries: PicnicFrame['berries'] = null;
    switch (task.kind) {
      case 'cut':
        foods = [
          {
            food: task.food,
            sizes: cutSizes(state).map((size) => size / TICKS),
            shaded: [],
            covered: false,
          },
        ];
        break;
      case 'fair':
        foods = [{ food: task.food, sizes: task.sizes, shaded: [], covered: false }];
        break;
      case 'name': {
        const sizes = equalSizes(task.share.d);
        foods = [
          { food: task.food, sizes, shaded: sizes.map((_, i) => i < task.share.n), covered: false },
        ];
        break;
      }
      case 'pick': {
        const sizes = served ? equalSizes(task.share.d) : [1];
        foods = [
          {
            food: task.plates[0].food,
            sizes,
            shaded: sizes.map((_, i) => served && i < task.share.n),
            covered: false,
          },
        ];
        break;
      }
      case 'compare':
        foods = [task.left, task.right].map((f) => {
          const sizes = equalSizes(f.d);
          return {
            food: task.food,
            sizes,
            shaded: sizes.map((_, i) => i < f.n),
            covered: task.covered && !served,
          };
        });
        break;
      case 'deal': {
        const later = task.share.n === 1 ? 0 : task.share.d - task.share.n;
        berries = {
          basket: basketLeft(state),
          plates: Array.from({ length: task.share.d }, () => state.dealt),
          later,
        };
        break;
      }
    }
    return {
      share: round.index,
      kind: task.kind,
      foods,
      berries,
      guests: this.guests(),
      ants: this.timed() && this.antTotal() && !round.complete ? this.antShare() : null,
      crumbGone: round.antsCame,
      golden: this.golden() || (served && round.reward === 'golden'),
      cake: this.cake(),
      served,
      joined: this.scores.joined(),
      finished: round.complete,
      ...round.counters,
    };
  });
  protected readonly loadWorld: WorldLoader<PicnicFrame> = () =>
    import('./picnic-world').then((m) => m.PicnicWorld);

  protected readonly reward = computed(() => {
    const round = this.round();
    if (round.state.phase !== 'done' || !round.reward || round.complete) return null;
    const cheers: Record<RewardKind, PicnicMessageKey> = {
      yum: 'rewardYum',
      first: 'rewardFirst',
      golden: 'rewardGolden',
      cake: 'rewardCake',
    };
    return {
      tone: (round.reward === 'cake' ? 'big' : round.reward === 'golden' ? 'golden' : 'plain') as
        | 'big'
        | 'golden'
        | 'plain',
      cheer: this.t(cheers[round.reward]),
      tags: round.tags.map((key) => this.t(key)),
      points: this.t('rewardPoints', { n: this.i.format(round.gain) }),
    };
  });

  private readonly outcome = viewChild<ElementRef<HTMLElement>>('outcome');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private timer?: ReturnType<typeof setTimeout>;
  private idleTimer?: ReturnType<typeof setTimeout>;
  private bannerTimer?: ReturnType<typeof setTimeout>;
  private tick?: ReturnType<typeof setInterval>;
  private antDue = 0;
  private antRemaining = 0;

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

  protected t(key: PicnicMessageKey, values: Values = {}) {
    return picnicText(this.i.locale(), key, values);
  }
  protected words(f: Fraction) {
    return fractionWords(this.i.locale(), f);
  }
  private line(key: PicnicMessageKey, values: Values = {}, fractions: Fractions = {}) {
    return segments(picnicTranslationsFor(this.i.locale(), key), values, fractions, (f) =>
      this.words(f),
    );
  }
  protected levelKey(stage: number) {
    return `picnic${stage}` as MessageKey;
  }
  protected tipKey(stage: number) {
    return `tip${stage}` as PicnicMessageKey;
  }
  protected paceSeconds(pace: PicnicPace) {
    return antSeconds(pace, this.round().tasks[0]);
  }
  protected isText(segment: Segment): segment is { text: string } {
    return 'text' in segment;
  }
  protected tried(key: string) {
    return this.state().tried.includes(key);
  }
  protected fractionKey(f: Fraction) {
    return fractionKey(f);
  }

  protected selectPace(pace: PicnicPace) {
    this.pace.set(pace);
    try {
      this.document.defaultView?.localStorage.setItem(PACE_KEY, pace);
    } catch {
      /* The choice stays for this visit. */
    }
    if (this.started() && pace === 'off') {
      this.stopAnts();
      this.antTotal.set(0);
    }
  }

  protected play() {
    clearTimeout(this.timer);
    this.stopAnts();
    this.round.set(this.fresh());
    this.saveFailed.set(false);
    this.newBest.set(false);
    this.newFriend.set(null);
    this.started.set(true);
    this.sounds.play('start');
    this.beginShare();
    this.armIdle();
  }

  // ---- Cutting --------------------------------------------------------------------------------

  protected cutAt(mark: number) {
    const round = this.round();
    const state = toggleCut(round.state, mark);
    if (state === round.state) return;
    const added = state.cuts.length > round.state.cuts.length;
    this.sounds.play(added ? 'snip' : 'unsnip');
    this.patch({
      state,
      note: null,
      counters: added ? { ...round.counters, cuts: round.counters.cuts + 1 } : round.counters,
    });
  }

  protected startOver() {
    const state = clearCuts(this.round().state);
    if (state !== this.round().state) this.patch({ state, note: null, help: null });
  }

  protected shareCut() {
    const step = share(this.round().state);
    if (step.state === this.round().state && !step.right) return;
    if (!step.right && step.help?.key === 'helpSame')
      this.patch({ wobble: this.round().wobble + 1 });
    this.settle(step);
  }

  // ---- Answers --------------------------------------------------------------------------------

  protected answerFair(fair: boolean) {
    this.settle(answerFair(this.round().state, fair));
  }

  protected answerName(f: Fraction) {
    this.settle(answerName(this.round().state, f));
  }

  protected answerPick(index: number) {
    this.settle(answerPick(this.round().state, index));
  }

  protected answerCompare(side: Side) {
    this.settle(answerCompare(this.round().state, side));
  }

  /** "More friends, so each slice is …": the child finishes the thought. */
  protected finishThought(answer: 'bigger' | 'smaller') {
    this.patch({ more: answer });
    if (answer === 'smaller') this.sounds.play('heart', 0);
  }

  protected dealHandful(handful: number) {
    const round = this.round();
    const state = deal(round.state, handful);
    if (state === round.state) return;
    this.sounds.play('deal', handful);
    this.patch({
      state,
      dealtBefore: round.state.dealt,
      counters: { ...round.counters, deals: round.counters.deals + 1 },
      note: state.phase === 'answer' ? { key: 'dealtAll' } : null,
      help: null,
    });
    if (state.phase === 'answer') this.focus('.choices .choice');
  }

  protected answerDeal(value: number) {
    this.settle(answerDeal(this.round().state, value));
  }

  private settle(step: Step) {
    if (step.right) this.win(step.state);
    else if (step.state !== this.round().state) this.slip(step.state, step.help);
  }

  private win(state: TaskState) {
    this.stopAnts();
    const round = this.round();
    const firstTry = state.slips === 0;
    const crumb = this.timed() && this.antTotal() > 0 && !round.antsCame;
    const golden = round.streak >= GOLDEN_STREAK && firstTry;
    const cake = this.cake();
    const gain = sharePoints({ firstTry, crumb, golden, cake });
    const streak = firstTry ? round.streak + 1 : 0;
    const tags: PicnicMessageKey[] = [];
    if (firstTry && (golden || cake)) tags.push('firstBonus');
    if (crumb) tags.push('crumbBonus');
    this.patch({
      state,
      score: round.score + gain,
      gain,
      tags,
      reward: cake ? 'cake' : golden ? 'golden' : firstTry ? 'first' : 'yum',
      streak,
      bestStreak: Math.max(round.bestStreak, streak),
      firstTries: round.firstTries + (firstTry ? 1 : 0),
      crumbs: round.crumbs + (crumb ? 1 : 0),
      counters: { ...round.counters, rights: round.counters.rights + 1 },
      note: this.rightNote(state.task),
      help: null,
      more: null,
    });
    this.hatchery.warm();
    this.scores.shared();
    if (this.guideCounter.add() >= this.guideCounter.limit) this.learning.set(false);
    this.sounds.play('share');
    this.sounds.play('munch');
    this.sounds.play('heart', streak);
    if (streak === GOLDEN_STREAK) {
      this.sounds.play('trumpet');
      this.showBanner('goldenBanner');
    }
    this.timer = setTimeout(() => this.next(), ADVANCE_DELAY);
    this.focus('.after .primary');
  }

  private rightNote(task: Task): Note {
    switch (task.kind) {
      case 'cut':
        return { key: 'rightCut', fractions: { f: frac(1, task.parts) } };
      case 'fair':
        return { key: task.fair ? 'rightFair' : 'rightUnfair' };
      case 'name':
        return {
          key: 'rightName',
          values: { name: this.heroName() },
          fractions: { f: task.share },
        };
      case 'pick':
        return { key: 'rightPick', fractions: { f: task.share } };
      case 'compare': {
        const side = bigger(task);
        if (side === 'same')
          return { key: 'rightSame', fractions: { f: task.left, g: task.right } };
        const [big, small] = side === 'left' ? [task.left, task.right] : [task.right, task.left];
        return { key: 'rightMore', fractions: { f: big, g: small } };
      }
      case 'deal':
        return {
          key: 'rightDeal',
          values: { total: task.total, n: fractionOfSet(task.share, task.total) ?? 0 },
          fractions: { f: task.share },
        };
    }
  }

  private slip(state: TaskState, help: Help | undefined) {
    const round = this.round();
    this.sounds.play('oops');
    this.patch({
      state,
      streak: 0,
      counters: { ...round.counters, wrongs: round.counters.wrongs + 1 },
      help: help ?? null,
      note: null,
      more: null,
    });
  }

  protected next() {
    clearTimeout(this.timer);
    const round = this.round();
    if (round.state.phase !== 'done' || round.complete) return;
    if (round.index + 1 < ROUND_LENGTH) {
      const index = round.index + 1;
      this.patch({
        index,
        state: startTask(round.tasks[index]),
        reward: null,
        antsCame: false,
        dealtBefore: 0,
        note: null,
        help: null,
        more: null,
      });
      if (index === ROUND_LENGTH - 1) this.showBanner('cakeBanner');
      this.beginShare();
      return;
    }
    this.patch({ complete: true, reward: null });
    this.saveFailed.set(!this.record());
    const result = this.scores.finish(this.levelId(), round.score);
    this.newBest.set(result.best);
    this.newFriend.set(result.friend);
    this.sounds.play('jingle');
    requestAnimationFrame(() => this.outcome()?.nativeElement.focus({ preventScroll: true }));
  }

  // ---- Keys -----------------------------------------------------------------------------------

  /** Keys: 1–4 pick an answer, plate or blanket; the rest is ordinary buttons. */
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
    if (!/^[1-4]$/.test(event.key)) return;
    const choices = this.host.nativeElement.querySelectorAll<HTMLButtonElement>(
      '.choices .choice:not([disabled])',
    );
    const all = this.host.nativeElement.querySelectorAll<HTMLButtonElement>('.choices .choice');
    const button = all[Number(event.key) - 1];
    if (button && [...choices].includes(button)) {
      event.preventDefault();
      button.click();
    }
  }

  // ---- The ants (the timer) -------------------------------------------------------------------

  private beginShare() {
    this.startAnts();
    const kind = this.task().kind;
    this.focus(kind === 'cut' ? '.mark' : kind === 'deal' ? '.handful' : '.choices .choice');
  }

  private startAnts() {
    this.stopAnts();
    const seconds = antSeconds(this.pace(), this.task(), this.cake());
    this.antTotal.set(seconds * 1000);
    this.antLeft.set(seconds * 1000);
    if (!seconds) return;
    this.antRemaining = seconds * 1000;
    this.armAnts();
  }

  private armAnts() {
    clearInterval(this.tick);
    this.antDue = Date.now() + this.antRemaining;
    const count = () => {
      const left = Math.max(0, this.antDue - Date.now());
      this.antLeft.set(left);
      if (left > 0) return;
      this.stopAnts();
      this.round.update((round) => ({
        ...round,
        antsCame: true,
        note: round.help ? round.note : { key: 'antsCame' },
      }));
      this.sounds.play('ants');
    };
    count();
    this.tick = setInterval(count, 200);
  }

  private stopAnts() {
    clearInterval(this.tick);
    this.tick = undefined;
  }

  protected visibilityChanged() {
    const round = this.round();
    if (
      !this.started() ||
      this.coachOpen() ||
      round.complete ||
      round.antsCame ||
      round.state.phase === 'done'
    )
      return;
    if (this.document.hidden && this.tick) {
      this.antRemaining = Math.max(0, this.antDue - Date.now());
      this.stopAnts();
    } else if (!this.document.hidden && !this.tick && this.antTotal()) {
      this.armAnts();
    }
  }

  // ---- Helpers --------------------------------------------------------------------------------

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

  /** Opens "how to share". The ants wait while the film is open. */
  protected openCoach() {
    if (!this.started() || this.coachOpen()) return;
    clearTimeout(this.idleTimer);
    this.idle.set(false);
    if (this.tick) {
      this.antRemaining = Math.max(0, this.antDue - Date.now());
      this.stopAnts();
    }
    this.coachOpen.set(true);
  }

  protected closeCoach() {
    if (!this.coachOpen()) return;
    this.coachOpen.set(false);
    const round = this.round();
    if (this.antTotal() && !round.antsCame && round.state.phase !== 'done' && !this.document.hidden)
      this.armAnts();
    this.armIdle();
    requestAnimationFrame(() =>
      this.host.nativeElement.querySelector<HTMLElement>('.help')?.focus({ preventScroll: true }),
    );
  }

  private showBanner(key: PicnicMessageKey) {
    clearTimeout(this.bannerTimer);
    this.banner.set(key);
    this.bannerTimer = setTimeout(() => this.banner.set(null), BANNER_TIME);
  }

  private focus(selector: string) {
    requestAnimationFrame(() =>
      this.host.nativeElement
        .querySelector<HTMLElement>(`${selector}:not([disabled])`)
        ?.focus({ preventScroll: true }),
    );
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

  private readPace(): PicnicPace {
    try {
      return parsePicnicPace(this.document.defaultView?.localStorage.getItem(PACE_KEY));
    } catch {
      return 'off';
    }
  }

  private fresh(): Round {
    const tasks = createRound(this.stage());
    return {
      tasks,
      index: 0,
      state: startTask(tasks[0]),
      score: 0,
      gain: 0,
      tags: [],
      reward: null,
      streak: 0,
      bestStreak: 0,
      firstTries: 0,
      crumbs: 0,
      antsCame: false,
      dealtBefore: 0,
      more: null,
      wobble: 0,
      complete: false,
      counters: NO_COUNTERS,
      help: null,
      note: null,
    };
  }
}

const foodKey = (food: Food): PicnicMessageKey =>
  food === 'pie'
    ? 'foodPie'
    : food === 'bar'
      ? 'foodBar'
      : food === 'ribbon'
        ? 'foodRibbon'
        : 'foodCake';

/** The raw template for a key, with its placeholders still in. */
function picnicTranslationsFor(locale: Parameters<typeof picnicText>[0], key: PicnicMessageKey) {
  return picnicText(locale, key);
}
