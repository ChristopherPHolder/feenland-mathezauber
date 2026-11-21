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
import { LocaleService } from '../../core/locale';
import { MessageKey } from '../../core/messages';
import { ProgressService } from '../../core/progress';
import { GameHeader } from '../../shared/game-header';
import { ThreeStage, WorldLoader } from '../../shared/three/three-stage';
import { HatcheryStore } from '../hatchery/hatchery-store';
import { ClockDemo } from './clock-demo';
import { ClockDial } from './clock-dial';
import { ClockFrame, CRITTERS } from './clock-frame';
import { clockGuide, GUIDED_TIMES } from './clock-guide';
import {
  candleSeconds,
  checkSet,
  checkTyped,
  CLOCK_PACES,
  ClockItem,
  ClockPace,
  clockPosition,
  clockStage,
  clockStages,
  createRound,
  EventId,
  EVENT_IDS,
  formatOf,
  GOLDEN_STREAK,
  isMastered,
  parseClockPace,
  Random,
  roundStars,
  SetResult,
  shownTime,
  startDial,
  timeChoices,
  TOTAL_STAGES,
  turnPoints,
  untilMinutes,
  withRepeat,
} from './clock-levels';
import { clockText, ClockMessageKey } from './clock-messages';
import { ClockScene } from './clock-scene';
import { ClockScores, TOTAL_FRIENDS } from './clock-scores';
import { ClockSounds } from './clock-sounds';
import {
  capitalized,
  digital,
  hopStops,
  isAfternoon,
  minuteOf,
  minutesBetween,
  nextFullHour,
  sameOnDial,
  wording,
  wrapDial,
} from './clock-time';
import { ClockTimeline } from './clock-timeline';

type Phase = 'play' | 'solved' | 'complete';

/** One line of Pip's day planner: an event, its time, and whether it rang on the first try. */
interface PlannerEntry {
  readonly event: EventId;
  readonly text: string;
  readonly first: boolean;
}

interface Round {
  readonly items: readonly ClockItem[];
  /** Turns that count for stars: the round's own, without the times that came back. */
  readonly base: number;
  readonly index: number;
  readonly phase: Phase;
  /** Where the hands stand (minutes on the 12-hour face). */
  readonly dial: number;
  readonly slips: number;
  /** This turn is a missed time coming back. */
  readonly repeat: boolean;
  readonly repeats: number;
  readonly choices: readonly number[];
  readonly hours: string;
  readonly minutes: string;
  readonly field: 'hours' | 'minutes';
  readonly typed: string;
  readonly help: 'none' | 'hour' | 'fives';
  readonly timeline: boolean;
  readonly candle: 'none' | 'lit' | 'out';
  readonly streak: number;
  readonly bestStreak: number;
  readonly golden: boolean;
  readonly firstTries: number;
  readonly rung: number;
  readonly planner: readonly PlannerEntry[];
  readonly score: number;
  readonly gain: number;
  readonly badges: readonly ClockMessageKey[];
  readonly newFriends: readonly EventId[];
  readonly arriving: EventId | null;
  readonly rings: number;
  readonly wobbles: number;
}

interface Status {
  readonly key: ClockMessageKey;
  readonly values?: Record<string, string | number>;
  readonly extras?: readonly { key: ClockMessageKey; values?: Record<string, string | number> }[];
}

const PACE_KEY = 'feenland.clock-pace.v1';
/** The bell swings and the creature flies up before the next time. */
const SOLVE_DELAY = 2600;
/** How long a child may wait before the next thing to tap hops again. */
const IDLE_MS = 6000;

@Component({
  selector: 'app-clock',
  imports: [
    RouterLink,
    Icon,
    NumberPad,
    RewardBurst,
    CoachDialog,
    GameHeader,
    ThreeStage,
    ClockScene,
    ClockDial,
    ClockDemo,
    ClockTimeline,
  ],
  providers: [ClockSounds],
  templateUrl: './clock.html',
  styleUrls: ['./clock.css', './clock-play.css'],
  host: {
    '(document:keydown)': 'onKey($event)',
    '(document:visibilitychange)': 'visibilityChanged()',
  },
})
export class Clock {
  protected readonly i = inject(LocaleService);
  private readonly p = inject(ProgressService);
  private readonly hatchery = inject(HatcheryStore);
  private readonly completion = inject(CompletionService);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  protected readonly sounds = inject(ClockSounds);
  protected readonly scores = inject(ClockScores);
  private readonly params = toSignal(inject(ActivatedRoute).paramMap);
  /** Swapped out by tests for a seeded source. */
  random: Random = Math.random;

