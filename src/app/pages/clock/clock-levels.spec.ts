import { describe, expect, it } from 'vite-plus/test';
import {
  candleSeconds,
  checkSet,
  checkTyped,
  ClockItem,
  clockLevels,
  clockStage,
  clockStages,
  createRound,
  EVENTS,
  isMastered,
  parseClockPace,
  roundStars,
  seeded,
  startDial,
  timeChoices,
  turnPoints,
  untilMinutes,
  withRepeat,
} from './clock-levels';
import { at, digital, hourOf, minuteOf, sameOnDial, wrapDial } from './clock-time';

const item = (patch: Partial<ClockItem>): ClockItem => ({
  event: 'bakery',
  task: 'set',
  show: 'words',
  time: at(15, 30),
  step: 5,
  ...patch,
});

describe('clock levels', () => {
  it('has twelve levels in five topics with ids clock-1 … clock-12', () => {
    expect(clockLevels.map((level) => level.id)).toEqual(
      Array.from({ length: 12 }, (_, index) => `clock-${index + 1}`),
    );
    expect(new Set(clockStages.map((stage) => stage.group)).size).toBe(5);
    expect(clockStage('clock-12')?.strict).toBe(true);
    expect(clockStage('clock-13')).toBeUndefined();
    expect(clockStage('gondola-1')).toBeUndefined();
  });

  it('builds rounds of eight events and the midnight bell, in the order of the day', () => {
    for (const stage of clockStages) {
      for (let seed = 1; seed <= 25; seed++) {
        const round = createRound(stage, seeded(seed));
        expect(round).toHaveLength(stage.turns);
        expect(round.at(-1)!.event).toBe('midnight');
        const events = round.slice(0, -1).map((turn) => turn.event);
        expect(new Set(events).size).toBe(events.length);
        const starts = events.map((id) => EVENTS.find((event) => event.id === id)!.from);
        expect(starts).toEqual([...starts].sort((a, b) => a - b));
      }
    }
  });

  it('keeps each event at a time of day that suits it', () => {
    for (const stage of clockStages) {
      for (const turn of createRound(stage, seeded(3))) {
        if (turn.event === 'midnight' || turn.task === 'until') continue;
        const event = EVENTS.find((e) => e.id === turn.event)!;
        expect(hourOf(turn.time)).toBeGreaterThanOrEqual(event.from);
        expect(hourOf(turn.time)).toBeLessThanOrEqual(event.to);
      }
    }
  });

  it('uses only the minute marks of each level', () => {
    const minutes = (id: string) =>
      Array.from({ length: 30 }, (_, seed) => createRound(clockStage(id)!, seeded(seed)))
        .flat()
        .map((turn) => minuteOf(turn.time));
    expect(new Set(minutes('clock-1'))).toEqual(new Set([0]));
    expect(new Set(minutes('clock-2'))).toEqual(new Set([0, 30]));
    expect(minutes('clock-3').every((m) => [15, 30, 45].includes(m))).toBe(true);
    expect(minutes('clock-5').every((m) => m % 5 === 0)).toBe(true);
    expect(minutes('clock-7').every((m) => m % 5 !== 0)).toBe(true);
  });

  it('never asks the same clock picture twice in a round', () => {
    for (const stage of clockStages)
      for (let seed = 1; seed <= 20; seed++) {
        const round = createRound(stage, seeded(seed));
        for (const [index, turn] of round.entries())
          for (const other of round.slice(index + 1))
            if (turn.task === other.task) expect(sameOnDial(turn.time, other.time)).toBe(false);
      }
  });

  it('asks "how long" across the hour, so the first hop goes to the full hour', () => {
    for (let seed = 1; seed <= 40; seed++)
      for (const turn of createRound(clockStage('clock-11')!, seeded(seed))) {
        expect(turn.task).toBe('until');
        const minutes = untilMinutes(turn);
        expect(minutes % 5).toBe(0);
        expect(minutes).toBeGreaterThanOrEqual(15);
        expect(minutes).toBeLessThan(120);
        expect(minuteOf(turn.start!)).toBeGreaterThan(minuteOf(turn.time));
      }
  });

  it('starts "whole hours later" with the hands on the start time', () => {
    for (const turn of createRound(clockStage('clock-10')!, seeded(5))) {
      expect(turn.hours).toBeGreaterThanOrEqual(1);
      expect(wrapDial(turn.start! + turn.hours! * 60)).toBe(wrapDial(turn.time));
      expect(startDial(turn)).toBe(wrapDial(turn.start!));
    }
    expect(startDial(item({}))).toBe(0);
  });
});

