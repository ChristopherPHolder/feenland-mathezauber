import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { CompletionService } from '../../core/completion';
import { locales } from '../../core/messages';
import { ProgressService } from '../../core/progress';
import { HatcheryStore } from '../hatchery/hatchery-store';
import { BLOOM, FADE_OUT, FIZZLE, FireworkFrame, RISE, SHOW } from './firework-frame';
import { FINALE, Pattern, ROUND_LENGTH, signature } from './firework-levels';
import { fireworkTranslations } from './firework-messages';
import { FireworkScores } from './firework-scores';
import { Fireworks } from './fireworks';

const en = fireworkTranslations.en;

interface Internals {
  pattern(): Pattern;
  frame(): FireworkFrame;
  round: WritableSignal<{ index: number; score: number; phase: string; firstLooks: number }>;
}

function setup(id: string) {
  TestBed.configureTestingModule({
    imports: [Fireworks],
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id })) } },
    ],
  });
  const fixture = TestBed.createComponent(Fireworks);
  fixture.detectChanges();
  return fixture;
}

const element = (fixture: ComponentFixture<Fireworks>) => fixture.nativeElement as HTMLElement;
const internals = (fixture: ComponentFixture<Fireworks>) =>
  fixture.componentInstance as unknown as Internals;

function tick(fixture: ComponentFixture<Fireworks>, seconds: number) {
  vi.advanceTimersByTime(Math.round(seconds * 1000));
  fixture.detectChanges();
}

function start(fixture: ComponentFixture<Fireworks>) {
  element(fixture).querySelector<HTMLButtonElement>('.start-dock button')!.click();
  fixture.detectChanges();
}

/** Lets the rocket rise and the burst glow, fade and go, so the pad waits. */
function watch(fixture: ComponentFixture<Fireworks>) {
  tick(fixture, RISE + 0.01);
  tick(fixture, internals(fixture).frame().look + 0.01);
  tick(fixture, FADE_OUT + 0.01);
}

function key(fixture: ComponentFixture<Fireworks>, n: number) {
  return [...element(fixture).querySelectorAll<HTMLButtonElement>('.pad .key')].find(
    (button) => button.textContent!.trim() === String(n),
  )!;
}

function tap(fixture: ComponentFixture<Fireworks>, n: number) {
  key(fixture, n).click();
  fixture.detectChanges();
}

function status(fixture: ComponentFixture<Fireworks>) {
  return element(fixture).querySelector('.status')!.textContent!.replace(/\s+/g, ' ').trim();
}

function skip(fixture: ComponentFixture<Fireworks>) {
  element(fixture).querySelector<HTMLButtonElement>('.ways .next')!.click();
  fixture.detectChanges();
}

