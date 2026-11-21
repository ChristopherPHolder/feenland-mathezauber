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
import { CoachDialog, Icon, NumberPad, RewardBurst, RewardBurstKind } from '@feenland/ui';
import { CompletionService } from '../../core/completion';
import { guideCounter } from '../../core/guide-counter';
import { LocaleService } from '../../core/locale';
import { MessageKey } from '../../core/messages';
import { ProgressService } from '../../core/progress';
import { GameHeader } from '../../shared/game-header';
import { ThreeStage, WorldLoader } from '../../shared/three/three-stage';
import { HatcheryStore } from '../hatchery/hatchery-store';
import { GOOD_EMOJI, MarketFrame, stillFrame } from './market-frame';
import {
  affordable,
  changeDue,
  checkChange,
  checkLeft,
  checkTotal,
  checkPay,
  daylightSeconds,
  GOLDEN_STREAK,
  GOOD_IDS,
  GoodId,
  isFewest,
  isFewestChange,
  isMastered,
  MARKET_PACES,
  MarketPace,
  marketPosition,
  marketStage,
  marketStages,
  MarketTurn,
  parseMarketPace,
  purseTotal,
  Random,
  replayMissed,
  roundStars,
  Step,
  TOTAL_STAGES,
  turnPoints,
} from './market-levels';
import { capitalise, marketText, MarketMessageKey } from './market-messages';
import { Denomination, fewestCoins, formatMoney, isNote, total } from './market-money';
import { filmClash, filmFor, MarketDemo } from './market-demo';
import { MarketMoney } from './market-money-art';
import { MarketScores } from './market-scores';
import { MarketBasket } from './market-basket';
import { MarketShop } from './market-shop';
import { MarketSounds } from './market-sounds';

interface Bought {
  readonly good: GoodId;
  readonly price: number;
}

interface Round {
  readonly turns: readonly MarketTurn[];
  readonly index: number;
  /** Which of the turn's steps the child is on. */
  readonly step: number;
  readonly phase: 'shop' | 'solved' | 'complete';
  /** Indexes into the turn's purse of the coins on the tray, in the order they went down. */
  readonly tray: readonly number[];
  readonly typed: string;
  /** Wrong answers on this turn, over all its steps. */
  readonly slips: number;
  readonly outcome: 'none' | 'bought' | 'putBack';
  readonly streak: number;
  readonly bestStreak: number;
  readonly golden: boolean;
  readonly firstTries: number;
  /** One entry per finished turn: was it right on the first try? */
  readonly log: readonly boolean[];
  readonly score: number;
  readonly gain: number;
  readonly badges: readonly MarketMessageKey[];
  readonly cheer: MarketMessageKey;
  readonly bought: readonly Bought[];
  readonly coins: number;
  readonly pays: number;
  readonly slipCount: number;
  readonly cheers: number;
}

interface Status {
  readonly key: MarketMessageKey;
  readonly values?: Record<string, string | number>;
  readonly lead?: MarketMessageKey;
}

const PACE_KEY = 'feenland.market-pace.v1';
/** Turns finished on a device before the "tap here next" halo only comes back when idle. */
const GUIDED_TURNS = 3;
const guide = guideCounter('feenland.market-guided.v1');
/** The 3D till rings and the treat flies to the basket before the reward card. */
const REWARD_WAIT_3D = 1;
/** How long the reward shows before the next treat comes. */
const SOLVE_DELAY = 2600;
const IDLE_MS = 6000;
const CHEERS: readonly MarketMessageKey[] = ['cheer1', 'cheer2', 'cheer3'];
const GOOD_KEY = (good: GoodId) => capitalise(good) as Capitalize<GoodId>;

@Component({
  selector: 'app-market',
  imports: [
    RouterLink,
    Icon,
    NumberPad,
    RewardBurst,
    CoachDialog,
    GameHeader,
    ThreeStage,
    MarketShop,
    MarketBasket,
    MarketMoney,
    MarketDemo,
  ],
  providers: [MarketSounds],
  templateUrl: './market.html',
  styleUrls: ['./market.css', './market-play.css'],
  host: {
    '(document:visibilitychange)': 'visibilityChanged()',
    '(document:keydown)': 'onKey($event)',
  },
})
export class Market {
  protected readonly i = inject(LocaleService);
  private readonly p = inject(ProgressService);
  private readonly hatchery = inject(HatcheryStore);
  private readonly completion = inject(CompletionService);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  protected readonly sounds = inject(MarketSounds);
  protected readonly scores = inject(MarketScores);
  private readonly params = toSignal(inject(ActivatedRoute).paramMap);
  /** Swapped out by tests for a seeded source. */
  random: Random = Math.random;