  protected readonly total = TOTAL_STAGES;
  protected readonly stage = computed(
    () => clockStage(this.params()?.get('id')) ?? clockStage('clock-1')!,
  );
  protected readonly levelId = computed(() => `clock-${this.stage().stage}`);
  protected readonly position = computed(() => clockPosition(this.stage()));
  protected readonly levelLinks = clockStages.map((stage, index) => ({
    stage: stage.stage,
    position: index + 1,
    route: ['/adventure', `clock-${stage.stage}`],
  }));
  protected readonly nextLink = computed(() => {
    const next = clockStages[this.position()];
    return next ? ['/adventure', `clock-${next.stage}`] : null;
  });

  protected readonly round = linkedSignal<Round>(() => this.fresh());
  protected readonly started = linkedSignal<boolean>(() => {
    this.stage();
    return false;
  });
  protected readonly paces = CLOCK_PACES;
  protected readonly pace = signal<ClockPace>(this.readPace());
  protected readonly timed = computed(() => this.pace() !== 'off');
  /** How far the candle has burnt down in this turn, 0 to 1. */
  protected readonly burn = signal(0);
  protected readonly status = signal<Status | null>(null);
  protected readonly saveFailed = signal(false);
  protected readonly newBest = signal(false);
  protected readonly coaching = signal(false);
  protected readonly guided = signal(clockGuide.count() < GUIDED_TIMES);
  protected readonly idle = signal(false);
  protected readonly guide = computed(
    () => this.playing() && !this.coaching() && (this.guided() || this.idle()),
  );

  protected readonly item = computed(() => this.round().items[this.round().index]);
  protected readonly task = computed(() => this.item().task);
  protected readonly later = computed(
    () => this.item().task === 'set' && this.item().hours !== undefined,
  );
  protected readonly midnight = computed(() => this.item().event === 'midnight');
  protected readonly playing = computed(() => this.started() && this.round().phase === 'play');
  /** The film's usual time is 2:15; on that very turn it shows 7:45 instead. */
  protected readonly demoClash = computed(() => sameOnDial(this.item().time, 135));
  protected readonly stars = computed(() => roundStars(this.round().firstTries, this.round().base));
  protected readonly starSlots = [1, 2, 3];
  protected readonly best = computed(() => this.scores.best()[this.levelId()] ?? 0);
  protected readonly friendSlots = [...EVENT_IDS, 'midnight' as const];
  protected readonly totalFriends = TOTAL_FRIENDS;
  protected readonly turnSlots = computed(() =>
    this.round().items.map((item, index) => ({ index, midnight: item.event === 'midnight' })),
  );

  /** The hands on the face: the child's while setting, the time to read otherwise. */
  protected readonly faceDial = computed(() => {
    const item = this.item();
    if (!this.started() && item.task === 'set') return startDial(item);
    return item.task === 'set' ? this.round().dial : wrapDial(shownTime(item));
  });
  protected readonly frame = computed<ClockFrame>(() => {
    const round = this.round();
    const item = this.item();
    const dial = this.faceDial();
    const sky = item.task === 'set' ? dial + (isAfternoon(item.time) ? 720 : 0) : shownTime(item);
    return {
      turn: round.index,
      dial,
      sky,
      help: round.help,
      golden: round.golden,
      midnight: this.midnight(),
      event: item.event,
      friends: this.scores.friends(),
      arriving: round.arriving,
      lights: round.rung,
      rings: round.rings,
      wobbles: round.wobbles,
      complete: round.phase === 'complete',
    };
  });
  protected readonly outcomeFrame = computed<ClockFrame>(() => ({
    ...this.frame(),
    dial: 0,
    sky: 23 * 60 + 59,
    help: 'none',
    arriving: null,
    complete: true,
  }));
  protected readonly loadWorld: WorldLoader<ClockFrame> = () =>
    import('./clock-world').then((m) => m.ClockWorld);

