import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ProgressService } from '../../core/progress';
import { HatcheryStore } from '../hatchery/hatchery-store';
import { potionTranslations } from './potion-messages';
import { PotionOp, PotionPuzzle, solve } from './potion-puzzles';
import { PotionScores } from './potion-scores';
import { Potions } from './potions';

const en = potionTranslations.en;

interface Internals {
  potion(): PotionPuzzle;
  round: WritableSignal<{
    potions: readonly PotionPuzzle[];
    bottles: readonly { id: number; value: number }[];
    nextId: number;
  }>;
}

function setup(id: string) {
  TestBed.configureTestingModule({
    imports: [Potions],
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id })) } },
    ],
  });
  const fixture = TestBed.createComponent(Potions);
  fixture.detectChanges();
  return fixture;
}

function element(fixture: ComponentFixture<Potions>) {
  return fixture.nativeElement as HTMLElement;
}

function start(fixture: ComponentFixture<Potions>) {
  element(fixture).querySelector<HTMLButtonElement>('.start-dock button')!.click();
  fixture.detectChanges();
}

function internals(fixture: ComponentFixture<Potions>) {
  return fixture.componentInstance as unknown as Internals;
}

/** Puts a known potion first in the round. */
function usePotion(fixture: ComponentFixture<Potions>, values: number[], target: number) {
  const potion = { ...internals(fixture).potion(), values, target };
  internals(fixture).round.update((round) => ({
    ...round,
    potions: [potion, ...round.potions.slice(1)],
    bottles: values.map((value, index) => ({ id: 100 + index, value })),
  }));
  fixture.detectChanges();
}

function bottles(fixture: ComponentFixture<Potions>) {
  return [...element(fixture).querySelectorAll<HTMLButtonElement>('button.bottle')];
}

function bottle(fixture: ComponentFixture<Potions>, value: number, skipPicked = false) {
  return bottles(fixture).find(
    (button) =>
      button.textContent!.trim() === String(value) &&
      !(skipPicked && button.getAttribute('aria-pressed') === 'true'),
  )!;
}

function spell(fixture: ComponentFixture<Potions>, op: PotionOp) {
  return element(fixture).querySelector<HTMLButtonElement>(`.spell[data-op="${op}"]`)!;
}

function pour(fixture: ComponentFixture<Potions>, a: number, op: PotionOp, b: number) {
  bottle(fixture, a).click();
  fixture.detectChanges();
  spell(fixture, op).click();
  fixture.detectChanges();
  bottle(fixture, b, true).click();
  fixture.detectChanges();
}

/** Brews the current potion with the solver's recipe, one tap at a time. */
function brew(fixture: ComponentFixture<Potions>) {
  const potion = internals(fixture).potion();
  const values = internals(fixture)
    .round()
    .bottles.map((item) => item.value);
  for (const step of solve(values, potion.target, potion.ops, potion.max)!)
    pour(fixture, step.a, step.op, step.b);
}

function status(fixture: ComponentFixture<Potions>) {
  return element(fixture).querySelector('.status')!.textContent!;
}

/** The mix line under the spells, read as the child sees it: "8 + 5 = 13 19". */
function mixLine(fixture: ComponentFixture<Potions>) {
  return [...element(fixture).querySelectorAll('.mix-line > span')]
    .map((span) => span.textContent!.trim() || '_')
    .join(' ');
}

function guide(fixture: ComponentFixture<Potions>) {
  return element(fixture).querySelector('.controls')!.getAttribute('data-guide');
}