  protected readonly total = TOTAL_STAGES;
  protected readonly goodsTotal = GOOD_IDS.length;
  protected readonly emoji = GOOD_EMOJI;
  protected readonly stage = computed(
    () => marketStage(this.params()?.get('id')) ?? marketStage('market-1')!,
  );
  protected readonly levelId = computed(() => `market-${this.stage().stage}`);
  protected readonly position = computed(() => marketPosition(this.stage()));
  protected readonly levelLinks = marketStages.map((stage, index) => ({
    stage: stage.stage,
    position: index + 1,
    route: ['/adventure', `market-${stage.stage}`],
  }));
  protected readonly nextLink = computed(() => {
    const next = marketStages[this.position()];
    return next ? ['/adventure', `market-${next.stage}`] : null;
  });

  protected readonly round = linkedSignal<Round>(() => this.fresh());
  protected readonly started = linkedSignal<boolean>(() => {
    this.stage();
    return false;
  });
  protected readonly freeTrip = linkedSignal({ source: this.stage, computation: () => false });
  private readonly freeStart = viewChild<ElementRef<HTMLButtonElement>>('freeStart');

  protected leaveFreeTrip() {
    this.freeTrip.set(false);
    requestAnimationFrame(() => this.freeStart()?.nativeElement.focus());
  }

  protected readonly paces = MARKET_PACES;
  protected readonly pace = signal<MarketPace>(this.readPace());
  protected readonly timed = computed(() => this.pace() !== 'off');
  /** How far the sun has gone down this round, 0 to 1. */
  protected readonly sunset = signal(0);
  protected readonly status = signal<Status | null>(null);
  protected readonly saveFailed = signal(false);
  protected readonly newBest = signal(false);
  protected readonly newTreats = signal(0);
  protected readonly guided = signal(guide.count() < GUIDED_TURNS);
  protected readonly idle = signal(false);
  /** The "how to shop" film is open over the game; the sun waits. */
  protected readonly coaching = signal(false);

  protected readonly turn = computed(() => this.round().turns[this.round().index]);
  protected readonly turnsTotal = computed(() => this.stage().turns);
  protected readonly big = computed(() => this.round().index === this.turnsTotal() - 1);
  protected readonly step = computed<Step>(
    () => this.turn().steps[Math.min(this.round().step, this.turn().steps.length - 1)],
  );
  protected readonly shopping = computed(() => this.started() && this.round().phase === 'shop');
  /** Coins go onto the tray to pay, or out of the till as change when Lumi works it. */
  protected readonly counting = computed(() => this.step() === 'pay' || this.step() === 'give');
  /** Where the tray's coins come from: Lumi's purse, or the till drawer. */
  private readonly source = computed(() =>
    this.step() === 'give' ? (this.turn().till ?? []) : this.turn().purse,
  );
  protected readonly trayCoins = computed(() =>
    this.round().tray.map((index) => this.source()[index]),
  );
  /** Coins still in the purse (or the till), with their index, biggest first. */
  protected readonly purseCoins = computed(() =>
    this.source()
      .map((value, index) => ({ value, index }))
      .filter(({ index }) => !this.round().tray.includes(index)),
  );
  protected readonly paidText = computed(() => this.money(total(this.turn().paid ?? [])));
  protected readonly customerName = computed(() => {
    const customer = this.turn().customer;
    return customer ? this.t(`customer${capitalise(customer) as Capitalize<typeof customer>}`) : '';
  });
  protected readonly purseText = computed(() => this.money(purseTotal(this.turn())));
  protected readonly priceText = computed(() => this.money(this.turn().price));
  protected readonly goodName = computed(() => this.t(`the${GOOD_KEY(this.turn().good)}`));
  protected readonly question = computed(() =>
    this.t('costs', { good: capitalise(this.goodName()), price: this.priceText() }),
  );
  /** The shopping list of a multi-treat turn, with each price written out. */
  protected readonly listItems = computed(() =>
    (this.turn().items ?? []).map((item) => ({
      ...item,
      name: this.goodLabel(item.good),
      priceText: this.money(item.price),
    })),
  );
  /** What to do now. After a list is added up, the total is said, since the child found it. */
  protected readonly askText = computed(() => {
    const step = this.step();
    const list = !!this.turn().items;
    if (step === 'total') return this.t('askTotal');
    if (step === 'pay')
      return list ? this.t('payTotal', { amount: this.priceText() }) : this.t('askPay');
    if (step === 'enough') return this.t('askEnough');
    if (step === 'change') return this.t('askChange', { paid: this.paidText() });
    if (step === 'give')
      return this.t('askGive', { customer: this.customerName(), paid: this.paidText() });
    return list ? this.t('leftTotal', { amount: this.priceText() }) : this.t('askLeft');
  });
  protected readonly typing = computed(
    () => this.step() === 'total' || this.step() === 'left' || this.step() === 'change',
  );
  /** Change and till turns have no purse to look at: the note in hand is all that matters. */
  protected readonly showPurse = computed(() => this.step() !== 'change' && this.step() !== 'give');
  protected readonly film = computed(() => filmFor(this.stage().skill));
  protected readonly filmAlternate = computed(
    () =>
      this.started() &&
      filmClash(this.film(), [this.turn().price, ...(this.turn().items ?? []).map((i) => i.price)]),
  );
  /** The purse shows its coins on coin levels and while paying; later only its tag. */
  protected readonly showCoins = computed(
    () => this.step() === 'pay' || this.turn().look === 'coins',
  );
  protected readonly guideNow = computed(() => this.shopping() && (this.guided() || this.idle()));
  protected readonly stars = computed(() => roundStars(this.round().firstTries, this.turnsTotal()));
  protected readonly best = computed(() => this.scores.best()[this.levelId()] ?? 0);
  protected readonly turnSlots = computed(() =>
    Array.from({ length: this.turnsTotal() }, (_, index) => index),
  );
  protected readonly shelfSlots = GOOD_IDS;
  protected readonly spent = computed(() =>
    this.round().bought.reduce((sum, item) => sum + item.price, 0),
  );

