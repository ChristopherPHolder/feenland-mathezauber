import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { CompletionService } from '../../core/completion';
import { HatcheryStore } from '../hatchery/hatchery-store';
import { Duel } from './duel';
import { DragonDuel } from './dragon-duel';
import { duelTranslations } from './duel-messages';

const en = duelTranslations.en;

interface Internals {
  duel: WritableSignal<Duel>;
}

function setup(id = 'dragon-duel-1') {
  TestBed.configureTestingModule({
    imports: [DragonDuel],
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id })) } },
    ],
  });
  const fixture = TestBed.createComponent(DragonDuel);
  fixture.detectChanges();
  return fixture;
}

const el = (fixture: ComponentFixture<DragonDuel>) => fixture.nativeElement as HTMLElement;
const duel = (fixture: ComponentFixture<DragonDuel>) =>
  (fixture.componentInstance as unknown as Internals).duel;

function start(fixture: ComponentFixture<DragonDuel>) {
  el(fixture).querySelector<HTMLButtonElement>('.start-dock button')!.click();
  fixture.detectChanges();
}

function answers(fixture: ComponentFixture<DragonDuel>) {
  return [...el(fixture).querySelectorAll<HTMLButtonElement>('button.answer')];
}

function tap(fixture: ComponentFixture<DragonDuel>, right: boolean) {
  const question = duel(fixture)().question;
  const target = answers(fixture).find((button) =>
    right
      ? button.textContent!.trim() === String(question.answer)
      : button.textContent!.trim() !== String(question.answer) && !button.disabled,
  )!;
  target.click();
  fixture.detectChanges();
  return target;
}