  /** What the event card says about the time. */
  protected readonly cardTime = computed(() => {
    const item = this.item();
    if (item.task === 'until')
      return this.t('untilAsk', {
        start: this.write(item.start!, item),
        end: this.write(item.time, item),
      });
    if (this.later())
      return this.t(item.hours === 1 ? 'laterOne' : 'laterMany', {
        start: this.write(item.start!, item),
        n: item.hours!,
      });
    if (item.task === 'set') return this.write(item.time, item, true);
    return this.t('readAsk');
  });
  protected readonly stepText = computed(() => {
    const task = this.task();
    if (this.later()) return this.t('stepLater');
    return this.t(
      task === 'set'
        ? 'stepSet'
        : task === 'pick'
          ? 'stepPick'
          : task === 'type'
            ? 'stepType'
            : 'stepUntil',
    );
  });
  /** The hands' position, worded for screen readers and the slider value. */
  protected readonly handsText = computed(() => this.describeHands(this.faceDial()));
  /** The hop line after a wrong "how long?": stops as minutes from the start, and as times. */
  protected readonly timeline = computed(() => {
    const item = this.item();
    const start = item.start ?? item.time;
    const stops = hopStops(start, item.time);
    return {
      stops: stops.map((stop) => minutesBetween(start, stop)),
      labels: stops.map((stop) => this.write(stop, item)),
    };
  });

  protected readonly reward = computed(() => {
    const round = this.round();
    if (round.phase !== 'solved') return null;
    const kind: RewardBurstKind = this.midnight() ? 'big' : round.golden ? 'golden' : 'plain';
    const cheer: ClockMessageKey = this.midnight()
      ? 'rewardMidnight'
      : round.golden
        ? 'rewardGolden'
        : round.slips === 0
          ? 'rewardFirst'
          : 'rewardRing';
    return {
      kind,
      cheer: this.t(cheer),
      points: this.t('rewardPoints', { n: this.i.format(round.gain) }),
      badges: round.badges.map((key) => this.t(key)),
    };
  });

  private readonly outcome = viewChild<ElementRef<HTMLElement>>('outcome');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private timer?: ReturnType<typeof setTimeout>;
  private tick?: ReturnType<typeof setInterval>;
  private idleTimer?: ReturnType<typeof setTimeout>;
  private candleDue = 0;
  private candleTotal = 0;
  private candleLeft = 0;

  constructor() {
    effect(() => {
      if (this.started()) this.p.explore('tens');
    });
    inject(DestroyRef).onDestroy(() => this.stopTimers());
  }

  protected t(key: ClockMessageKey, values: Record<string, string | number> = {}) {
    return clockText(this.i.locale(), key, values);
  }
  protected levelKey(stage: number) {
    return `clock${stage}` as MessageKey;
  }
  protected eventName(event: EventId) {
    return this.t(`ev_${event}` as ClockMessageKey);
  }
  protected friendName(event: EventId) {
    return this.t(`fr_${event}` as ClockMessageKey);
  }
  protected critter(event: EventId) {
    return CRITTERS[event];
  }
  protected paceSeconds(pace: ClockPace) {
    return candleSeconds(pace, this.stage());
  }
  /** A time written the way this turn shows times: words, digital or 24-hour digital. */
  protected write(time: number, item: ClockItem, sentence = false) {
    if (item.show === 'words') {
      const said = wording(this.i.locale(), time);
      return sentence ? capitalized(said) : said;
    }
    return digital(time, formatOf(item));
  }
  protected choiceText(time: number) {
    return capitalized(this.write(time, this.item()));
  }
  protected typedDisplay() {
    const round = this.round();
    return { hours: round.hours || '–', minutes: round.minutes.padEnd(2, '–') };
  }
  protected newFriendNames() {
    return this.round()
      .newFriends.map((event) => this.friendName(event))
      .join(', ');
  }

