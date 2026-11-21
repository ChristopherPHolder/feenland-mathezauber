import type { Locale } from '../../core/messages';

/**
 * Pure time maths for the Clock Tower. A time is the number of minutes since midnight
 * (0 … 1439). The clock face only knows 12 hours, so "on the dial" a time is minutes modulo 720.
 * Nothing here touches the page: the game, both scenes and the tests all read these helpers.
 */

export const DAY = 24 * 60;
export const HALF_DAY = 12 * 60;

/** Keeps any minute count inside one day: −10 is 23:50, 1450 is 0:10. */
export function wrapDay(minutes: number): number {
  return ((Math.round(minutes) % DAY) + DAY) % DAY;
}

/** Keeps any minute count on the 12-hour dial: 0 is 12:00, 719 is 11:59. */
export function wrapDial(minutes: number): number {
  return ((Math.round(minutes) % HALF_DAY) + HALF_DAY) % HALF_DAY;
}

export function addMinutes(time: number, minutes: number): number {
  return wrapDay(time + minutes);
}

export function at(hour: number, minute = 0): number {
  return wrapDay(hour * 60 + minute);
}

export function hourOf(time: number): number {
  return Math.floor(wrapDay(time) / 60);
}

export function minuteOf(time: number): number {
  return wrapDay(time) % 60;
}

/** The hour the short hand shows, 1 … 12. */
export function dialHour(time: number): number {
  return hourOf(time) % 12 || 12;
}

/** Two times look the same on the clock face (3:30 and 15:30 do). */
export function sameOnDial(a: number, b: number): boolean {
  return wrapDial(a) === wrapDial(b);
}

/**
 * Where the hands point, in degrees clockwise from 12. The hour hand moves along with the
 * minutes like a real clock: at 3:30 it stands halfway between the 3 and the 4.
 */
export function handAngles(time: number): { readonly hour: number; readonly minute: number } {
  const dial = wrapDial(time);
  return { hour: (dial / HALF_DAY) * 360, minute: (dial % 60) * 6 };
}

/** The minute a dragged minute hand points to, snapped to `step` minutes (0 … 59). */
export function minuteAtAngle(degrees: number, step = 5): number {
  const turned = ((degrees % 360) + 360) % 360;
  return (Math.round(turned / 6 / step) * step) % 60;
}

/** The hour a dragged hour hand points to (0 = 12 … 11), for a hand at `degrees`. */
export function hourAtAngle(degrees: number): number {
  const turned = ((degrees % 360) + 360) % 360;
  return Math.floor(turned / 30) % 12;
}

/**
 * Moves the dial's minute hand to `minute` the short way round, so the hour hand follows like
 * on a real clock: dragging past 12 forward moves on to the next hour.
 */
export function turnMinuteHand(dial: number, minute: number): number {
  const current = wrapDial(dial) % 60;
  let delta = minute - current;
  if (delta > 30) delta -= 60;
  if (delta < -30) delta += 60;
  return wrapDial(dial + delta);
}

/** Puts the hour hand on `hour` (0 = 12 … 11) and keeps the minutes. */
export function setHourHand(dial: number, hour: number): number {
  return wrapDial(hour * 60 + (wrapDial(dial) % 60));
}

/** Minutes from `start` to `end`, going forward (over midnight if needed). */
export function minutesBetween(start: number, end: number): number {
  return wrapDay(end - start);
}

/** The next full hour after `time` (or `time` itself when it is on the hour). */
export function nextFullHour(time: number): number {
  return minuteOf(time) === 0 ? wrapDay(time) : addMinutes(time, 60 - minuteOf(time));
}

/**
 * The hops on a time line from `start` to `end`: first to the next full hour, then whole hours,
 * then the rest. 3:40 → 5:15 is 20, 60 and 15. Hops of 0 are left out.
 */
export function hops(start: number, end: number): number[] {
  const total = minutesBetween(start, end);
  const first = Math.min(total, (60 - minuteOf(start)) % 60);
  const result: number[] = first ? [first] : [];
  let left = total - first;
  while (left >= 60) {
    result.push(60);
    left -= 60;
  }
  if (left) result.push(left);
  return result;
}

/** The stops along those hops, start and end included. */
export function hopStops(start: number, end: number): number[] {
  const stops = [wrapDay(start)];
  for (const hop of hops(start, end)) stops.push(addMinutes(stops.at(-1)!, hop));
  return stops;
}

export type ClockFormat = '12' | '24';

/** Digital time: "3:05" on the 12-hour clock, "15:05" on the 24-hour clock. */
export function digital(time: number, format: ClockFormat = '12'): string {
  const hour = format === '24' ? hourOf(time) : dialHour(time);
  return `${hour}:${String(minuteOf(time)).padStart(2, '0')}`;
}

export type PartOfDay = 'night' | 'dawn' | 'morning' | 'afternoon' | 'evening';