describe('the firework show', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    sessionStorage.clear();
    document.documentElement.classList.remove('calm-motion');
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
    document.documentElement.classList.remove('calm-motion');
  });

  it('teaches the trick, offers three look paces and the firework book', () => {
    const fixture = setup('fireworks-3');
    const text = element(fixture).textContent!;
    expect(text).toContain(en.trick3);
    expect(text).toContain('Level 3 of 12');
    expect(element(fixture).querySelectorAll('.level-pill')).toHaveLength(12);
    expect(element(fixture).querySelectorAll('.pace-choice')).toHaveLength(3);
    expect(element(fixture).querySelectorAll('.book li')).toHaveLength(12);
    expect(text).toContain(en.paceHelp);
  });

  it('launches, holds the look, then waits for an answer as long as it takes', () => {
    const fixture = setup('fireworks-1');
    start(fixture);
    expect(TestBed.inject(ProgressService).progress().explored).toContain('numbers');
    expect(internals(fixture).frame().phase).toBe('launch');
    expect(key(fixture, 1).closest('fieldset')!.disabled).toBe(true);
    tick(fixture, RISE + 0.01);
    expect(internals(fixture).frame().phase).toBe('look');
    expect(key(fixture, 1).closest('fieldset')!.disabled).toBe(false);
    tick(fixture, internals(fixture).frame().look + FADE_OUT + 0.1);
    expect(internals(fixture).frame().phase).toBe('gone');
    expect(status(fixture)).toContain(en.ask);
    // A whole minute later the pad still waits.
    tick(fixture, 60);
    expect(key(fixture, 1).closest('fieldset')!.disabled).toBe(false);
    const warm = vi.spyOn(TestBed.inject(HatcheryStore), 'warm');
    tap(fixture, internals(fixture).pattern().answer);
    expect(internals(fixture).frame().phase).toBe('bloom');
    expect(internals(fixture).frame().outlines).toBe(true);
    expect(warm).toHaveBeenCalledTimes(1);
    expect(status(fixture)).toContain('Yes!');
    expect(element(fixture).querySelector('.ways legend')!.textContent).toContain(en.howTitle);
  });

  it('fizzles gently on a miss, re-bursts the same pattern, and helps by structure', () => {
    const fixture = setup('fireworks-4');
    start(fixture);
    watch(fixture);
    const before = signature(internals(fixture).pattern());
    const answer = internals(fixture).pattern().answer;
    const wrong = answer === 10 ? 3 : answer + 2 > 10 ? answer - 3 : answer + 2;
    tap(fixture, wrong);
    expect(internals(fixture).frame().phase).toBe('fizzle');
    expect(status(fixture)).toContain(en.lookAgain);
    expect(internals(fixture).frame().outlines).toBe(false);
    tick(fixture, FIZZLE + 0.01);
    expect(internals(fixture).frame().phase).toBe('look');
    expect(signature(internals(fixture).pattern())).toBe(before);
    tick(fixture, internals(fixture).frame().look + FADE_OUT + 0.1);
    tap(fixture, wrong);
    expect(status(fixture)).toContain(en.hintFive);
    tick(fixture, FIZZLE + 0.01);
    // The second re-burst shows the group outlines.
    expect(internals(fixture).frame().outlines).toBe(true);
    expect(element(fixture).querySelectorAll('app-firework-sky rect.group').length).toBeGreaterThan(
      0,
    );
    tick(fixture, internals(fixture).frame().look + FADE_OUT + 0.1);
    tap(fixture, answer);
    // Not a first look, so no first-look bonus.
    expect(internals(fixture).round().score).toBe(10);
  });

  it('never puts a number in Flick’s help, in any language', () => {
    const hints = [
      'lookAgain',
      'hintDice',
      'hintSmall',
      'hintFive',
      'hintEmpty',
      'hintTwo',
      'hintTen',
      'hintMirror',
      'hintDouble',
      'hintTens',
      'nearMore',
      'nearLess',
    ] as const;
    for (const locale of locales)
      for (const hint of hints) expect(fireworkTranslations[locale][hint]).not.toMatch(/\d/);
  });

  it('peeks once per firework, which costs only the first-look bonus', () => {
    localStorage.setItem('feenland.firework-show.v1', JSON.stringify({ version: 1, pace: 'glow' }));
    const fixture = setup('fireworks-1');
    start(fixture);
    tick(fixture, RISE + 0.01);
    const peek = () => element(fixture).querySelector<HTMLButtonElement>('.peek')!;
    expect(peek().disabled).toBe(true);
    tick(fixture, internals(fixture).frame().look + FADE_OUT + 0.1);
    expect(peek().disabled).toBe(false);
    const bursts = internals(fixture).frame().bursts;
    peek().click();
    fixture.detectChanges();
    expect(internals(fixture).frame().bursts).toBe(bursts + 1);
    expect(internals(fixture).frame().phase).toBe('look');
    tick(fixture, internals(fixture).frame().look + FADE_OUT + 0.1);
    expect(peek().disabled).toBe(true);
    tap(fixture, internals(fixture).pattern().answer);
    expect(internals(fixture).round().score).toBe(10);
  });

  it('keeps the first-look bonus after a peek on the gentle glow', () => {
    const fixture = setup('fireworks-1');
    start(fixture);
    watch(fixture);
    element(fixture).querySelector<HTMLButtonElement>('.peek')!.click();
    fixture.detectChanges();
    tap(fixture, internals(fixture).pattern().answer);
    expect(internals(fixture).round().score).toBe(20);
  });

  it('pays spotter points for any honest answer to "how did you see it?"', () => {
    const fixture = setup('fireworks-3');
    start(fixture);
    watch(fixture);
    tap(fixture, internals(fixture).pattern().answer);
    const ways = [...element(fixture).querySelectorAll<HTMLButtonElement>('.ways .way')];
    expect(ways.at(-1)!.textContent!.trim()).toBe(en.wayCounted);
    ways.at(-1)!.click();
    fixture.detectChanges();
    expect(internals(fixture).round().score).toBe(25);
    expect(internals(fixture).round().index).toBe(1);
  });

  it('answers from the keyboard and peeks with P', () => {
    const fixture = setup('fireworks-1');
    start(fixture);
    watch(fixture);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'p' }));
    fixture.detectChanges();
    expect(internals(fixture).frame().peeks).toBe(1);
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: String(internals(fixture).pattern().answer) }),
    );
    fixture.detectChanges();
    expect(internals(fixture).frame().phase).toBe('bloom');
  });

  it('takes two digits on a 1–20 pad', () => {
    const fixture = setup('fireworks-7');
    start(fixture);
    watch(fixture);
    const answer = internals(fixture).pattern().answer;
    expect(answer).toBeGreaterThan(10);
    for (const digit of String(answer))
      document.dispatchEvent(new KeyboardEvent('keydown', { key: digit }));
    fixture.detectChanges();
    expect(internals(fixture).frame().phase).toBe('bloom');
  });

  it('skips the rocket rise under calm motion', () => {
    document.documentElement.classList.add('calm-motion');
    const fixture = setup('fireworks-2');
    start(fixture);
    expect(internals(fixture).frame().phase).toBe('look');
    expect(internals(fixture).frame().launches).toBe(0);
  });

  it('shows how to play with a film instead of paragraphs', () => {
    const fixture = setup('fireworks-1');
    const film = element(fixture).querySelector('app-firework-demo');
    expect(film).not.toBeNull();
    expect(film!.querySelectorAll('.cell.lit')).toHaveLength(7);
    expect(element(fixture).querySelector('.intro .sr-only')).not.toBeNull();
  });

  it('opens the film from ? and glows the burst again afterwards, at no cost', () => {
    const fixture = setup('fireworks-1');
    start(fixture);
    tick(fixture, RISE + 0.5);
    const bursts = internals(fixture).frame().bursts;
    element(fixture).querySelector<HTMLButtonElement>('.hud .help')!.click();
    fixture.detectChanges();
    expect(element(fixture).querySelector('app-firework-coach')).not.toBeNull();
    // The show waits while the film is open.
    tick(fixture, 20);
    expect(internals(fixture).frame().phase).toBe('look');
    element(fixture)
      .querySelector<HTMLButtonElement>('app-firework-coach .button.primary')!
      .click();
    fixture.detectChanges();
    expect(element(fixture).querySelector('app-firework-coach')).toBeNull();
    expect(internals(fixture).frame().bursts).toBe(bursts + 1);
    tap(fixture, internals(fixture).pattern().answer);
    expect(internals(fixture).round().score).toBe(20);
  });

  it('shows what to tap next on the first fireworks, never one key', () => {
    const fixture = setup('fireworks-1');
    start(fixture);
    watch(fixture);
    const pad = element(fixture).querySelector('.pad')!;
    expect(pad.classList).toContain('is-guided');
    expect(element(fixture).querySelectorAll('.key.is-guided')).toHaveLength(0);
    tap(fixture, internals(fixture).pattern().answer);
    expect(element(fixture).querySelector('.next')!.classList).toContain('is-guided');
  });

  it('stops guiding after three fireworks, until the child waits', () => {
    localStorage.setItem('feenland.firework-guided.v1', '3');
    const fixture = setup('fireworks-1');
    start(fixture);
    watch(fixture);
    expect(element(fixture).querySelector('.pad')!.classList).not.toContain('is-guided');
    tick(fixture, 6.1);
    expect(element(fixture).querySelector('.pad')!.classList).toContain('is-guided');
  });

  it('plays twelve fireworks and a grand finale, then the show, and records three stars', () => {
    const fixture = setup('fireworks-6');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    start(fixture);
    for (let index = 0; index < ROUND_LENGTH; index++) {
      watch(fixture);
      tap(fixture, internals(fixture).pattern().answer);
      skip(fixture);
    }
    expect(internals(fixture).round().index).toBe(FINALE);
    expect(element(fixture).querySelector('.banner')!.textContent).toContain(en.finaleBanner);
    tick(fixture, 2);
    watch(fixture);
    tap(fixture, internals(fixture).pattern().answer);
    tick(fixture, BLOOM + 0.01);
    expect(internals(fixture).frame().phase).toBe('show');
    tick(fixture, SHOW + 0.01);
    const outcome = element(fixture).querySelector('.outcome')!;
    expect(outcome.textContent).toContain(en.perfect);
    expect(outcome.querySelectorAll('.star.won')).toHaveLength(3);
    expect(TestBed.inject(CompletionService).result()).toMatchObject({
      levelId: 'fireworks-6',
      completed: true,
      mastered: true,
      stars: 3,
    });
    expect(TestBed.inject(FireworkScores).book()).toContain('clover');
    expect(TestBed.inject(FireworkScores).best()['fireworks-6']).toBeGreaterThan(0);
    [...outcome.querySelectorAll<HTMLButtonElement>('button')]
      .find((b) => b.textContent!.includes(en.celebrate))!
      .click();
    expect(navigate).toHaveBeenCalledWith(['/complete', 'fireworks-6']);
  });
});
