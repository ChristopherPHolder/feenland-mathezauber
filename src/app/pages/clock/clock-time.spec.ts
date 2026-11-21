import { describe, expect, it } from 'vite-plus/test';
import {
  addMinutes,
  at,
  dialHour,
  digital,
  handAngles,
  hops,
  hopStops,
  hourAtAngle,
  minuteAtAngle,
  minutesBetween,
  nextFullHour,
  partOfDay,
  sameOnDial,
  setHourHand,
  turnMinuteHand,
  wording,
  wrapDay,
  wrapDial,
} from './clock-time';

describe('clock time maths', () => {
  it('wraps minutes around the day and the dial', () => {
    expect(wrapDay(-10)).toBe(at(23, 50));
    expect(wrapDay(1450)).toBe(10);
    expect(wrapDial(at(15, 30))).toBe(at(3, 30));
    expect(addMinutes(at(23, 40), 30)).toBe(at(0, 10));
  });

  it('shows 15:30 and 3:30 the same way on the dial, with 12 for noon and midnight', () => {
    expect(sameOnDial(at(15, 30), at(3, 30))).toBe(true);
    expect(sameOnDial(at(15, 30), at(4, 30))).toBe(false);
    expect(dialHour(at(0, 5))).toBe(12);
    expect(dialHour(at(12, 0))).toBe(12);
    expect(dialHour(at(15, 0))).toBe(3);
  });

  it('moves the hour hand along with the minutes like a real clock', () => {
    expect(handAngles(at(3, 0))).toEqual({ hour: 90, minute: 0 });
    expect(handAngles(at(3, 30))).toEqual({ hour: 105, minute: 180 });
    expect(handAngles(at(15, 45))).toEqual({ hour: 112.5, minute: 270 });
    expect(handAngles(at(12, 0))).toEqual({ hour: 0, minute: 0 });
  });

  it('snaps a dragged minute hand to the step and reads a dragged hour hand', () => {
    expect(minuteAtAngle(92)).toBe(15);
    expect(minuteAtAngle(358)).toBe(0);
    expect(minuteAtAngle(-90)).toBe(45);
    expect(minuteAtAngle(100, 1)).toBe(17);
    expect(hourAtAngle(95)).toBe(3);
    expect(hourAtAngle(359)).toBe(11);
  });

  it('turns the minute hand the short way so the hour hand follows past 12', () => {
    expect(turnMinuteHand(at(3, 55), 5)).toBe(at(4, 5));
    expect(turnMinuteHand(at(4, 5), 55)).toBe(at(3, 55));
    expect(turnMinuteHand(at(3, 10), 30)).toBe(at(3, 30));
    expect(turnMinuteHand(at(0, 5), 50)).toBe(at(11, 50));
    expect(setHourHand(at(3, 20), 7)).toBe(at(7, 20));
  });

  it('counts the minutes between two times, over midnight too', () => {
    expect(minutesBetween(at(3, 40), at(4, 15))).toBe(35);
    expect(minutesBetween(at(23, 30), at(0, 15))).toBe(45);
    expect(nextFullHour(at(3, 40))).toBe(at(4, 0));
    expect(nextFullHour(at(4, 0))).toBe(at(4, 0));
  });

  it('hops to the next full hour first, then whole hours, then the rest', () => {
    expect(hops(at(3, 40), at(4, 15))).toEqual([20, 15]);
    expect(hops(at(3, 40), at(5, 15))).toEqual([20, 60, 15]);
    expect(hops(at(3, 0), at(5, 0))).toEqual([60, 60]);
    expect(hops(at(3, 10), at(3, 40))).toEqual([30]);
    expect(hopStops(at(3, 40), at(5, 15))).toEqual([at(3, 40), at(4, 0), at(5, 0), at(5, 15)]);
  });

  it('writes digital times on the 12-hour and the 24-hour clock', () => {
    expect(digital(at(15, 5))).toBe('3:05');
    expect(digital(at(15, 5), '24')).toBe('15:05');
    expect(digital(at(0, 30))).toBe('12:30');
    expect(digital(at(0, 30), '24')).toBe('0:30');
  });

  it('knows the part of the day for the sky', () => {
    expect(partOfDay(at(6, 0))).toBe('dawn');
    expect(partOfDay(at(9, 0))).toBe('morning');
    expect(partOfDay(at(15, 0))).toBe('afternoon');
    expect(partOfDay(at(19, 30))).toBe('evening');
    expect(partOfDay(at(23, 0))).toBe('night');
  });
});