  protected readonly frame = computed<MarketFrame>(() => {
    const round = this.round();
    const turn = this.turn();
    return {
      turn: round.index,
      phase: round.phase === 'complete' ? 'complete' : round.phase,
      good: turn.good,
      price: turn.price,
      priceText: this.money(this.turn().items?.[0]?.price ?? this.turn().price),
      extras: (this.turn().items ?? [])
        .slice(1)
        .map((item) => ({ good: item.good, priceText: this.money(item.price) })),
      role: this.step() === 'give' ? 'till' : 'shopper',
      customer: turn.customer ?? null,
      paid: turn.paid ?? [],
      change:
        round.phase !== 'shop' && this.step() === 'change'
          ? (fewestCoins(changeDue(turn), [1000, 500, 200, 100]) ?? [])
          : [],
      tray: this.trayCoins(),
      outcome: round.outcome,
      basket: round.bought.map((item) => item.good),
      shelf: this.scores.shelf().length,
      sunset: this.timed() && this.started() ? this.sunset() : 0,
      golden: round.golden,
      big: this.big(),
      coins: round.coins,
      pays: round.pays,
      slips: round.slipCount,
      cheers: round.cheers,
    };
  });
  protected readonly introFrame = computed<MarketFrame>(() =>
    stillFrame({ shelf: this.scores.shelf().length, good: 'honey' }),
  );
  protected readonly outcomeFrame = computed<MarketFrame>(() =>
    stillFrame({
      phase: 'complete',
      shelf: this.scores.shelf().length,
      basket: this.round().bought.map((item) => item.good),
      cheers: 1,
      good: this.round().bought.at(-1)?.good ?? 'honey',
    }),
  );
  protected readonly loadWorld: WorldLoader<MarketFrame> = () =>
    import('./market-world').then((m) => m.MarketWorld);

  protected readonly reward = computed(() => {
    const round = this.round();
    if (round.phase !== 'solved' || !round.gain) return null;
    const kind: RewardBurstKind = this.big() ? 'big' : round.golden ? 'golden' : 'plain';
    return {
      kind,
      cheer: this.t(round.cheer),
      points: this.t('gain', { n: this.i.format(round.gain) }),
      badges: round.badges.map((badge) => this.t(badge)),
    };
  });
  protected readonly statusText = computed(() => {
    const status = this.status();
    if (!status) return '';
    const text = this.t(status.key, status.values ?? {});
    return status.lead ? `${this.t(status.lead)} ${text}` : text;
  });

