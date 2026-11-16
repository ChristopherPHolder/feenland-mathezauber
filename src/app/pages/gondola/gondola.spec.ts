import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { ProgressService } from '../../core/progress';
import { HatcheryStore } from '../hatchery/hatchery-store';
import { Gondola } from './gondola';
import { GondolaItem, seeded, shapeOf } from './gondola-levels';
import { gondolaTranslations } from './gondola-messages';
import { GondolaScores } from './gondola-scores';

const en = gondolaTranslations.en;

interface Internals {
  random: () => number;
  announceScene(): void;
  round: WritableSignal<{
    items: readonly GondolaItem[];
    index: number;
    item: GondolaItem;
    choices: readonly number[];
  }>;
}

function setup(id: string) {
  TestBed.configureTestingModule({
    imports: [Gondola],
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id })) } },
    ],
  });
  const fixture = TestBed.createComponent(Gondola);
  (fixture.componentInstance as unknown as Internals).random = seeded(7);
  fixture.detectChanges();
  return fixture;
}

const element = (fixture: ComponentFixture<Gondola>) => fixture.nativeElement as HTMLElement;
const internals = (fixture: ComponentFixture<Gondola>) =>
  fixture.componentInstance as unknown as Internals;
const status = (fixture: ComponentFixture<Gondola>) =>
  element(fixture).querySelector('.status')!.textContent!.trim();
const points = (fixture: ComponentFixture<Gondola>) =>
  element(fixture).querySelector('.points strong')!.textContent!.trim();

function start(fixture: ComponentFixture<Gondola>) {
  element(fixture).querySelector<HTMLButtonElement>('.start-dock button')!.click();
  fixture.detectChanges();
}

/** Puts a known sum on the current turn. */
function useItem(fixture: ComponentFixture<Gondola>, item: GondolaItem) {
  internals(fixture).round.update((round) => {
    const items = [...round.items];
    items[round.index] = item;
    return { ...round, items, item };
  });
  internals(fixture).announceScene();
  fixture.detectChanges();
}

function tap(fixture: ComponentFixture<Gondola>, n: number) {
  const button = [...element(fixture).querySelectorAll<HTMLButtonElement>('.tap-button')].find(
    (b) => b.textContent!.trim() === String(n),
  )!;
  button.click();
  fixture.detectChanges();
}

function ride(fixture: ComponentFixture<Gondola>) {
  vi.advanceTimersByTime(1600);
  fixture.detectChanges();
}

function choose(fixture: ComponentFixture<Gondola>, n: number) {
  const button = [...element(fixture).querySelectorAll<HTMLButtonElement>('.choice')].find(
    (b) => b.textContent!.trim() === String(n),
  );
  if (!button) throw new Error(`no choice ${n}`);
  button.click();
  fixture.detectChanges();
}

/** Plays the current turn right on the first try with the tap fallback. */
function playTurn(fixture: ComponentFixture<Gondola>) {
  const item = internals(fixture).round().item;
  const shape = shapeOf(item);
  tap(fixture, shape.fill);
  ride(fixture);
  choose(fixture, shape.answer);
  vi.advanceTimersByTime(3000);
  fixture.detectChanges();
}