describe('saying the time', () => {
  it('says English times with past and to', () => {
    expect(wording('en', at(3, 0))).toBe('three o’clock');
    expect(wording('en', at(3, 30))).toBe('half past three');
    expect(wording('en', at(3, 15))).toBe('quarter past three');
    expect(wording('en', at(4, 45))).toBe('quarter to five');
    expect(wording('en', at(3, 25))).toBe('twenty-five past three');
    expect(wording('en', at(3, 40))).toBe('twenty to four');
    expect(wording('en', at(11, 55))).toBe('five to twelve');
    expect(wording('en', at(15, 10))).toBe('ten past three');
  });

  it('says German halb with the next hour: halb vier is 3:30', () => {
    expect(wording('de', at(3, 30))).toBe('halb vier');
    expect(wording('de', at(12, 30))).toBe('halb eins');
    expect(wording('de', at(1, 0))).toBe('ein Uhr');
    expect(wording('de', at(3, 0))).toBe('drei Uhr');
    expect(wording('de', at(3, 15))).toBe('Viertel nach drei');
    expect(wording('de', at(4, 45))).toBe('Viertel vor fünf');
    expect(wording('de', at(3, 25))).toBe('fünf vor halb vier');
    expect(wording('de', at(3, 35))).toBe('fünf nach halb vier');
    expect(wording('de', at(3, 20))).toBe('zwanzig nach drei');
    expect(wording('de', at(3, 50))).toBe('zehn vor vier');
    expect(wording('de', at(0, 15))).toBe('Viertel nach zwölf');
  });

  it('says Spanish y media, y cuarto and menos cuarto', () => {
    expect(wording('es', at(3, 30))).toBe('las tres y media');
    expect(wording('es', at(1, 30))).toBe('la una y media');
    expect(wording('es', at(3, 15))).toBe('las tres y cuarto');
    expect(wording('es', at(4, 45))).toBe('las cinco menos cuarto');
    expect(wording('es', at(12, 45))).toBe('la una menos cuarto');
    expect(wording('es', at(3, 0))).toBe('las tres en punto');
    expect(wording('es', at(3, 25))).toBe('las tres y veinticinco');
    expect(wording('es', at(3, 40))).toBe('las cuatro menos veinte');
  });

  it('says French et demie, et quart, moins le quart, midi and minuit', () => {
    expect(wording('fr', at(3, 30))).toBe('trois heures et demie');
    expect(wording('fr', at(1, 30))).toBe('une heure et demie');
    expect(wording('fr', at(3, 15))).toBe('trois heures et quart');
    expect(wording('fr', at(4, 45))).toBe('cinq heures moins le quart');
    expect(wording('fr', at(12, 30))).toBe('midi et demi');
    expect(wording('fr', at(11, 45))).toBe('midi moins le quart');
    expect(wording('fr', at(23, 50))).toBe('minuit moins dix');
    expect(wording('fr', at(0, 0))).toBe('minuit');
    expect(wording('fr', at(15, 20))).toBe('trois heures vingt');
    expect(wording('fr', at(15, 35))).toBe('quatre heures moins vingt-cinq');
  });

  it('falls back to digital for single minutes', () => {
    expect(wording('en', at(3, 17))).toBe('3:17');
    expect(wording('de', at(15, 17))).toBe('3:17');
  });
});
