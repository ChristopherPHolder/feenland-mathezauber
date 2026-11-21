import type { Level } from '../../core/catalog';
import type { MessageKey } from '../../core/messages';
import {
  addMinutes,
  at,
  digital,
  dialHour,
  ClockFormat,
  HALF_DAY,
  hourOf,
  minuteOf,
  minutesBetween,
  sameOnDial,
  wrapDial,
} from './clock-time';

/**
 * The Clock Tower: Pip the owl keeps Feenland's big clock, and the whole village runs on it.
 * Each turn is an event ("The bakery opens") with a time. The child sets the hands, reads them,
 * or works out how long until something happens.
 *
 * Everything here is pure: events, levels, the round generator, answer choices, the checks,
 * scoring and stars. The page and the scenes only draw what it says.
 */

export type Random = () => number;

/**
 * What the child does on a turn:
 * - `set`: move the hands to the time on the card, then ring;
 * - `pick`: read the clock and pick the time from three;
 * - `type`: read the clock and type the digital time;
 * - `until`: say how many minutes from one time to another.
 * A `set` turn with `start` and `hours` is "whole hours later": the hands start at `start`.
 */
export type ClockTask = 'set' | 'pick' | 'type' | 'until';
/** How the card (or the choices) show a time: words, digital, or 24-hour digital. */
export type ClockShow = 'words' | 'digital' | 'digital24';
/** The minute marks a level uses. */
export type MinuteRule = 'hour' | 'half' | 'quarter' | 'quarters' | 'five' | 'one';

/** Who wants the time: each event wakes a creature who moves onto the balcony. */
export interface ClockEvent {
  readonly id: EventId;
  /** The hours this event can happen at (24-hour, inclusive), so the sky makes sense. */
  readonly from: number;
  readonly to: number;
}

export const EVENT_IDS = [
  'rooster',
  'bakery',
  'school',
  'market',
  'post',
  'lunch',
  'nap',
  'swim',
  'tea',
  'bath',
  'fireworks',
  'stars',
] as const;
export type EventId = (typeof EVENT_IDS)[number] | 'midnight';

export const EVENTS: readonly ClockEvent[] = [
  { id: 'rooster', from: 5, to: 7 },
  { id: 'bakery', from: 6, to: 8 },
  { id: 'school', from: 7, to: 9 },
  { id: 'market', from: 8, to: 10 },
  { id: 'post', from: 9, to: 11 },
  { id: 'lunch', from: 11, to: 13 },
  { id: 'nap', from: 13, to: 15 },
  { id: 'swim', from: 14, to: 16 },
  { id: 'tea', from: 15, to: 17 },
  { id: 'bath', from: 17, to: 19 },
  { id: 'fireworks', from: 19, to: 21 },
  { id: 'stars', from: 20, to: 22 },
];
/** The midnight bell ends every round: Pip's night watch, worth double. */
export const MIDNIGHT: ClockEvent = { id: 'midnight', from: 21, to: 23 };

export interface ClockItem {
  readonly event: EventId;
  readonly task: ClockTask;
  readonly show: ClockShow;
  /** The time asked for (24-hour minutes). For `until`, the end time. */
  readonly time: number;
  /** "Whole hours later" and "how long": where the clock starts. */
  readonly start?: number;
  /** "Whole hours later": how many hours on. */
  readonly hours?: number;
  /** Steps for the minute buttons: 5, or 1 on the to-the-minute level. */
  readonly step: 1 | 5;
}

/** One kind of turn a level asks: what to do and how the time is shown. */
interface Mode {
  readonly task: ClockTask;
  readonly show: ClockShow;
  /** Whole hours later (with `task: 'set'`). */
  readonly later?: boolean;
  readonly minutes?: MinuteRule;
}

export interface ClockStage {
  readonly stage: number;
  readonly group: MessageKey;
  /** The rule card on the intro, also the level's skill id. */
  readonly trick: ClockTrick;
  /** The worked example on the level card. */
  readonly example: string;
  readonly minutes: MinuteRule;
  readonly modes: readonly Mode[];
  /** Turns in a round, the midnight bell included. */
  readonly turns: number;
  /** Three stars are needed to master the level. */
  readonly strict?: boolean;
}

export type ClockTrick =
  | 'hour'
  | 'half'
  | 'quarter'
  | 'quarters'
  | 'five'
  | 'toDigital'
  | 'minute'
  | 'afternoon'
  | 'ampm'
  | 'later'
  | 'until'
  | 'master';

const set = (show: ClockShow, minutes?: MinuteRule): Mode => ({ task: 'set', show, minutes });
const pick = (show: ClockShow, minutes?: MinuteRule): Mode => ({ task: 'pick', show, minutes });