  protected selectPace(pace: ClockPace) {
    this.pace.set(pace);
    try {
      this.document.defaultView?.localStorage.setItem(PACE_KEY, pace);
    } catch {
      /* The pace stays for this visit. */
    }
    if (!this.started()) return;
    if (pace === 'off') {
      this.stopCandle();
      this.burn.set(0);
      if (this.round().candle === 'lit') this.round.update((r) => ({ ...r, candle: 'none' }));
    }
  }

  protected play() {
    this.stopTimers();
    this.round.set(this.fresh());
    this.saveFailed.set(false);
    this.newBest.set(false);
    this.started.set(true);
    this.sounds.play('start');
    this.beginTurn();
  }

  private beginTurn() {
    this.announce();
    this.startCandle();
    if (this.round().golden && this.round().index > 0) this.sounds.play('golden');
    this.armIdle();
    this.focusControls();
  }

  /** At the start of a turn: what the hands show, as sentences for screen readers. */
  private announce() {
    const item = this.item();
    if (item.task === 'set') {
      this.status.set({ key: 'sceneSet', values: { now: digital(this.round().dial) } });
      return;
    }
    this.status.set({
      key: item.task === 'until' ? 'untilAsk' : 'readAsk',
      values:
        item.task === 'until'
          ? { start: this.write(item.start!, item), end: this.write(item.time, item) }
          : {},
      extras: this.handParts(wrapDial(shownTime(item))),
    });
  }

  private handParts(dial: number): { key: ClockMessageKey; values: Record<string, number> }[] {
    const minute = dial % 60;
    const hour = Math.floor(dial / 60) % 12 || 12;
    const next = (hour % 12) + 1;
    const n = Math.floor(minute / 5) || 12;
    const k = minute % 5;
    return [
      minute === 0
        ? { key: 'handsOn', values: { h: hour } }
        : { key: 'handsBetween', values: { h: hour, next } },
      k === 0 ? { key: 'longAt', values: { n } } : { key: 'longAfter', values: { n, k } },
    ];
  }

  private describeHands(dial: number) {
    return this.handParts(dial)
      .map((part) => this.t(part.key, part.values))
      .join(' ');
  }

  // ---- Setting the hands -------------------------------------------------------------------

  protected setDial(dial: number) {
    if (!this.playing() || this.task() !== 'set') return;
    const next = wrapDial(dial);
    if (next === this.round().dial) return;
    this.round.update((round) => ({ ...round, dial: next }));
    this.sounds.play(next % 10 ? 'tock' : 'tick');
    this.armIdle();
  }
  protected moveHour(hours: number) {
    this.setDial(this.round().dial + hours * 60);
  }
  protected moveMinute(minutes: number) {
    this.setDial(this.round().dial + minutes);
  }

  protected ring() {
    if (!this.playing() || this.task() !== 'set') return;
    const result = checkSet(this.item(), this.round().dial);
    if (result === 'right') this.solve();
    else this.miss(result);
  }

  // ---- Reading the clock -------------------------------------------------------------------

  protected pick(time: number) {
    if (!this.playing() || this.task() !== 'pick') return;
    const item = this.item();
    const right = item.show === 'digital24' ? time === item.time : sameOnDial(time, item.time);
    if (right) {
      this.solve();
      return;
    }
    const pickedHour =
      item.show === 'digital24' ? Math.floor(time / 60) : Math.floor(wrapDial(time) / 60);
    const wantHour =
      item.show === 'digital24' ? Math.floor(item.time / 60) : Math.floor(wrapDial(item.time) / 60);
    const sameMinutes = minuteOf(time) === minuteOf(item.time);
    this.miss(
      item.show === 'digital24' && sameMinutes && pickedHour % 12 === wantHour % 12
        ? 'day'
        : sameMinutes
          ? 'hour'
          : 'minute',
    );
  }

