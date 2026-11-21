import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { Clock } from './clock';
import { ClockItem, seeded, startDial, timeChoices } from './clock-levels';
import { clockTranslations } from './clock-messages';
import { ClockScores } from './clock-scores';
import { at, digital, minuteOf, wrapDial } from './clock-time';

const en = clockTranslations.en;

interface Internals {
  random: () => number;
  announce(): void;
  round: WritableSignal<{
    items: readonly ClockItem[];
    index: number;
    dial: number;
    choices: readonly number[];
  }>;
}

function setup(id: string) {
  TestBed.configureTestingModule({
    imports: [Clock],
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id })) } },
    ],
  });
  const fixture = TestBed.createComponent(Clock);
  (fixture.componentInstance as unknown as Internals).random = seeded(7);
  fixture.detectChanges();
  return fixture;
}

const element = (fixture: ComponentFixture<Clock>) => fixture.nativeElement as HTMLElement;
const internals = (fixture: ComponentFixture<Clock>) =>
  fixture.componentInstance as unknown as Internals;
const status = (fixture: ComponentFixture<Clock>) =>
  element(fixture).querySelector('.status')!.textContent!.trim();
const points = (fixture: ComponentFixture<Clock>) =>
  element(fixture).querySelector('.points strong')!.textContent!.trim();

function start(fixture: ComponentFixture<Clock>) {
  element(fixture).querySelector<HTMLButtonElement>('.start-dock button')!.click();
  fixture.detectChanges();
}

/** Puts a known turn on screen. */
function useItem(fixture: ComponentFixture<Clock>, patch: Partial<ClockItem>) {
  internals(fixture).round.update((round) => {
    const items = [...round.items];
    const item: ClockItem = { ...items[round.index], start: undefined, hours: undefined, ...patch };
    items[round.index] = item;
    return {
      ...round,
      items,
      dial: startDial(item),
      choices: item.task === 'pick' ? timeChoices(item, seeded(3)) : [],
    };
  });
  internals(fixture).announce();
  fixture.detectChanges();
}

function press(fixture: ComponentFixture<Clock>, label: string, times = 1) {
  const button = element(fixture).querySelector<HTMLButtonElement>(`[aria-label="${label}"]`);
  if (!button) throw new Error(`no button ${label}`);
  for (let n = 0; n < times; n++) button.click();
  fixture.detectChanges();
}

function ring(fixture: ComponentFixture<Clock>) {
  element(fixture).querySelector<HTMLButtonElement>('.ring-button')!.click();
  fixture.detectChanges();
}

/** Sets the hands with the buttons: the short hand hours, then the long hand in fives. */
function setHands(fixture: ComponentFixture<Clock>, time: number) {
  const dial = wrapDial(time);
  press(fixture, en.shortOn, Math.floor(dial / 60));
  press(fixture, en.longOn.replace('{n}', '5'), (dial % 60) / 5);
}

function typeKeys(fixture: ComponentFixture<Clock>, keys: string) {
  for (const key of keys) {
    const button = [
      ...element(fixture).querySelectorAll<HTMLButtonElement>('ui-number-pad .key'),
    ].find((b) => b.textContent!.trim() === key)!;
    button.click();
  }
  fixture.detectChanges();
}

function ok(fixture: ComponentFixture<Clock>) {
  element(fixture).querySelector<HTMLButtonElement>('ui-number-pad .key.ok')!.click();
  fixture.detectChanges();
}