/** The sky a time belongs to: sunrise and sunset are a little band around 6 and 19. */
export function partOfDay(time: number): PartOfDay {
  const hour = hourOf(time);
  if (hour < 5 || hour >= 21) return 'night';
  if (hour < 7) return 'dawn';
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

/** a.m. half or p.m. half of the day. */
export function isAfternoon(time: number): boolean {
  return wrapDay(time) >= HALF_DAY;
}

// ---------------------------------------------------------------------------------------------
// Saying the time out loud. Each language has its own way, and German says "halb vier" for 3:30
// (half on the way to four), so the hour named after "halb" is the next one.
// ---------------------------------------------------------------------------------------------

const EN_HOURS = [
  'twelve',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
];
const EN_MINUTES: Record<number, string> = {
  5: 'five',
  10: 'ten',
  20: 'twenty',
  25: 'twenty-five',
};
/** German hours as used after "nach", "vor" and "halb": eins, zwei … zwölf. */
const DE_HOURS = [
  'zwölf',
  'eins',
  'zwei',
  'drei',
  'vier',
  'fünf',
  'sechs',
  'sieben',
  'acht',
  'neun',
  'zehn',
  'elf',
];
const DE_MINUTES: Record<number, string> = { 5: 'fünf', 10: 'zehn', 20: 'zwanzig' };
const ES_HOURS = [
  'las doce',
  'la una',
  'las dos',
  'las tres',
  'las cuatro',
  'las cinco',
  'las seis',
  'las siete',
  'las ocho',
  'las nueve',
  'las diez',
  'las once',
];
const ES_MINUTES: Record<number, string> = {
  5: 'cinco',
  10: 'diez',
  20: 'veinte',
  25: 'veinticinco',
};
const FR_HOURS = [
  'douze heures',
  'une heure',
  'deux heures',
  'trois heures',
  'quatre heures',
  'cinq heures',
  'six heures',
  'sept heures',
  'huit heures',
  'neuf heures',
  'dix heures',
  'onze heures',
];
const FR_MINUTES: Record<number, string> = {
  5: 'cinq',
  10: 'dix',
  20: 'vingt',
  25: 'vingt-cinq',
};

/** True when the time can be said in words (every five minutes). */
export function sayable(time: number): boolean {
  return minuteOf(time) % 5 === 0;
}

/**
 * The time as a child would say it, in the given language, for times on a five-minute mark.
 * Other times have no common spoken form for this age, so they fall back to digital.
 */
export function wording(locale: Locale, time: number): string {
  const t = wrapDay(time);
  if (!sayable(t)) return digital(t);
  const m = minuteOf(t);
  const hour = hourOf(t) % 12;
  const next = (hour + 1) % 12;
  switch (locale) {
    case 'de':
      return wordingDe(m, hour, next);
    case 'es':
      return wordingEs(m, hour, next);
    case 'fr':
      return wordingFr(m, hourOf(t));
    default:
      return wordingEn(m, hour, next);
  }
}

function wordingEn(m: number, hour: number, next: number): string {
  if (m === 0) return `${EN_HOURS[hour]} o’clock`;
  if (m === 15) return `quarter past ${EN_HOURS[hour]}`;
  if (m === 30) return `half past ${EN_HOURS[hour]}`;
  if (m === 45) return `quarter to ${EN_HOURS[next]}`;
  if (m < 30) return `${EN_MINUTES[m]} past ${EN_HOURS[hour]}`;
  return `${EN_MINUTES[60 - m]} to ${EN_HOURS[next]}`;
}

function wordingDe(m: number, hour: number, next: number): string {
  if (m === 0) return `${hour === 1 ? 'ein' : DE_HOURS[hour]} Uhr`;
  if (m === 15) return `Viertel nach ${DE_HOURS[hour]}`;
  if (m === 30) return `halb ${DE_HOURS[next]}`;
  if (m === 45) return `Viertel vor ${DE_HOURS[next]}`;
  if (m === 25) return `fünf vor halb ${DE_HOURS[next]}`;
  if (m === 35) return `fünf nach halb ${DE_HOURS[next]}`;
  if (m < 30) return `${DE_MINUTES[m]} nach ${DE_HOURS[hour]}`;
  return `${DE_MINUTES[60 - m]} vor ${DE_HOURS[next]}`;
}

function wordingEs(m: number, hour: number, next: number): string {
  if (m === 0) return `${ES_HOURS[hour]} en punto`;
  if (m === 15) return `${ES_HOURS[hour]} y cuarto`;
  if (m === 30) return `${ES_HOURS[hour]} y media`;
  if (m === 45) return `${ES_HOURS[next]} menos cuarto`;
  if (m < 30) return `${ES_HOURS[hour]} y ${ES_MINUTES[m]}`;
  return `${ES_HOURS[next]} menos ${ES_MINUTES[60 - m]}`;
}

/** French says "midi" and "minuit" for twelve, so it needs the 24-hour hour. */
function frHour(hour24: number): string {
  const hour = ((hour24 % 24) + 24) % 24;
  if (hour === 12) return 'midi';
  if (hour === 0) return 'minuit';
  return FR_HOURS[hour % 12];
}

function wordingFr(m: number, hour24: number): string {
  const hour = frHour(hour24);
  const next = frHour(hour24 + 1);
  // "Midi" and "minuit" are masculine: "midi et demi", but "trois heures et demie".
  const twelve = hour === 'midi' || hour === 'minuit';
  if (m === 0) return hour;
  if (m === 15) return `${hour} et quart`;
  if (m === 30) return `${hour} et ${twelve ? 'demi' : 'demie'}`;
  if (m === 45) return `${next} moins le quart`;
  if (m < 30) return `${hour} ${FR_MINUTES[m]}`;
  return `${next} moins ${FR_MINUTES[60 - m]}`;
}

/** Wording with a capital first letter, for the start of a card or a button. */
export function capitalized(text: string): string {
  return text.charAt(0).toLocaleUpperCase() + text.slice(1);
}