  private readonly outcome = viewChild<ElementRef<HTMLElement>>('outcome');
  private readonly sceneStage = viewChild<ThreeStage<MarketFrame>>('scene');
  private timer?: ReturnType<typeof setTimeout>;
  private idleTimer?: ReturnType<typeof setTimeout>;
  private tick?: ReturnType<typeof setInterval>;
  private daylight = 0;
  private sunLeft = 0;
  private sunDue = 0;

  constructor() {
    effect(() => {
      if (this.started()) this.p.explore('tens');
    });
    inject(DestroyRef).onDestroy(() => this.stopTimers());
  }

  protected t(key: MarketMessageKey, values: Record<string, string | number> = {}) {
    return marketText(this.i.locale(), key, values);
  }
  protected money(cents: number) {
    return formatMoney(cents, this.i.locale());
  }
  protected levelKey(stage: number) {
    return `market${stage}` as MessageKey;
  }
  protected goodLabel(good: GoodId) {
    return this.t(`name${GOOD_KEY(good)}`);
  }
  protected moneyName(value: Denomination) {
    return this.t(isNote(value) ? 'note' : 'coin', { value: this.money(value) });
  }
  protected paceSeconds(pace: MarketPace) {
    return MARKET_PACES.find((item) => item.id === pace)!.seconds;
  }

  protected selectPace(pace: MarketPace) {
    this.pace.set(pace);
    try {
      this.document.defaultView?.localStorage.setItem(PACE_KEY, pace);
    } catch {
      /* The choice lasts for this visit. */
    }
  }

  protected play() {
    this.stopTimers();
    this.round.set(this.fresh());
    this.started.set(true);
    this.saveFailed.set(false);
    this.newBest.set(false);
    this.newTreats.set(0);
    this.sounds.play('start');
    this.startSun();
    this.beginTurn();
  }

  private fresh(): Round {
    return {
      turns: this.stage().round(this.random),
      index: 0,
      step: 0,
      phase: 'shop',
      tray: [],
      typed: '',
      slips: 0,
      outcome: 'none',
      streak: 0,
      bestStreak: 0,
      golden: false,
      firstTries: 0,
      log: [],
      score: 0,
      gain: 0,
      badges: [],
      cheer: 'cheer1',
      bought: [],
      coins: 0,
      pays: 0,
      slipCount: 0,
      cheers: 0,
    };
  }

  private beginTurn() {
    const turn = this.turn();
    if (turn.refill && this.round().index > 0)
      this.status.set({ key: 'refill', values: { amount: this.purseText() } });
    else this.status.set(null);
    this.armIdle();
  }

  // Paying: coins go from the purse onto the tray and back.
  protected addCoin(index: number) {
    if (!this.shopping() || !this.counting()) return;
    this.round.update((round) => ({
      ...round,
      tray: [...round.tray, index],
      coins: round.coins + 1,
    }));
    this.sounds.play('coin');
    this.announceTray();
    this.armIdle();
  }

  protected takeBack(position: number) {
    if (!this.shopping() || !this.counting()) return;
    this.round.update((round) => ({
      ...round,
      tray: round.tray.filter((_, at) => at !== position),
    }));
    this.sounds.play('back');
    this.announceTray();
    this.armIdle();
  }

  /** Screen readers hear the coins on the tray, never their sum: counting is the skill. */
  private announceTray() {
    const coins = this.trayCoins();
    this.status.set(
      coins.length
        ? { key: 'trayHas', values: { coins: coins.map((coin) => this.money(coin)).join(', ') } }
        : null,
    );
  }

  protected pay() {
    if (!this.shopping() || !this.counting() || !this.round().tray.length) return;
    const turn = this.turn();
    if (this.step() === 'give') {
      const result = checkPay(this.trayCoins(), changeDue(turn));
      if (result === 'ok') this.solve('bought', isFewestChange(turn, this.trayCoins()));
      else this.slip(result === 'short' ? 'giveShort' : 'giveOver');
      return;
    }
    const result = checkPay(this.trayCoins(), turn.price);
    if (result === 'ok') this.solve('bought', isFewest(turn, this.trayCoins()));
    else this.slip(result);
  }

  protected judge(enough: boolean) {
    if (!this.shopping() || this.step() !== 'enough') return;
    const turn = this.turn();
    if (enough !== affordable(turn)) return this.slip('enoughWrong');
    if (!enough) return this.solve('putBack', false);
    if (turn.steps.length > this.round().step + 1) {
      this.round.update((round) => ({ ...round, step: round.step + 1, typed: '' }));
      this.sounds.play('coin');
      this.status.set({ key: 'askLeft', lead: 'enoughYes' });
      this.armIdle();
      return;
    }
    this.solve('bought', false);
  }