describe('the potion cauldron', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    sessionStorage.clear();
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it('teaches the trick, brews six potions and records three stars', () => {
    const fixture = setup('potion-4');
    expect(element(fixture).textContent).toContain(en.times);
    expect(element(fixture).textContent).toContain('Level 4 of 7');
    expect(element(fixture).querySelectorAll('.level-pill').length).toBe(7);
    const warm = vi.spyOn(TestBed.inject(HatcheryStore), 'warm');
    start(fixture);
    expect(TestBed.inject(ProgressService).progress().explored).toContain('tens');
    expect(
      [...element(fixture).querySelectorAll('.spell')].map((b) => b.textContent!.trim()),
    ).toEqual(['+', '−', '×']);
    for (let potion = 0; potion < 6; potion++) {
      brew(fixture);
      expect(status(fixture)).toContain(en.brewedPerfect);
      expect(status(fixture)).toContain(en.moon);
      element(fixture).querySelector<HTMLButtonElement>('.potion-actions .primary')!.click();
      fixture.detectChanges();
    }
    expect(element(fixture).querySelector('.outcome h2')!.textContent).toContain(en.perfectRound);
    expect(element(fixture).textContent).toContain('18 potion stars');
    expect(warm).toHaveBeenCalledTimes(6);
    const progress = TestBed.inject(ProgressService).progress();
    expect(progress.stars?.['potion-4']).toBe(3);
    expect(progress.mastered).toContain('potion-4');
    expect(TestBed.inject(PotionScores).best()['potion-4']).toBeGreaterThan(0);
  });

  it('walks the child through a mix on the mix line', () => {
    const fixture = setup('potion-2');
    start(fixture);
    usePotion(fixture, [8, 5, 3], 10);
    expect(status(fixture)).toContain(en.pickFirst);
    expect(mixLine(fixture)).toBe('_ _ _ 10');
    expect(spell(fixture, '+').closest('fieldset')!.disabled).toBe(true);
    bottle(fixture, 8).click();
    fixture.detectChanges();
    expect(bottle(fixture, 8).getAttribute('aria-pressed')).toBe('true');
    expect(status(fixture)).toContain('Now pick a spell for 8.');
    expect(mixLine(fixture)).toBe('8 _ _ 10');
    spell(fixture, '+').click();
    fixture.detectChanges();
    expect(status(fixture)).toContain('Which bottle goes in? 8 + …');
    expect(mixLine(fixture)).toBe('8 + _ 10');
    bottle(fixture, 5).click();
    fixture.detectChanges();
    expect(status(fixture)).toContain('8 + 5 makes 13.');
    expect(bottles(fixture).map((b) => b.textContent!.trim())).toEqual(['13', '3']);
    expect(mixLine(fixture)).toBe('8 + 5 = 13 10');
    bottle(fixture, 13).click();
    fixture.detectChanges();
    expect(mixLine(fixture)).toBe('13 _ _ 10');
    spell(fixture, '−').click();
    bottle(fixture, 3, true).click();
    fixture.detectChanges();
    expect(status(fixture)).toContain(en.brewedPerfect);
    expect(mixLine(fixture)).toBe('13 − 3 = 10 10');
    expect(element(fixture).querySelector('.target-chip.match')).not.toBeNull();
    expect(element(fixture).querySelector('.coins strong')!.textContent).toBe('40');
    const card = element(fixture).querySelector('app-potion-reward')!;
    expect(card.getAttribute('aria-hidden')).toBe('true');
    expect(card.querySelector('.cheer')!.textContent).toBe(en.rewardPerfect);
    expect(card.querySelectorAll('.star.won').length).toBe(3);
    expect(card.querySelector('.gain')!.textContent).toBe('+40 coins');
  });

  it('greys out bottles a spell cannot pour, and says why', () => {
    const fixture = setup('potion-6');
    start(fixture);
    usePotion(fixture, [12, 5, 3], 9);
    bottle(fixture, 12).click();
    fixture.detectChanges();
    spell(fixture, '÷').click();
    fixture.detectChanges();
    expect(bottle(fixture, 5).disabled).toBe(true);
    expect(bottle(fixture, 5).title).toBe('12 can’t be shared into 5 equal parts.');
    expect(bottle(fixture, 3).disabled).toBe(false);
    spell(fixture, '−').click();
    fixture.detectChanges();
    expect(bottle(fixture, 5).disabled).toBe(false);
    // Taking the spell back lets the child pick another bottle to start with.
    spell(fixture, '−').click();
    fixture.detectChanges();
    bottle(fixture, 3).click();
    fixture.detectChanges();
    expect(bottle(fixture, 3).getAttribute('aria-pressed')).toBe('true');
    spell(fixture, '−').click();
    fixture.detectChanges();
    expect(bottle(fixture, 5).title).toBe('Not enough in 3 to take 5 away.');
  });

  it('fizzes a wrong potion, pours it back, and whispers the trick after two fizzes', () => {
    const fixture = setup('potion-1');
    start(fixture);
    usePotion(fixture, [9, 4], 5);
    pour(fixture, 9, '+', 4);
    expect(status(fixture)).toContain('Fizz! That potion is 13, but the cauldron needs 5.');
    expect(mixLine(fixture)).toBe('9 + 4 = 13 5');
    expect(element(fixture).querySelector('.mix-line')!.getAttribute('data-outcome')).toBe(
      'fizzle',
    );
    expect(bottle(fixture, 9)).toBeUndefined();
    vi.advanceTimersByTime(2000);
    fixture.detectChanges();
    expect(bottles(fixture).map((b) => b.textContent!.trim())).toEqual(['9', '4']);
    expect(mixLine(fixture)).toBe('_ _ _ 5');
    expect(element(fixture).querySelector('.hint')).toBeNull();
    pour(fixture, 4, '+', 9);
    vi.advanceTimersByTime(2000);
    fixture.detectChanges();
    expect(element(fixture).querySelector('.hint')!.textContent).toContain(en.addTake);
    pour(fixture, 9, '−', 4);
    expect(status(fixture)).toContain(en.brewed);
    // One star for two fizzes: 10 coins and no moon drop.
    expect(element(fixture).querySelector('.coins strong')!.textContent).toBe('10');
  });

  it('undoes a mix for free, but the moon drop needs a brew without undo', () => {
    const fixture = setup('potion-2');
    start(fixture);
    usePotion(fixture, [8, 5, 3], 10);
    pour(fixture, 8, '−', 5);
    element(fixture).querySelector<HTMLButtonElement>('.undo')!.click();
    fixture.detectChanges();
    expect(bottles(fixture).map((b) => b.textContent!.trim())).toEqual(['8', '5', '3']);
    expect(mixLine(fixture)).toBe('_ _ _ 10');
    pour(fixture, 8, '+', 5);
    pour(fixture, 13, '−', 3);
    expect(status(fixture)).toContain(en.brewedPerfect);
    expect(status(fixture)).not.toContain(en.moon);
    expect(element(fixture).querySelector('.coins strong')!.textContent).toBe('30');
  });

  it('lets the sparkle fade when the hourglass runs out, without blocking the potion', () => {
    localStorage.setItem('feenland.potion-pace.v1', 'fast');
    const fixture = setup('potion-1');
    start(fixture);
    expect(element(fixture).querySelector('.hourglass')).not.toBeNull();
    vi.advanceTimersByTime(60_000);
    fixture.detectChanges();
    expect(status(fixture)).toContain(en.sandOut);
    brew(fixture);
    expect(element(fixture).querySelector('.potion-actions .primary')).not.toBeNull();
    expect(element(fixture).querySelector('.coins strong')!.textContent).toBe('40');
  });

  it('shows how to brew on the level card with made-up numbers', () => {
    const fixture = setup('potion-4');
    const demo = element(fixture).querySelector('app-potion-demo')!;
    expect(demo.textContent).toContain(en.demoSummary);
    expect([...demo.querySelectorAll('.spell')].map((s) => s.textContent!.trim())).toEqual([
      '+',
      '−',
      '×',
    ]);
    expect(element(fixture).querySelector('.trick-card')!.textContent).toContain(en.times);
  });

  it('bounces the buttons to tap next for the first potions, then only after a wait', () => {
    const fixture = setup('potion-1');
    start(fixture);
    usePotion(fixture, [9, 4], 5);
    expect(guide(fixture)).toBe('bottle');
    bottle(fixture, 9).click();
    fixture.detectChanges();
    expect(guide(fixture)).toBe('spell');
    spell(fixture, '−').click();
    fixture.detectChanges();
    expect(guide(fixture)).toBe('second');
    bottle(fixture, 4, true).click();
    fixture.detectChanges();
    expect(guide(fixture)).toBeNull();
    expect(localStorage.getItem('feenland.potion-guided.v1')).toBe('1');

    TestBed.resetTestingModule();
    localStorage.setItem('feenland.potion-guided.v1', '3');
    const later = setup('potion-1');
    start(later);
    expect(guide(later)).toBeNull();
    vi.advanceTimersByTime(6000);
    later.detectChanges();
    expect(guide(later)).toBe('bottle');
    bottles(later)[0].click();
    later.detectChanges();
    expect(guide(later)).toBeNull();
  });

  it('opens how to brew from the ? button and holds the hourglass meanwhile', () => {
    localStorage.setItem('feenland.potion-pace.v1', 'fast');
    const fixture = setup('potion-1');
    start(fixture);
    const help = element(fixture).querySelector<HTMLButtonElement>('.help')!;
    expect(help.getAttribute('aria-label')).toBe(en.help);
    help.click();
    fixture.detectChanges();
    const coach = element(fixture).querySelector('app-potion-coach')!;
    expect(coach.querySelector('h2')!.textContent).toBe(en.demoTitle);
    expect(guide(fixture)).toBeNull();
    vi.advanceTimersByTime(60_000);
    fixture.detectChanges();
    expect(status(fixture)).not.toContain(en.sandOut);
    // Bottles can't be poured from behind the coach.
    bottles(fixture)[0].click();
    fixture.detectChanges();
    expect(bottles(fixture)[0].getAttribute('aria-pressed')).toBe('false');
    coach.querySelector<HTMLButtonElement>('.button.primary')!.click();
    fixture.detectChanges();
    expect(element(fixture).querySelector('app-potion-coach')).toBeNull();
    vi.advanceTimersByTime(60_000);
    fixture.detectChanges();
    expect(status(fixture)).toContain(en.sandOut);
  });

  it('writes sharing as a colon in German', () => {
    localStorage.setItem('feenland.locale', 'de');
    const fixture = setup('potion-6');
    expect(element(fixture).querySelector('.example')!.textContent).toBe('12 : 3 + 2 → 6');
    start(fixture);
    expect(spell(fixture, '÷').textContent!.trim()).toBe(':');
    expect(spell(fixture, '÷').getAttribute('aria-label')).toBe('geteilt durch');
  });
});