describe('the mountain gondola', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    sessionStorage.clear();
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it('shows the trick, the village and the pace choice on the intro', () => {
    const fixture = setup('gondola-2');
    const text = element(fixture).textContent!;
    expect(text).toContain('Level 2 of 12');
    expect(text).toContain(en.fill8);
    expect(text).toContain(en.villageEmpty);
    expect(element(fixture).querySelectorAll('.level-pill').length).toBe(12);
    expect(element(fixture).querySelectorAll('.pace-choice').length).toBe(4);
    expect(
      element(fixture).querySelector<HTMLInputElement>('.pace-choice input:checked')!.value,
    ).toBe('off');
  });

  it('plays a turn with the tap fallback: fill the cabin, then say how many', () => {
    const fixture = setup('gondola-2');
    const warm = vi.spyOn(TestBed.inject(HatcheryStore), 'warm');
    start(fixture);
    useItem(fixture, { kind: 'add', a: 8, b: 5 });
    element(fixture).querySelector<HTMLButtonElement>('.start-dock button');
    expect(element(fixture).querySelector('.sum')!.textContent).toContain('8 + 5 =');
    expect(
      element(fixture).querySelector<HTMLButtonElement>('.tap-button')!.getAttribute('aria-label'),
    ).toBe(en.tapOneAdd);
    tap(fixture, 2);
    expect(status(fixture)).toBe(en.filled);
    ride(fixture);
    expect(status(fixture)).toBe(en.askAdd);
    expect(element(fixture).querySelectorAll('.choice').length).toBe(4);
    choose(fixture, 13);
    expect(status(fixture)).toContain('Yes! 8 + 5 = 13.');
    expect(status(fixture)).toContain(en.firstTryBonus);
    // A ride, a first-try split and the one-move bonus.
    expect(points(fixture)).toBe('25');
    expect(warm).toHaveBeenCalledTimes(1);
    const card = element(fixture).querySelector('app-gondola-reward')!;
    expect(card.getAttribute('aria-hidden')).toBe('true');
    expect(card.textContent).toContain(en.badgeFirst);
    expect(card.textContent).toContain(en.badgeOneMove);
  });

  it('splits by dragging the handle, and drags that wander lose only the one-move bonus', () => {
    const fixture = setup('gondola-1');
    start(fixture);
    useItem(fixture, { kind: 'add', a: 9, b: 4 });
    const handle = element(fixture).querySelector<HTMLInputElement>('input[type="range"]')!;
    expect(handle.getAttribute('aria-valuetext')).toBe(en.splitNone);
    expect(element(fixture).querySelector<HTMLButtonElement>('.hop')!.disabled).toBe(true);
    for (const value of ['3', '1']) {
      handle.value = value;
      handle.dispatchEvent(new Event('input'));
      handle.dispatchEvent(new Event('change'));
      fixture.detectChanges();
    }
    expect(handle.getAttribute('aria-valuetext')).toBe('1 hop in, 3 wait');
    element(fixture).querySelector<HTMLButtonElement>('.hop')!.click();
    fixture.detectChanges();
    expect(status(fixture)).toBe(en.filled);
    ride(fixture);
    choose(fixture, 13);
    expect(points(fixture)).toBe('20');
  });

  it('bounces a bunny off a full cabin, jams the door on too few, and never shows the answer', () => {
    const fixture = setup('gondola-2');
    start(fixture);
    useItem(fixture, { kind: 'add', a: 8, b: 5 });
    tap(fixture, 3);
    expect(status(fixture)).toBe(en.tooManyAdd);
    expect(element(fixture).querySelector('app-gondola-card')).toBeNull();
    tap(fixture, 1);
    expect(status(fixture)).toBe(en.tooFewAdd);
    // The empty seats glow in the picture, and a picture card shows the trick.
    expect(element(fixture).querySelector('.cabin.is-glow')).not.toBeNull();
    const card = element(fixture).querySelector('app-gondola-card')!;
    expect(card.textContent).toContain(en.cardFill);
    expect(card.textContent).not.toMatch(/\b13\b/);
    expect(card.textContent).not.toMatch(/8 \+ 2/);
    tap(fixture, 2);
    ride(fixture);
    choose(fixture, 10);
    expect(status(fixture)).toBe(en.stopAtTenAdd);
    const wrong = internals(fixture)
      .round()
      .choices.find((n) => n !== 13 && n !== 10)!;
    choose(fixture, wrong);
    expect(status(fixture)).toBe(en.tryAgain);
    expect(element(fixture).querySelector('app-gondola-card')!.textContent).not.toMatch(/\b13\b/);
    expect(element(fixture).textContent).not.toMatch(/= 13/);
    choose(fixture, 13);
    // No first-try bonus after a slip: just the ride.
    expect(points(fixture)).toBe('10');
  });

  it('goes down to ten first, and takes from the full ten on level 6', () => {
    const fixture = setup('gondola-6');
    start(fixture);
    useItem(fixture, { kind: 'sub', a: 13, b: 9 });
    expect(status(fixture)).toBe(
      'One full cabin is at the station. 3 loose bunnies are on the platform. 9 bunnies must go down.',
    );
    element(fixture).querySelector<HTMLButtonElement>('.take-ten')!.click();
    fixture.detectChanges();
    expect(status(fixture)).toBe(en.takeTenDone);
    ride(fixture);
    choose(fixture, 4);
    // Ride, first try, one move and a clever trick.
    expect(points(fixture)).toBe('35');
    vi.advanceTimersByTime(3000);
    fixture.detectChanges();
    useItem(fixture, { kind: 'sub', a: 15, b: 8 });
    tap(fixture, 5);
    expect(status(fixture)).toBe(en.filledSub);
  });

  it('types two-digit answers on a pad laid out in fives, and offers the express on level 10', () => {
    const fixture = setup('gondola-10');
    start(fixture);
    useItem(fixture, { kind: 'add', a: 34, b: 9 });
    expect(element(fixture).querySelector('app-gondola-cherry')).not.toBeNull();
    const express = element(fixture).querySelector<HTMLButtonElement>('.express')!;
    expect(express.textContent!.trim()).toBe('Express: +10, then 1 bunny hops off');
    express.click();
    fixture.detectChanges();
    ride(fixture);
    const keys = [...element(fixture).querySelectorAll<HTMLButtonElement>('.key')];
    expect(keys.slice(0, 10).map((k) => k.textContent!.trim())).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      '0',
    ]);
    keys[3].click();
    keys[4].click();
    fixture.detectChanges();
    element(fixture).querySelector<HTMLButtonElement>('.key.ok')!.click();
    fixture.detectChanges();
    expect(status(fixture)).toBe(en.wrongWayAdd);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '4' }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '3' }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();
    expect(status(fixture)).toContain('Yes! 34 + 9 = 43.');
  });

  it('pulls the snow tarp over after three quick first tries, and lifts it after a miss', () => {
    const fixture = setup('gondola-1');
    start(fixture);
    for (let turn = 0; turn < 3; turn++) playTurn(fixture);
    expect(element(fixture).querySelector('.tarp')).toBeNull();
    expect(element(fixture).querySelector('.golden-chip')).not.toBeNull();
    vi.advanceTimersByTime(1500);
    fixture.detectChanges();
    expect(element(fixture).querySelector('.tarp')).not.toBeNull();
    const fill = shapeOf(internals(fixture).round().item).fill;
    tap(fixture, fill + 1);
    expect(element(fixture).querySelector('.tarp')).toBeNull();
    expect(element(fixture).querySelector('.golden-chip')).toBeNull();
  });

  it('finishes the round, builds a house in the village and records the stars', () => {
    const fixture = setup('gondola-1');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    start(fixture);
    for (let turn = 0; turn < 8; turn++) playTurn(fixture);
    const outcome = element(fixture).querySelector('.outcome')!;
    expect(outcome.querySelector('h2')!.textContent).toContain(en.perfectRound);
    expect(outcome.querySelectorAll('.star.earned').length).toBe(3);
    expect(outcome.textContent).toContain('New in your village: a ski hut!');
    expect(TestBed.inject(GondolaScores).village()).toBe(1);
    const progress = TestBed.inject(ProgressService).progress();
    expect(progress.stars?.['gondola-1']).toBe(3);
    expect(progress.mastered).toContain('gondola-1');
    const celebrate = [...outcome.querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.textContent!.trim() === en.celebrate,
    )!;
    celebrate.click();
    expect(navigate).toHaveBeenCalledWith(['/complete', 'gondola-1']);
  });

  it('lets the cocoa go cold when the cloud arrives, without stopping the ride', () => {
    localStorage.setItem('feenland.gondola-pace.v1', 'fast');
    const fixture = setup('gondola-2');
    start(fixture);
    useItem(fixture, { kind: 'add', a: 8, b: 5 });
    expect(element(fixture).querySelector('.cocoa-chip')!.textContent).toContain('warm');
    vi.advanceTimersByTime(11_000);
    fixture.detectChanges();
    expect(status(fixture)).toBe(en.cold);
    expect(element(fixture).querySelector('.cocoa-chip')!.textContent).toContain('cold');
    tap(fixture, 2);
    ride(fixture);
    choose(fixture, 13);
    expect(points(fixture)).toBe('25');
  });

  it('pays the cocoa bonus when the bunnies beat the cloud', () => {
    localStorage.setItem('feenland.gondola-pace.v1', 'relaxed');
    const fixture = setup('gondola-2');
    start(fixture);
    useItem(fixture, { kind: 'add', a: 8, b: 5 });
    tap(fixture, 2);
    ride(fixture);
    choose(fixture, 13);
    expect(status(fixture)).toContain(en.cocoaBonus);
    expect(points(fixture)).toBe('40');
  });

  it('shows how to ride with a film instead of paragraphs', () => {
    const fixture = setup('gondola-1');
    const film = element(fixture).querySelector('app-gondola-demo')!;
    expect(film).not.toBeNull();
    expect(film.textContent).toContain(en.demoLook);
    expect(film.querySelector('.sentence')!.textContent).toContain('9 + 4 → 10 + 3');
    vi.advanceTimersByTime(10_000);
    fixture.detectChanges();
    expect(film.textContent).toContain(en.demoRest);
    expect(film.querySelector('.replay')!.getAttribute('aria-label')).toBe(en.demoReplay);
    expect(element(fixture).textContent).not.toContain(en.story);
  });

  it('guides the first cabins, opens the film from ?, and lets the cloud wait meanwhile', () => {
    localStorage.setItem('feenland.gondola-pace.v1', 'fast');
    const fixture = setup('gondola-1');
    start(fixture);
    useItem(fixture, { kind: 'add', a: 9, b: 4 });
    expect(element(fixture).querySelector('.split-zone.is-guided')).not.toBeNull();
    element(fixture).querySelector<HTMLButtonElement>('.help')!.click();
    fixture.detectChanges();
    const coach = element(fixture).querySelector('app-gondola-coach')!;
    // On a 9 + 4 turn the film uses other numbers, so it never shows this answer.
    expect(coach.querySelector('.sentence')!.textContent).toContain('8 + 5 → 10 + 3');
    vi.advanceTimersByTime(20_000);
    fixture.detectChanges();
    expect(status(fixture)).not.toBe(en.cold);
    coach.querySelector<HTMLButtonElement>('.button.primary')!.click();
    fixture.detectChanges();
    expect(element(fixture).querySelector('app-gondola-coach')).toBeNull();
    vi.advanceTimersByTime(11_000);
    fixture.detectChanges();
    expect(status(fixture)).toBe(en.cold);
  });

  it('stops guiding after three cabins, until the child waits', () => {
    localStorage.setItem('feenland.gondola-guided.v1', '3');
    const fixture = setup('gondola-1');
    start(fixture);
    expect(element(fixture).querySelector('.split-zone.is-guided')).toBeNull();
    vi.advanceTimersByTime(6500);
    fixture.detectChanges();
    expect(element(fixture).querySelector('.split-zone.is-guided')).not.toBeNull();
  });

  it('speaks German', () => {
    localStorage.setItem('feenland.locale', 'de');
    const fixture = setup('gondola-5');
    expect(element(fixture).textContent).toContain('Die Bergbahn');
    start(fixture);
    useItem(fixture, { kind: 'sub', a: 13, b: 5 });
    expect(element(fixture).querySelector('.sum')!.textContent).toContain('13 − 5 =');
    tap(fixture, 4);
    expect(status(fixture)).toBe(gondolaTranslations.de.tooManySub);
  });
});