  protected typeDigit(digit: number) {
    if (!this.shopping() || !this.typing()) return;
    this.round.update((round) =>
      round.typed.length >= 2
        ? round
        : { ...round, typed: (round.typed + digit).replace(/^0+(?=\d)/, '') },
    );
    this.armIdle();
  }

  protected eraseDigit() {
    this.round.update((round) => ({ ...round, typed: round.typed.slice(0, -1) }));
  }

  protected submitTyped() {
    if (!this.shopping() || !this.typing() || !this.round().typed) return;
    if (this.step() === 'total') return this.submitTotal(Number(this.round().typed));
    if (this.step() === 'change') return this.submitChange(Number(this.round().typed));
    const result = checkLeft(this.turn(), Number(this.round().typed));
    if (result === 'ok') this.solve('bought', false);
    else {
      this.round.update((round) => ({ ...round, typed: '' }));
      this.slip(result);
    }
  }

  private submitChange(typed: number) {
    const result = checkChange(this.turn(), typed);
    if (result === 'ok') return this.solve('bought', false);
    this.round.update((round) => ({ ...round, typed: '' }));
    const keys = {
      added: 'changeAdded',
      price: 'changePrice',
      paid: 'changePaid',
      off: 'changeOff',
    } as const;
    this.slip(keys[result]);
  }

  /** A right total moves the list on to paying or to "what's left?". */
  private submitTotal(typed: number) {
    const result = checkTotal(this.turn(), typed);
    this.round.update((round) => ({ ...round, typed: '' }));
    if (result !== 'ok') return this.slip(result === 'off' ? 'totalOff' : result);
    this.round.update((round) => ({ ...round, step: round.step + 1 }));
    this.sounds.play('coin');
    this.status.set({ key: 'together', values: { amount: this.priceText() } });
    this.armIdle();
  }

  private slip(key: MarketMessageKey) {
    this.round.update((round) => ({
      ...round,
      slips: round.slips + 1,
      slipCount: round.slipCount + 1,
      streak: 0,
      golden: false,
    }));
    this.status.set({ key });
    this.sounds.play('nope');
    this.armIdle();
  }

  private solve(outcome: 'bought' | 'putBack', fewest: boolean) {
    this.stopIdle();
    const round = this.round();
    const turn = this.turn();
    const firstTry = round.slips === 0;
    const streak = firstTry ? round.streak + 1 : 0;
    const big = this.big();
    const sunset = this.timed() && this.sunset() < 1;
    const fewestBonus = !!this.stage().fewest && fewest;
    const gain = turnPoints({ firstTry, fewest: fewestBonus, golden: round.golden, big, sunset });
    const golden = round.golden || streak >= GOLDEN_STREAK;
    const badges: MarketMessageKey[] = [];
    if (firstTry) badges.push('badgeFirst');
    if (fewestBonus) badges.push('badgeFewest');
    if (sunset) badges.push('badgeSunset');
    if (round.golden) badges.push('badgeGolden');
    if (big) badges.push('badgeBig');
    const turns = firstTry
      ? round.turns
      : replayMissed(this.stage(), round.turns, round.index, this.random);
    const cheer = outcome === 'putBack' ? 'cheerNo' : CHEERS[round.index % CHEERS.length];
    this.round.set({
      ...round,
      turns,
      phase: 'solved',
      outcome,
      streak,
      bestStreak: Math.max(round.bestStreak, streak),
      golden,
      firstTries: round.firstTries + (firstTry ? 1 : 0),
      log: [...round.log, firstTry],
      score: round.score + gain,
      gain,
      badges,
      cheer,
      // A shopping list goes into the basket, and onto the receipt, treat by treat.
      bought:
        outcome === 'bought'
          ? [...round.bought, ...(turn.items ?? [{ good: turn.good, price: turn.price }])]
          : round.bought,
      pays: round.pays + 1,
    });
    this.status.set(
      outcome === 'putBack'
        ? { key: 'putBack', values: { good: this.goodName() }, lead: 'cheerNo' }
        : turn.steps.includes('change') || turn.steps.includes('give')
          ? { key: 'changeRight', values: { amount: this.money(changeDue(turn)) } }
          : turn.steps.includes('left')
            ? { key: 'stillLeft', values: { amount: this.money(purseTotal(turn) - turn.price) } }
            : { key: 'bought', values: { good: this.goodLabel(turn.good) } },
    );
    if (!round.golden && golden) this.status.set({ key: 'goldenStart' });
    this.hatchery.warm();
    if (guide.add() >= GUIDED_TURNS) this.guided.set(false);
    this.sounds.play(outcome === 'putBack' ? 'putBack' : 'till');
    this.sounds.play('chime', streak * 2);
    this.timer = setTimeout(() => this.advance(), SOLVE_DELAY);
  }