describe('checking an answer', () => {
  it('tells a wrong hour from wrong minutes on the dial', () => {
    const turn = item({ time: at(15, 30) });
    expect(checkSet(turn, at(3, 30))).toBe('right');
    expect(checkSet(turn, at(4, 30))).toBe('hour');
    expect(checkSet(turn, at(3, 0))).toBe('minute');
    expect(checkSet(turn, at(6, 15))).toBe('both');
  });

  it('accepts 3:05 and 15:05 for a 12-hour clock, but only 15:05 on the 24-hour clock', () => {
    expect(checkTyped(item({ task: 'type', time: at(15, 5), show: 'digital' }), 3, 5)).toBe(
      'right',
    );
    expect(checkTyped(item({ task: 'type', time: at(15, 5), show: 'digital' }), 15, 5)).toBe(
      'right',
    );
    expect(checkTyped(item({ task: 'type', time: at(15, 5), show: 'digital24' }), 3, 5)).toBe(
      'hour',
    );
    expect(checkTyped(item({ task: 'type', time: at(0, 5), show: 'digital' }), 12, 5)).toBe(
      'right',
    );
    expect(checkTyped(item({ task: 'type', time: at(3, 5), show: 'digital' }), 3, 50)).toBe(
      'minute',
    );
  });

  it('offers three different times, the right one among them', () => {
    for (const stage of clockStages)
      for (let seed = 1; seed <= 20; seed++)
        for (const turn of createRound(stage, seeded(seed))) {
          if (turn.task !== 'pick') continue;
          const choices = timeChoices(turn, seeded(seed));
          expect(choices).toHaveLength(3);
          const format = turn.show === 'digital24' ? '24' : '12';
          const labels = choices.map((time) =>
            format === '24' ? digital(time, '24') : digital(wrapDial(time)),
          );
          expect(new Set(labels).size).toBe(3);
          expect(choices).toContain(turn.time);
        }
  });

  it('offers the other half of the day when reading morning or evening', () => {
    const turn = item({ task: 'pick', show: 'digital24', time: at(7, 0) });
    const labels = timeChoices(turn, seeded(1)).map((time) => digital(time, '24'));
    expect(labels).toContain('7:00');
    expect(labels).toContain('19:00');
  });

  it('offers the hour after for half past, the classic halb mix-up', () => {
    const turn = item({ task: 'pick', show: 'words', time: at(15, 30) });
    const labels = timeChoices(turn, seeded(2)).map((time) => digital(wrapDial(time)));
    expect(labels).toContain('4:30');
  });
});

describe('repeats, points and stars', () => {
  it('puts a missed time back before the midnight bell, twice at most', () => {
    const round = createRound(clockStage('clock-1')!, seeded(1));
    const again = withRepeat(round, 2, 0)!;
    expect(again).toHaveLength(round.length + 1);
    expect(again.at(-2)).toBe(round[2]);
    expect(again.at(-1)!.event).toBe('midnight');
    expect(withRepeat(round, 2, 2)).toBeNull();
    expect(withRepeat(round, round.length - 1, 0)).toBeNull();
  });

  it('scores first tries, Golden Hour, the midnight bell and the candle', () => {
    const base = { firstTry: false, candle: false, golden: false, midnight: false, repeat: false };
    expect(turnPoints(base)).toBe(10);
    expect(turnPoints({ ...base, firstTry: true })).toBe(20);
    expect(turnPoints({ ...base, firstTry: true, golden: true })).toBe(40);
    expect(turnPoints({ ...base, firstTry: true, golden: true, midnight: true })).toBe(80);
    expect(turnPoints({ ...base, firstTry: true, candle: true })).toBe(35);
    expect(turnPoints({ ...base, repeat: true, candle: true })).toBe(5);
  });

  it('gives stars for first tries and needs three on the tower master', () => {
    expect(roundStars(9, 9)).toBe(3);
    expect(roundStars(7, 9)).toBe(3);
    expect(roundStars(5, 9)).toBe(2);
    expect(roundStars(4, 9)).toBe(1);
    expect(isMastered(clockStage('clock-1')!, 2)).toBe(true);
    expect(isMastered(clockStage('clock-12')!, 2)).toBe(false);
  });

  it('burns the candle longer on typing levels and remembers no pace by default', () => {
    expect(candleSeconds('off', clockStage('clock-1')!)).toBe(0);
    expect(candleSeconds('normal', clockStage('clock-1')!)).toBe(25);
    expect(candleSeconds('normal', clockStage('clock-6')!)).toBe(35);
    expect(parseClockPace('fast')).toBe('fast');
    expect(parseClockPace('warp')).toBe('off');
  });
});