describe('the clock tower', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    sessionStorage.clear();
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it('shows the rule, the candle choice and the empty balcony on the intro', () => {
    const fixture = setup('clock-2');
    const text = element(fixture).textContent!;
    expect(text).toContain('Level 2 of 12');
    expect(text).toContain(en.half);
    expect(text).toContain(en.balconyEmpty);
    expect(element(fixture).querySelectorAll('.level-pill').length).toBe(12);
    expect(element(fixture).querySelectorAll('.pace-choice').length).toBe(4);
  });

  it('sets the hands with the buttons and rings a right time for points and a friend', () => {
    const fixture = setup('clock-2');
    start(fixture);
    useItem(fixture, { event: 'bakery', task: 'set', show: 'words', time: at(15, 30) });
    expect(element(fixture).querySelector('.event-time')!.textContent).toContain('Half past three');
    setHands(fixture, at(3, 30));
    expect(internals(fixture).round().dial).toBe(at(3, 30));
    ring(fixture);
    expect(status(fixture)).toContain('Ding dong! The bakery opens at half past three.');
    expect(status(fixture)).toContain('the baker mouse'.replace('the', 'The'));
    expect(points(fixture)).toBe('20');
    expect(TestBed.inject(ClockScores).friends()).toEqual(['bakery']);
  });

  it('moves the short hand along with the long hand past 12', () => {
    const fixture = setup('clock-5');
    start(fixture);
    useItem(fixture, { task: 'set', show: 'digital', time: at(4, 5) });
    press(fixture, en.shortOn, 3);
    press(fixture, en.longBack.replace('{n}', '5'));
    expect(digital(internals(fixture).round().dial)).toBe('2:55');
    press(fixture, en.longOn.replace('{n}', '5'), 2);
    expect(digital(internals(fixture).round().dial)).toBe('3:05');
  });

  it('works the hands from the keyboard', () => {
    const fixture = setup('clock-1');
    start(fixture);
    useItem(fixture, { task: 'set', show: 'digital', time: at(14, 0) });
    const hour = element(fixture).querySelector<SVGGElement>('.handle.hour')!;
    const minute = element(fixture).querySelector<SVGGElement>('.handle.minute')!;
    expect(hour.getAttribute('role')).toBe('slider');
    for (const [handle, key] of [
      [hour, 'ArrowRight'],
      [hour, 'ArrowRight'],
      [minute, 'PageUp'],
    ] as const) {
      handle.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      fixture.detectChanges();
    }
    expect(digital(internals(fixture).round().dial)).toBe('2:15');
    minute.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    fixture.detectChanges();
    expect(digital(internals(fixture).round().dial)).toBe('2:00');
    expect(hour.getAttribute('aria-valuetext')).toContain('The short hand points at the 2.');
  });

  it('says which hand to check after a wrong time, without saying the time', () => {
    const fixture = setup('clock-2');
    start(fixture);
    useItem(fixture, { task: 'set', show: 'words', time: at(15, 30) });
    setHands(fixture, at(4, 30));
    ring(fixture);
    expect(status(fixture)).toContain(en.wrongHalf);
    expect(status(fixture)).toContain(en.comeBack);
    expect(status(fixture)).not.toMatch(/3:30|three/);
    press(fixture, en.shortBack);
    press(fixture, en.longBack.replace('{n}', '5'), 6);
    ring(fixture);
    expect(status(fixture)).toBe(en.wrongMinute);
  });

  it('brings a missed time back before the midnight bell', () => {
    const fixture = setup('clock-1');
    start(fixture);
    const before = internals(fixture).round().items.length;
    useItem(fixture, { task: 'set', show: 'digital', time: at(9, 0) });
    ring(fixture);
    expect(internals(fixture).round().items.length).toBe(before + 1);
    expect(internals(fixture).round().items.at(-2)!.time).toBe(at(9, 0));
    expect(internals(fixture).round().items.at(-1)!.event).toBe('midnight');
  });

  it('reads the clock and picks the time from three', () => {
    const fixture = setup('clock-4');
    start(fixture);
    useItem(fixture, { task: 'pick', show: 'digital', time: at(7, 45) });
    const choices = [...element(fixture).querySelectorAll<HTMLButtonElement>('.choice')];
    expect(choices).toHaveLength(3);
    expect(status(fixture)).toContain('The short hand is between the 7 and the 8.');
    expect(status(fixture)).toContain('The long hand points at the 9.');
    choices.find((b) => b.textContent!.trim() !== '7:45')!.click();
    fixture.detectChanges();
    expect(status(fixture)).toMatch(/short hand|long hand/);
    [...element(fixture).querySelectorAll<HTMLButtonElement>('.choice')]
      .find((b) => b.textContent!.trim() === '7:45')!
      .click();
    fixture.detectChanges();
    expect(status(fixture)).toContain('Ding dong!');
    // A second try still rings, but without the first-try bonus.
    expect(points(fixture)).toBe('10');
  });

  it('types the digital time on the pad, hour then minutes', () => {
    const fixture = setup('clock-6');
    start(fixture);
    useItem(fixture, { task: 'type', show: 'digital', time: at(20, 40) });
    typeKeys(fixture, '8');
    expect(element(fixture).querySelector('.readout')!.textContent).toContain('8');
    typeKeys(fixture, '45');
    ok(fixture);
    expect(status(fixture)).toBe(`${en.readMinute} ${en.comeBack}`);
    typeKeys(fixture, '840');
    ok(fixture);
    expect(status(fixture)).toContain('Ding dong!');
  });

  it('shows the empty time line after a wrong "how long?", then accepts the minutes', () => {
    const fixture = setup('clock-11');
    start(fixture);
    useItem(fixture, { task: 'until', show: 'digital', start: at(15, 40), time: at(16, 15) });
    expect(element(fixture).querySelector('app-clock-timeline')).toBeNull();
    typeKeys(fixture, '75');
    ok(fixture);
    expect(status(fixture)).toContain('Start at 3:40. Hop to 4:00 first.');
    const line = element(fixture).querySelector('app-clock-timeline')!;
    expect(line.textContent).toContain('3:40');
    expect(line.textContent).toContain('4:00');
    expect(line.textContent).toContain('4:15');
    expect(line.textContent).not.toContain('20');
    expect(line.textContent).not.toContain('35');
    typeKeys(fixture, '35');
    ok(fixture);
    expect(status(fixture)).toContain('Ding dong!');
  });

  it('starts "whole hours later" with the hands on the start time', () => {
    const fixture = setup('clock-10');
    start(fixture);
    useItem(fixture, {
      task: 'set',
      show: 'digital',
      start: at(15, 30),
      hours: 2,
      time: at(17, 30),
    });
    expect(digital(internals(fixture).round().dial)).toBe('3:30');
    expect(element(fixture).querySelector('.event-time')!.textContent).toContain(
      'Starts at 3:30. 2 hours later?',
    );
    press(fixture, en.shortOn, 2);
    ring(fixture);
    expect(status(fixture)).toContain('Ding dong!');
  });

  it('turns on Golden Hour after three first tries and doubles the midnight bell', () => {
    const fixture = setup('clock-1');
    start(fixture);
    const round = () => internals(fixture).round();
    while (round().index < round().items.length - 1) {
      const item = round().items[round().index];
      useItem(fixture, {
        ...item,
        task: 'set',
        show: 'digital',
        start: undefined,
        hours: undefined,
      });
      setHands(fixture, item.time);
      ring(fixture);
      vi.advanceTimersByTime(3000);
      fixture.detectChanges();
    }
    expect(element(fixture).querySelector('.golden-chip')).not.toBeNull();
    const item = round().items[round().index];
    useItem(fixture, { ...item, task: 'set', show: 'digital', time: at(22, 0) });
    setHands(fixture, at(22, 0));
    ring(fixture);
    // 10 + 10 first try, doubled by Golden Hour and doubled again by the midnight bell.
    expect(element(fixture).querySelector('ui-reward-burst')!.textContent).toContain('+80 points');
    vi.advanceTimersByTime(3000);
    fixture.detectChanges();
    const text = element(fixture).textContent!;
    expect(text).toContain(en.perfectRound);
    expect(text).toContain(en.plannerTitle);
    expect(element(fixture).querySelectorAll('.planner li')).toHaveLength(9);
    expect(TestBed.inject(ClockScores).best()['clock-1']).toBeGreaterThan(0);
  });

  it('opens the film from ? and closes it again', () => {
    const fixture = setup('clock-1');
    start(fixture);
    element(fixture).querySelector<HTMLButtonElement>('.help')!.click();
    fixture.detectChanges();
    const coach = element(fixture).querySelector('ui-coach-dialog')!;
    expect(coach.textContent).toContain(en.demoTitle);
    coach.querySelector<HTMLButtonElement>('.button.primary')!.click();
    fixture.detectChanges();
    expect(element(fixture).querySelector('ui-coach-dialog')).toBeNull();
  });

  it('lets the candle go out without stopping the game', () => {
    localStorage.setItem('feenland.clock-pace.v1', 'fast');
    const fixture = setup('clock-1');
    start(fixture);
    expect(element(fixture).querySelector('.candle-chip')).not.toBeNull();
    vi.advanceTimersByTime(16000);
    fixture.detectChanges();
    expect(status(fixture)).toBe(en.candleGone);
    expect(element(fixture).querySelector('.candle-chip.out')).not.toBeNull();
    expect(minuteOf(internals(fixture).round().items[0].time)).toBe(0);
  });
});