  protected typeDigit(digit: number) {
    if (!this.playing()) return;
    const task = this.task();
    if (task === 'until') {
      this.round.update((round) =>
        round.typed.length >= 3
          ? round
          : { ...round, typed: (round.typed + digit).replace(/^0+(?=\d)/, '') },
      );
      return;
    }
    if (task !== 'type') return;
    const twentyFour = formatOf(this.item()) === '24';
    this.round.update((round) => {
      if (round.field === 'hours') {
        const hours = round.hours + digit;
        if (hours.length > 2 || Number(hours) > (twentyFour ? 23 : 12)) return round;
        // Move on once the hour cannot grow: 3 is 3 o'clock on the 12-hour clock, 1 may be 12.
        const done = hours.length === 2 || Number(hours) * 10 > (twentyFour ? 23 : 12);
        return { ...round, hours, field: done ? 'minutes' : 'hours' };
      }
      if (round.minutes.length >= 2) return round;
      if (round.minutes.length === 0 && digit > 5) return round;
      return { ...round, minutes: round.minutes + digit };
    });
  }

  protected eraseDigit() {
    if (!this.playing()) return;
    this.round.update((round) => {
      if (this.task() === 'until') return { ...round, typed: round.typed.slice(0, -1) };
      if (round.minutes) return { ...round, minutes: round.minutes.slice(0, -1) };
      return { ...round, field: 'hours', hours: round.hours.slice(0, -1) };
    });
  }

  protected submitTyped() {
    if (!this.playing()) return;
    const round = this.round();
    const item = this.item();
    if (item.task === 'until') {
      if (!round.typed) return;
      if (Number(round.typed) === untilMinutes(item)) this.solve();
      else this.miss('until');
      return;
    }
    if (item.task !== 'type') return;
    if (round.field === 'hours') {
      if (round.hours) this.round.update((r) => ({ ...r, field: 'minutes' }));
      return;
    }
    if (round.minutes.length < 2) return;
    const result = checkTyped(item, Number(round.hours), Number(round.minutes));
    if (result === 'right') this.solve();
    else this.miss(result);
  }

  /** What the pad has so far, as the screen reader hears it: "3:0" or "35". */
  protected typedValue() {
    const round = this.round();
    if (this.task() === 'until') return round.typed;
    return round.field === 'minutes' ? `${round.hours}:${round.minutes}` : round.hours;
  }

  // ---- Right and wrong ---------------------------------------------------------------------

  private miss(result: Exclude<SetResult, 'right'> | 'day' | 'until') {
    const round = this.round();
    const item = this.item();
    const reading = item.task === 'pick' || item.task === 'type';
    const queued =
      round.slips === 0 && !round.repeat
        ? withRepeat(round.items, round.index, round.repeats)
        : null;
    const help: Round['help'] =
      result === 'hour' || result === 'both' ? 'hour' : result === 'minute' ? 'fives' : 'none';
    this.round.set({
      ...round,
      items: queued ?? round.items,
      repeats: round.repeats + (queued ? 1 : 0),
      slips: round.slips + 1,
      streak: 0,
      golden: false,
      help,
      timeline: result === 'until' || round.timeline,
      hours: '',
      minutes: '',
      field: 'hours',
      typed: '',
      wobbles: round.wobbles + 1,
    });
    const key = this.missKey(result, item, reading);
    const extras = queued ? [{ key: 'comeBack' as const }] : [];
    const start = item.start ?? item.time;
    this.status.set({
      key,
      values: { start: this.write(start, item), hour: this.write(nextFullHour(start), item) },
      extras,
    });
    this.sounds.play('slip');
    this.armIdle();
  }

  private missKey(
    result: Exclude<SetResult, 'right'> | 'day' | 'until',
    item: ClockItem,
    reading: boolean,
  ): ClockMessageKey {
    if (result === 'until') return 'wrongUntil';
    if (result === 'day') return 'readDay';
    if (this.later() && result !== 'minute') return 'wrongLater';
    if (reading) return result === 'minute' ? 'readMinute' : 'readHour';
    if (result === 'minute') return item.step === 1 ? 'wrongMinuteOne' : 'wrongMinute';
    if (result === 'both') return 'wrongBoth';
    // The classic slip at half past (and German "halb"): the hour after.
    const dialHour = Math.floor(this.round().dial / 60) % 12;
    const wantHour = Math.floor(wrapDial(item.time) / 60) % 12;
    return minuteOf(item.time) >= 30 && dialHour === (wantHour + 1) % 12
      ? 'wrongHalf'
      : 'wrongHour';
  }