export const clockStages: readonly ClockStage[] = [
  {
    stage: 1,
    group: 'clockFull',
    trick: 'hour',
    example: '3:00',
    minutes: 'hour',
    modes: [set('words'), pick('words'), set('digital')],
    turns: 9,
  },
  {
    stage: 2,
    group: 'clockFull',
    trick: 'half',
    example: '3:30',
    minutes: 'half',
    modes: [set('words'), pick('words'), set('digital'), pick('digital')],
    turns: 9,
  },
  {
    stage: 3,
    group: 'clockQuarters',
    trick: 'quarter',
    example: '3:15 · 3:45',
    minutes: 'quarter',
    modes: [set('words'), pick('words')],
    turns: 9,
  },
  {
    stage: 4,
    group: 'clockQuarters',
    trick: 'quarters',
    example: '7:45',
    minutes: 'quarters',
    modes: [set('digital'), pick('words'), set('words'), pick('digital')],
    turns: 9,
  },
  {
    stage: 5,
    group: 'clockMinutes',
    trick: 'five',
    example: '4:25',
    minutes: 'five',
    modes: [set('words'), pick('digital'), set('digital'), pick('words')],
    turns: 9,
  },
  {
    stage: 6,
    group: 'clockMinutes',
    trick: 'toDigital',
    example: '8:40',
    minutes: 'five',
    modes: [{ task: 'type', show: 'digital' }, { task: 'type', show: 'digital' }, pick('digital')],
    turns: 9,
  },
  {
    stage: 7,
    group: 'clockMinutes',
    trick: 'minute',
    example: '2:17',
    minutes: 'one',
    modes: [set('digital'), { task: 'type', show: 'digital' }],
    turns: 9,
  },
  {
    stage: 8,
    group: 'clockDay',
    trick: 'afternoon',
    example: '15:00',
    minutes: 'quarters',
    modes: [set('digital24'), pick('digital24')],
    turns: 9,
  },
  {
    stage: 9,
    group: 'clockDay',
    trick: 'ampm',
    example: '7:00 · 19:00',
    minutes: 'quarters',
    modes: [pick('digital24')],
    turns: 9,
  },
  {
    stage: 10,
    group: 'clockHowLong',
    trick: 'later',
    example: '3:30 + 2 h',
    minutes: 'quarters',
    modes: [
      { task: 'set', show: 'digital', later: true },
      { task: 'set', show: 'words', later: true },
    ],
    turns: 9,
  },
  {
    stage: 11,
    group: 'clockHowLong',
    trick: 'until',
    example: '3:40 → 4:15',
    minutes: 'five',
    modes: [{ task: 'until', show: 'digital' }],
    turns: 9,
  },
  {
    stage: 12,
    group: 'clockHowLong',
    trick: 'master',
    example: '⏰',
    minutes: 'five',
    modes: [
      set('words', 'five'),
      pick('digital', 'quarters'),
      { task: 'type', show: 'digital', minutes: 'five' },
      set('digital24', 'quarters'),
      { task: 'until', show: 'digital', minutes: 'five' },
      { task: 'set', show: 'digital', later: true, minutes: 'quarters' },
    ],
    turns: 9,
    strict: true,
  },
];

export const TOTAL_STAGES = clockStages.length;

export const clockLevels: readonly Level[] = clockStages.map((stage) => ({
  id: `clock-${stage.stage}`,
  title: `clock${stage.stage}` as MessageKey,
  description: `clock${stage.stage}Help` as MessageKey,
  skills: ['telling-time', stage.trick],
  format: 'clock',
  group: stage.group,
}));

export function clockStage(id: string | null | undefined): ClockStage | undefined {
  const match = /^clock-([1-9]\d*)$/.exec(id ?? '');
  return match ? clockStages.find((stage) => stage.stage === Number(match[1])) : undefined;
}

/** Where a level sits in the list, counting from 1: the number a child sees. */
export function clockPosition(stage: ClockStage): number {
  return clockStages.indexOf(stage) + 1;
}

const int = (random: Random, min: number, max: number) =>
  min + Math.floor(random() * (max - min + 1));