  protected advance() {
    clearTimeout(this.timer);
    const round = this.round();
    if (round.phase !== 'solved') return;
    if (round.index + 1 < this.turnsTotal()) {
      this.round.set({
        ...round,
        index: round.index + 1,
        step: 0,
        phase: 'shop',
        tray: [],
        typed: '',
        slips: 0,
        outcome: 'none',
        gain: 0,
        badges: [],
      });
      this.beginTurn();
      return;
    }
    this.finish(round);
  }

  private finish(round: Round) {
    this.stopTimers();
    this.round.set({ ...round, phase: 'complete', cheers: round.cheers + 1 });
    this.saveFailed.set(!this.record());
    const result = this.scores.record(
      this.levelId(),
      round.score,
      round.bought.map((item) => item.good),
    );
    this.newBest.set(result.best);
    this.newTreats.set(result.fresh);
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

  protected rewardWait() {
    return this.sceneStage()?.ready() ? REWARD_WAIT_3D : 0;
  }

  // The sun goes down over the whole round; once it sets, only the sunset bonus is gone.
  private startSun() {
    this.sunset.set(0);
    this.daylight = daylightSeconds(this.pace(), this.stage()) * 1000;
    if (!this.daylight) return;
    this.sunLeft = this.daylight;
    this.armSun();
  }

  private armSun() {
    clearInterval(this.tick);
    this.sunDue = Date.now() + this.sunLeft;
    this.tick = setInterval(() => {
      const left = Math.max(0, this.sunDue - Date.now());
      this.sunset.set(1 - left / this.daylight);
      if (left > 0) return;
      clearInterval(this.tick);
      this.tick = undefined;
      this.sounds.play('sunset');
      if (this.round().phase === 'shop') this.status.set({ key: 'sunsetNow' });
    }, 250);
  }

  protected visibilityChanged() {
    if (!this.daylight || !this.started() || this.round().phase === 'complete') return;
    if (this.document.visibilityState === 'hidden') {
      if (!this.tick) return;
      clearInterval(this.tick);
      this.tick = undefined;
      this.sunLeft = Math.max(0, this.sunDue - Date.now());
    } else if (!this.tick && this.sunLeft > 0 && this.sunset() < 1) this.armSun();
  }

  protected openHelp() {
    if (this.coaching()) return;
    this.stopIdle();
    if (this.tick) {
      clearInterval(this.tick);
      this.tick = undefined;
      this.sunLeft = Math.max(0, this.sunDue - Date.now());
    }
    this.coaching.set(true);
  }

  protected closeHelp() {
    this.coaching.set(false);
    if (this.daylight && this.sunLeft > 0 && this.sunset() < 1 && this.round().phase !== 'complete')
      this.armSun();
    if (this.round().phase === 'shop') this.armIdle();
  }

  private armIdle() {
    this.stopIdle();
    this.idle.set(false);
    this.idleTimer = setTimeout(() => this.idle.set(true), IDLE_MS);
  }

  private stopIdle() {
    clearTimeout(this.idleTimer);
    this.idle.set(false);
  }

  private stopTimers() {
    clearTimeout(this.timer);
    clearInterval(this.tick);
    this.tick = undefined;
    this.stopIdle();
  }

  /** Digits, Backspace and Enter work on the number pad; Enter also moves on after a buy. */
  protected onKey(event: KeyboardEvent) {
    if (!this.started() || event.defaultPrevented) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, select, dialog')) return;
    if (this.round().phase === 'solved' && event.key === 'Enter') {
      event.preventDefault();
      this.advance();
      return;
    }
    if (!this.shopping() || !this.typing() || this.coaching()) return;
    if (/^\d$/.test(event.key)) {
      event.preventDefault();
      this.typeDigit(Number(event.key));
    } else if (event.key === 'Backspace') {
      event.preventDefault();
      this.eraseDigit();
    } else if (event.key === 'Enter' && !target?.closest('button')) {
      event.preventDefault();
      this.submitTyped();
    }
  }

  private readPace(): MarketPace {
    try {
      return parseMarketPace(this.document.defaultView?.localStorage.getItem(PACE_KEY));
    } catch {
      return 'off';
    }
  }
}