  private solve() {
    this.stopCandle();
    this.stopIdle();
    this.guided.set(clockGuide.add() < GUIDED_TIMES);
    const round = this.round();
    const item = this.item();
    const firstTry = round.slips === 0;
    const candle = round.candle === 'lit';
    const gain = turnPoints({
      firstTry,
      candle,
      golden: round.golden,
      midnight: this.midnight(),
      repeat: round.repeat,
    });
    const streak = firstTry && !round.repeat ? round.streak + 1 : round.repeat ? round.streak : 0;
    const fresh = this.scores.befriend(item.event);
    const badges = (
      [
        [firstTry && !round.repeat, 'badgeFirst'],
        [candle && !round.repeat, 'badgeCandle'],
        [fresh, 'badgeFriend'],
      ] as const
    )
      .filter(([earned]) => earned)
      .map(([, key]) => key);
    const planner = round.repeat
      ? round.planner
      : [...round.planner, { event: item.event, text: this.plannerText(item), first: firstTry }];
    this.round.set({
      ...round,
      phase: 'solved',
      dial: item.task === 'set' ? round.dial : wrapDial(item.time),
      help: 'none',
      streak,
      bestStreak: Math.max(round.bestStreak, streak),
      firstTries: round.firstTries + (firstTry && !round.repeat ? 1 : 0),
      rung: round.rung + 1,
      planner,
      score: round.score + gain,
      gain,
      badges,
      newFriends: fresh ? [...round.newFriends, item.event] : round.newFriends,
      arriving: item.event,
      rings: round.rings + 1,
    });
    this.hatchery.warm();
    const extras: Status['extras'] = [
      ...(firstTry && !round.repeat ? [{ key: 'firstTryBonus' as const }] : []),
      ...(candle && !round.repeat ? [{ key: 'candleBonus' as const }] : []),
      ...(streak === GOLDEN_STREAK ? [{ key: 'goldenStart' as const }] : []),
      ...(fresh
        ? [
            {
              key: 'newFriend' as const,
              values: { name: capitalized(this.friendName(item.event)) },
            },
          ]
        : []),
    ];
    this.status.set({
      key: 'right',
      values: {
        event: this.eventName(item.event),
        time:
          item.task === 'until'
            ? `${untilMinutes(item)} ${this.t('minutesUnit')}`
            : this.write(item.time, item),
      },
      extras,
    });
    this.sounds.play('bell');
    this.sounds.play('chime', streak * 2);
    if (fresh) this.sounds.play('flutter');
    this.timer = setTimeout(() => this.advance(), SOLVE_DELAY);
  }

  private plannerText(item: ClockItem) {
    const format = formatOf(item);
    if (item.task === 'until')
      return `${digital(item.start!, format)} → ${digital(item.time, format)} · ${minutesBetween(item.start!, item.time)} ${this.t('minutesUnit')}`;
    return digital(item.time, format === '24' ? '24' : '12');
  }

  /** Moves on to the next time now instead of waiting. */
  protected advance() {
    clearTimeout(this.timer);
    const round = this.round();
    if (round.phase !== 'solved') return;
    if (round.index + 1 < round.items.length) {
      this.round.set(this.turnState(round, round.index + 1));
      this.beginTurn();
      return;
    }
    this.finish(round);
  }