function shuffle<T>(random: Random, items: readonly T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index--) {
    const other = int(random, 0, index);
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

/** A seeded random source for tests and replays (mulberry32). */
export function seeded(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The minute marks each rule may use. Half past and the quarters lean on the new mark. */
export function minuteChoices(rule: MinuteRule): readonly number[] {
  switch (rule) {
    case 'hour':
      return [0];
    case 'half':
      return [0, 30, 30];
    case 'quarter':
      return [15, 45, 15, 45, 30];
    case 'quarters':
      return [0, 15, 30, 45];
    case 'five':
      return [5, 10, 20, 25, 35, 40, 50, 55, 15, 45];
    case 'one':
      return Array.from({ length: 60 }, (_, minute) => minute).filter((minute) => minute % 5);
  }
}

function eventTime(event: ClockEvent, rule: MinuteRule, random: Random): number {
  const minutes = minuteChoices(rule);
  return at(int(random, event.from, event.to), minutes[int(random, 0, minutes.length - 1)]);
}

/** Durations for "how long": they cross the hour, in fives, from 15 minutes to about two hours. */
function untilItem(event: ClockEvent, random: Random): Pick<ClockItem, 'start' | 'time'> {
  const end = at(int(random, event.from, event.to), 5 * int(random, 1, 5));
  // The start lies before the hour, so the hops go to the full hour first.
  const before = 5 * int(random, 2, 6);
  const extra = random() < 0.35 ? 60 : 0;
  const start = addMinutes(end, -(minuteOf(end) + before + extra));
  return { start, time: end };
}

function laterItem(
  event: ClockEvent,
  rule: MinuteRule,
  random: Random,
): Pick<ClockItem, 'start' | 'time' | 'hours'> {
  const hours = int(random, 1, 4);
  const end = eventTime(event, rule, random);
  return { start: addMinutes(end, -60 * hours), time: end, hours };
}

function makeItem(event: ClockEvent, mode: Mode, stage: ClockStage, random: Random): ClockItem {
  const rule = mode.minutes ?? stage.minutes;
  const step = rule === 'one' ? 1 : 5;
  if (mode.task === 'until')
    return { event: event.id, task: 'until', show: mode.show, step, ...untilItem(event, random) };
  if (mode.later)
    return {
      event: event.id,
      task: 'set',
      show: mode.show,
      step,
      ...laterItem(event, rule, random),
    };
  return {
    event: event.id,
    task: mode.task,
    show: mode.show,
    step,
    time: eventTime(event, rule, random),
  };
}

/** Two turns that would look the same on the clock. */
const clash = (a: ClockItem, b: ClockItem) => sameOnDial(a.time, b.time) && a.task === b.task;

/**
 * A round: eight events in a shuffled order, each once, and the midnight bell last. The level's
 * kinds of turn take turns, so a mixed level mixes. No two turns ask the same clock picture.
 */
export function createRound(stage: ClockStage, random: Random = Math.random): ClockItem[] {
  const events = shuffle(random, EVENTS).slice(0, stage.turns - 1);
  // Keep the day in order: the village wakes up, then goes to bed.
  events.sort((a, b) => a.from - b.from);
  const modes = shuffle(random, stage.modes);
  const items: ClockItem[] = [];
  for (const [index, event] of [...events, MIDNIGHT].entries()) {
    let item = makeItem(event, modes[index % modes.length], stage, random);
    // A busy hour is taken: try other times, then the level's other kinds of turn.
    for (let tries = 1; tries < 40 && items.some((used) => clash(used, item)); tries++)
      item = makeItem(event, modes[(index + Math.floor(tries / 8)) % modes.length], stage, random);
    items.push(item);
  }
  return items;
}

/** The format a time is written in for this turn. */
export function formatOf(item: Pick<ClockItem, 'show'>): ClockFormat {
  return item.show === 'digital24' ? '24' : '12';
}

/**
 * Three times to pick from: the right one and two mix-ups children really make. The hour one
 * off (half past three read as half past four, or the German "halb" read as the hour named),
 * the hands swapped, the quarter the wrong way round, or (on the 24-hour clock) the other half
 * of the day.
 */
export function timeChoices(item: ClockItem, random: Random = Math.random): number[] {
  const time = item.time;
  const m = minuteOf(time);
  const h = hourOf(time);
  const candidates: number[] = [];
  if (item.show === 'digital24') {
    candidates.push(addMinutes(time, item.task === 'pick' ? HALF_DAY : 120));
    candidates.push(addMinutes(time, -120), addMinutes(time, 60), addMinutes(time, -60));
  } else {
    if (m === 30 || m === 45 || m >= 35) candidates.push(addMinutes(time, 60));
    if (m === 30 || m <= 25) candidates.push(addMinutes(time, -60));
    if (m !== 0 && m !== 30) candidates.push(at(h, 60 - m));
    // The hands swapped: the short hand read as minutes and the long one as the hour.
    const swappedHour = Math.round(m / 5) % 12;
    const swapped = at(swappedHour || 12, (dialHour(time) % 12) * 5);
    candidates.push(swapped);
    if (m === 0) candidates.push(at(h, 30), addMinutes(time, 60), addMinutes(time, -60));
    candidates.push(addMinutes(time, item.step === 1 ? 10 : 15), addMinutes(time, 60));
  }
  const unique: number[] = [];
  for (const candidate of candidates) {
    const label = choiceLabel(candidate, item);
    if (
      label !== choiceLabel(time, item) &&
      !unique.some((other) => choiceLabel(other, item) === label)
    )
      unique.push(candidate);
  }
  return shuffle(random, [time, ...unique.slice(0, 2)]);
}

/** How a choice is compared: the 12-hour picture, or the full 24-hour time. */
function choiceLabel(time: number, item: ClockItem): string {
  return item.show === 'digital24' ? digital(time, '24') : digital(wrapDial(time));
}

export type SetResult = 'right' | 'hour' | 'minute' | 'both';

/** Checks hands set to `dial` against the turn's time on the 12-hour face. */
export function checkSet(item: ClockItem, dial: number): SetResult {
  const wantHour = Math.floor(wrapDial(item.time) / 60);
  const wantMinute = minuteOf(item.time);
  const hour = Math.floor(wrapDial(dial) / 60) === wantHour;
  const minute = wrapDial(dial) % 60 === wantMinute;
  if (hour && minute) return 'right';
  if (minute) return 'hour';
  if (hour) return 'minute';
  return 'both';
}

/**
 * Reads a typed digital time: hours and minutes as typed on the pad. On the 12-hour clock
 * 3:05 and 15:05 both match a clock showing five past three.
 */
export function checkTyped(item: ClockItem, hours: number, minutes: number): SetResult {
  const format = formatOf(item);
  const wantHour = format === '24' ? hourOf(item.time) : dialHour(item.time);
  const typedHour = format === '24' ? hours : hours % 12 || 12;
  const hour = typedHour === wantHour;
  const minute = minutes === minuteOf(item.time);
  if (hour && minute) return 'right';
  if (minute) return 'hour';
  if (hour) return 'minute';
  return 'both';
}

/** "How long": the minutes from the start to the end time. */
export function untilMinutes(item: ClockItem): number {
  return minutesBetween(item.start ?? item.time, item.time);
}

/** Where the hands stand when a turn begins: 12 o'clock, or the start for "later". */
export function startDial(item: ClockItem): number {
  return wrapDial(item.task === 'set' && item.start !== undefined ? item.start : 0);
}

/** The clock picture the scene shows while the child reads (pick, type, until). */
export function shownTime(item: ClockItem): number {
  return item.task === 'until' ? (item.start ?? item.time) : item.time;
}

/** Three first-try turns in a row bring Golden Hour: the face glows and points double. */
export const GOLDEN_STREAK = 3;
/** Missed times come back later in the round, at most this many. */
export const MAX_REPEATS = 2;

export interface TurnScore {
  readonly firstTry: boolean;
  /** The candle was still burning. */
  readonly candle: boolean;
  readonly golden: boolean;
  /** The midnight bell. */
  readonly midnight: boolean;
  /** A missed time that came back: it rings, but for fewer points. */
  readonly repeat: boolean;
}

export const POINTS = { ring: 10, firstTry: 10, candle: 15 } as const;

/** Points for a right time: the ring and its bonus, doubled by Golden Hour and the midnight bell. */
export function turnPoints(score: TurnScore): number {
  if (score.repeat) return POINTS.ring / 2;
  const base = POINTS.ring + (score.firstTry ? POINTS.firstTry : 0);
  const doubled = base * (score.golden ? 2 : 1) * (score.midnight ? 2 : 1);
  return doubled + (score.candle ? POINTS.candle : 0);
}

/** Round stars from first tries: 7 of 9 earn three, 5 earn two. */
export function roundStars(firstTries: number, turns: number): 1 | 2 | 3 {
  const share = firstTries / turns;
  return share >= 0.75 ? 3 : share >= 0.5 ? 2 : 1;
}

export function isMastered(stage: ClockStage, stars: number) {
  return stars >= (stage.strict ? 3 : 2);
}

/** How long the candle beside the clock burns for each event. */
export const CLOCK_PACES = [
  { id: 'off', label: 'paceOff', seconds: 0 },
  { id: 'relaxed', label: 'paceRelaxed', seconds: 40 },
  { id: 'normal', label: 'paceNormal', seconds: 25 },
  { id: 'fast', label: 'paceFast', seconds: 15 },
] as const;

export type ClockPace = (typeof CLOCK_PACES)[number]['id'];

/** Candle seconds per event; typing and "how long" turns get a little longer. */
export function candleSeconds(pace: ClockPace, stage: ClockStage): number {
  const base = CLOCK_PACES.find((item) => item.id === pace)!.seconds;
  const slow = stage.modes.some((mode) => mode.task === 'type' || mode.task === 'until');
  return slow ? Math.round(base * 1.4) : base;
}

export function parseClockPace(value: unknown): ClockPace {
  return CLOCK_PACES.find((pace) => pace.id === value)?.id ?? 'off';
}

/** Puts a missed turn back before the midnight bell, unless the round already took enough. */
export function withRepeat(items: readonly ClockItem[], index: number, repeats: number) {
  if (repeats >= MAX_REPEATS || index >= items.length - 1) return null;
  const next = [...items];
  next.splice(items.length - 1, 0, items[index]);
  return next;
}