describe('Dragon Duels', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('opens on the intro with the sprite, its weak spot, a guest dragon and the paces', () => {
    const fixture = setup('dragon-duel-2');
    const text = el(fixture).textContent!;
    expect(text).toContain('Puddle Pixie');
    expect(text).toContain('Weak spot: leaf');
    expect(text).toContain(en.guest.replace('{name}', 'Ember'));
    expect(el(fixture).querySelectorAll('.level-pill')).toHaveLength(8);
    expect(el(fixture).querySelector('[aria-current="page"]')!.textContent!.trim()).toBe('2');
    expect(el(fixture).querySelectorAll('input[name="duel-pace"]')).toHaveLength(4);
    expect(el(fixture).querySelector('app-duel-demo')).not.toBeNull();
  });

  it('lets the child pick any hatched dragon and marks the weak-spot ones', () => {
    localStorage.setItem(
      'feenland.hatchery',
      JSON.stringify({
        version: 1,
        egg: 'fern',
        warmth: 0,
        hatched: ['ember', 'splash'],
        hatches: 2,
        favorite: 'ember',
        answers: 40,
      }),
    );
    const fixture = setup('dragon-duel-1');
    const picks = [...el(fixture).querySelectorAll<HTMLButtonElement>('.team-pick')];
    expect(picks).toHaveLength(2);
    expect(picks[0].getAttribute('aria-pressed')).toBe('true');
    expect(picks[1].querySelector('.weak-mark')).not.toBeNull();
    picks[1].click();
    fixture.detectChanges();
    expect(picks[1].getAttribute('aria-pressed')).toBe('true');
    start(fixture);
    expect(duel(fixture)().element).toBe('water');
  });

  it('attacks on a right answer, warms the egg and asks a new sum after the attack', () => {
    const fixture = setup();
    const hatchery = TestBed.inject(HatcheryStore);
    start(fixture);
    expect(answers(fixture)).toHaveLength(4);
    const before = duel(fixture)();
    const warmth = hatchery.hatchery().warmth;
    const button = tap(fixture, true);
    expect(duel(fixture)().energy).toBeLessThan(before.energy);
    expect(hatchery.hatchery().warmth).toBe(warmth + 1);
    expect(button.classList).toContain('is-right');
    expect(el(fixture).querySelector('[role="status"]')!.textContent).toContain('Fire ball!');
    vi.advanceTimersByTime(800);
    fixture.detectChanges();
    expect(el(fixture).querySelector('.answer.is-right')).toBeNull();
  });

  it('strikes out a wrong answer, keeps the sum and only gives a tip after two slips', () => {
    const fixture = setup();
    start(fixture);
    const question = duel(fixture)().question;
    const first = tap(fixture, false);
    expect(first.disabled).toBe(true);
    expect(duel(fixture)().question).toBe(question);
    expect(el(fixture).querySelector('.tip')).toBeNull();
    tap(fixture, false);
    const tip = el(fixture).querySelector('.tip')!;
    expect(tip.textContent).toContain(en.tip1);
    // The tip names a way to think, never the answer.
    expect(tip.textContent).not.toMatch(/\d/);
  });

  it('charges the sprite while the child thinks and zaps a heart when it is full', () => {
    localStorage.setItem('feenland.duel-pace.v1', 'fast');
    const fixture = setup();
    start(fixture);
    expect(el(fixture).querySelector('.charge')).not.toBeNull();
    vi.advanceTimersByTime(9_500);
    fixture.detectChanges();
    expect(duel(fixture)().hearts).toBe(2);
    expect(el(fixture).querySelectorAll('.hearts .is-empty')).toHaveLength(1);
  });

  it('never charges with no zaps', () => {
    const fixture = setup();
    start(fixture);
    expect(el(fixture).querySelector('.charge')).toBeNull();
    vi.advanceTimersByTime(60_000);
    expect(duel(fixture)().hearts).toBe(3);
  });

  it('sends the dragon for a nap after three zaps and offers another try', () => {
    localStorage.setItem('feenland.duel-pace.v1', 'fast');
    const fixture = setup();
    start(fixture);
    vi.advanceTimersByTime(30_000);
    fixture.detectChanges();
    expect(el(fixture).querySelector('.outcome h2')!.textContent).toContain('needs a nap');
    el(fixture).querySelector<HTMLButtonElement>('.outcome .button.primary')!.click();
    fixture.detectChanges();
    expect(duel(fixture)().hearts).toBe(3);
    expect(answers(fixture)).toHaveLength(4);
  });

  it('wins with right answers, records the stars and gives the egg a bonus', () => {
    const fixture = setup();
    const hatchery = TestBed.inject(HatcheryStore);
    const completion = TestBed.inject(CompletionService);
    start(fixture);
    for (let turn = 0; turn < 20 && duel(fixture)().phase === 'fighting'; turn++) {
      tap(fixture, true);
      vi.advanceTimersByTime(800);
      fixture.detectChanges();
    }
    expect(duel(fixture)().phase).toBe('won');
    expect(el(fixture).querySelector('ui-reward-burst')).not.toBeNull();
    vi.advanceTimersByTime(3000);
    fixture.detectChanges();
    expect(el(fixture).querySelector('.outcome h2')!.textContent).toContain(en.perfectTitle);
    expect(completion.result()).toMatchObject({ levelId: 'dragon-duel-1', stars: 3 });
    expect(hatchery.hatchery().answers).toBe(duel(fixture)().answered + 5);
    expect(el(fixture).querySelector('.outcome a.button')!.getAttribute('href')).toBe(
      '/adventure/dragon-duel-2',
    );
  });

  it('pauses the charge while the how-to-duel film is open', () => {
    localStorage.setItem('feenland.duel-pace.v1', 'fast');
    const fixture = setup();
    start(fixture);
    el(fixture).querySelector<HTMLButtonElement>('.help')!.click();
    fixture.detectChanges();
    expect(el(fixture).querySelector('ui-coach-dialog app-duel-demo')).not.toBeNull();
    vi.advanceTimersByTime(30_000);
    expect(duel(fixture)().charge).toBe(0);
    expect(duel(fixture)().hearts).toBe(3);
  });

  it('shows the flat arena where WebGL is missing', () => {
    const fixture = setup();
    start(fixture);
    expect(el(fixture).querySelector('app-duel-arena')).not.toBeNull();
  });
});