  private finish(round: Round) {
    this.round.set({ ...round, phase: 'complete', arriving: null });
    this.saveFailed.set(!this.record());
    this.newBest.set(this.scores.record(this.levelId(), round.score));
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

  // ---- The candle --------------------------------------------------------------------------

  private startCandle() {
    this.stopCandle();
    this.burn.set(0);
    const seconds = candleSeconds(this.pace(), this.stage());
    if (!seconds) {
      this.round.update((round) => ({ ...round, candle: 'none' }));
      return;
    }
    this.round.update((round) => ({ ...round, candle: 'lit' }));
    this.candleTotal = seconds * 1000;
    this.candleLeft = this.candleTotal;
    this.armCandle();
  }

  private armCandle() {
    clearInterval(this.tick);
    this.candleDue = Date.now() + this.candleLeft;
    const step = () => {
      const left = Math.max(0, this.candleDue - Date.now());
      this.burn.set(1 - left / this.candleTotal);
      if (left > 0) return;
      this.stopCandle();
      this.round.update((round) => ({ ...round, candle: 'out' }));
      this.status.set({ key: 'candleGone' });
      this.sounds.play('puff');
    };
    step();
    this.tick = setInterval(step, 250);
  }

  private stopCandle() {
    clearInterval(this.tick);
    this.tick = undefined;
  }

  private stopTimers() {
    this.stopIdle();
    clearTimeout(this.timer);
    this.stopCandle();
  }

  protected visibilityChanged() {
    const round = this.round();
    if (round.candle !== 'lit' || round.phase !== 'play') return;
    if (this.document.hidden && this.tick) {
      this.candleLeft = Math.max(0, this.candleDue - Date.now());
      this.stopCandle();
    } else if (!this.document.hidden && !this.tick && this.started() && !this.coaching()) {
      this.armCandle();
    }
  }

  /** Digits type on the pad; Enter rings the bell or confirms the typed time. */
  protected onKey(event: KeyboardEvent) {
    if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
    if (!this.playing() || this.coaching()) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('textarea, select, input')) return;
    const task = this.task();
    if ((task === 'type' || task === 'until') && /^\d$/.test(event.key)) {
      event.preventDefault();
      this.typeDigit(Number(event.key));
    } else if ((task === 'type' || task === 'until') && event.key === 'Backspace') {
      event.preventDefault();
      this.eraseDigit();
    } else if (event.key === 'Enter' && !target?.closest('button')) {
      event.preventDefault();
      if (task === 'set') this.ring();
      else if (task !== 'pick') this.submitTyped();
    }
  }

  protected openHelp() {
    if (this.coaching()) return;
    this.stopIdle();
    if (this.tick) {
      this.candleLeft = Math.max(0, this.candleDue - Date.now());
      this.stopCandle();
    }
    this.coaching.set(true);
  }

  protected closeHelp() {
    this.coaching.set(false);
    const round = this.round();
    if (round.phase !== 'play') return;
    if (round.candle === 'lit') this.armCandle();
    this.armIdle();
    this.focusControls();
  }

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
    return [
      this.t(status.key, status.values),
      ...(status.extras ?? []).map((extra) => this.t(extra.key, extra.values)),
    ].join(' ');
  }

  private focusControls() {
    requestAnimationFrame(() =>
      this.host.nativeElement
        .querySelector<HTMLElement>('.hand-button, .choice, ui-number-pad .key')
        ?.focus({ preventScroll: true }),
    );
  }

  private readPace(): ClockPace {
    try {
      return parseClockPace(this.document.defaultView?.localStorage.getItem(PACE_KEY));
    } catch {
      return 'off';
    }
  }

  private turnState(round: Round, index: number): Round {
    const item = round.items[index];
    return {
      ...round,
      index,
      phase: 'play',
      dial: startDial(item),
      slips: 0,
      repeat: index >= round.base - 1 && index < round.items.length - 1,
      choices: item.task === 'pick' ? timeChoices(item, this.random) : [],
      hours: '',
      minutes: '',
      field: 'hours',
      typed: '',
      help: 'none',
      timeline: false,
      candle: 'none',
      golden: round.streak >= GOLDEN_STREAK,
      gain: 0,
      badges: [],
      arriving: null,
    };
  }

  private fresh(): Round {
    const items = createRound(this.stage(), this.random);
    const base: Round = {
      items,
      base: items.length,
      index: 0,
      phase: 'play',
      dial: 0,
      slips: 0,
      repeat: false,
      repeats: 0,
      choices: [],
      hours: '',
      minutes: '',
      field: 'hours',
      typed: '',
      help: 'none',
      timeline: false,
      candle: 'none',
      streak: 0,
      bestStreak: 0,
      golden: false,
      firstTries: 0,
      rung: 0,
      planner: [],
      score: 0,
      gain: 0,
      badges: [],
      newFriends: [],
      arriving: null,
      rings: 0,
      wobbles: 0,
    };
    return this.turnState(base, 0);
  }
}
