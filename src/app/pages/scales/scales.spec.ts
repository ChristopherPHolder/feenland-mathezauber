import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { LocaleService } from '../../core/locale';
import { HatcheryStore } from '../hatchery/hatchery-store';
import { Scales } from './scales';
import type { Task } from './scales-levels';
import { startLine, type LineState } from './scales-line';
import { fewestWeights } from './scales-math';
import { scalesTranslations } from './scales-messages';
import { ScalesScores } from './scales-scores';

const en = scalesTranslations.en;

interface Internals {
  round: WritableSignal<{ tasks: readonly Task[]; index: number; line: LineState }>;
}

function setup(id: string) {
  TestBed.configureTestingModule({
    imports: [Scales],
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id })) } },
    ],
  });
  const fixture = TestBed.createComponent(Scales);
  fixture.detectChanges();
  return fixture;
}

const el = (fixture: ComponentFixture<Scales>) => fixture.nativeElement as HTMLElement;
const internals = (fixture: ComponentFixture<Scales>) =>
  fixture.componentInstance as unknown as Internals;
const task = (fixture: ComponentFixture<Scales>) => internals(fixture).round().line.task;

function start(fixture: ComponentFixture<Scales>) {
  el(fixture).querySelector<HTMLButtonElement>('.start-dock button')!.click();
  fixture.detectChanges();
}

/** Puts a known task on the current line. */
function useTask(fixture: ComponentFixture<Scales>, next: Task) {
  internals(fixture).round.update((round) => ({
    ...round,
    tasks: round.tasks.map((item, index) => (index === round.index ? next : item)),
    line: startLine(next),
  }));
  fixture.detectChanges();
}

function click(fixture: ComponentFixture<Scales>, selector: string, text?: string) {
  const buttons = [...el(fixture).querySelectorAll<HTMLButtonElement>(selector)];
  const button = text ? buttons.find((b) => b.textContent!.trim().startsWith(text)) : buttons[0];
  if (!button) throw new Error(`No ${selector} ${text ?? ''}`);
  button.click();
  fixture.detectChanges();
}

const status = (fixture: ComponentFixture<Scales>) =>
  el(fixture).querySelector('.status')!.textContent!.trim();
const hint = (fixture: ComponentFixture<Scales>) =>
  el(fixture).querySelector('.hint')?.textContent?.trim() ?? '';

/** Finishes whatever line is up, right first time. */
function solve(fixture: ComponentFixture<Scales>) {
  const current = task(fixture);
  switch (current.kind) {
    case 'compare': {
      const heavier = current.left.amount > current.right.amount ? 0 : 1;
      if (current.ask === 'claim') {
        const claimed = current.claim === 'left' ? 0 : 1;
        click(fixture, '.pick', claimed === heavier ? en.yes : en.no);
      } else {
        const want = current.ask === 'heavier' ? heavier : 1 - heavier;
        el(fixture).querySelectorAll<HTMLButtonElement>('.pick')[want].click();
        fixture.detectChanges();
      }
      break;
    }
    case 'balance':
      for (const size of fewestWeights(current.need, current.sizes)!) {
        const index = current.sizes.indexOf(size);
        el(fixture).querySelectorAll<HTMLButtonElement>('.weight-button')[index].click();
        fixture.detectChanges();
      }
      click(fixture, '.weigh');
      break;
    case 'pour':
      for (const jug of fewestWeights(current.target, current.jugs)!) {
        el(fixture)
          .querySelectorAll<HTMLButtonElement>('.jug-button')
          [current.jugs.indexOf(jug)].click();
        fixture.detectChanges();
      }
      click(fixture, '.done-pour');
      break;
    default: {
      const answer = current.kind === 'dial' ? current.amount : current.answer;
      for (const digit of String(answer)) click(fixture, '.pad-key', digit);
      click(fixture, '.pad-key.check');
    }
  }
}

const pumpkin: Task = {
  kind: 'balance',
  unit: 'kg',
  left: [{ kind: 'item', item: 'pumpkin', amount: 7 }],
  right: [],
  side: 'right',
  sizes: [10, 5, 2, 1],
  need: 7,
  item: 'pumpkin',
  equation: false,
};

describe('The Giant’s Scales', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('opens on the level card with the film, the feast table and the timer choice', () => {
    const fixture = setup('scales-3');
    const page = el(fixture);
    expect(page.querySelectorAll('.level-pill')).toHaveLength(12);
    expect(page.querySelector('.level-pill[aria-current="page"]')!.textContent!.trim()).toBe('3');
    expect(page.querySelector('app-scales-demo')).not.toBeNull();
    expect(page.querySelectorAll('.plate')).toHaveLength(12);
    expect(page.querySelectorAll('.pace-choice input')).toHaveLength(4);
  });

  it('balances a pumpkin with weights and cooks it, with the fewest-weights bonus', () => {
    const fixture = setup('scales-3');
    start(fixture);
    useTask(fixture, pumpkin);
    expect(el(fixture).querySelector('.recipe-chip')!.textContent).toContain('7');
    click(fixture, '.weight-button', '5');
    click(fixture, '.weight-button', '2');
    expect(status(fixture)).toBe(en.statusHeld);
    click(fixture, '.weigh');
    expect(status(fixture)).toBe(en.statusCookedFirst);
    expect(el(fixture).querySelector('ui-reward-burst')!.textContent).toContain(en.fewestBonus);
  });

  it('tips the beam after a wrong weigh and says which side, never how much', () => {
    const fixture = setup('scales-3');
    start(fixture);
    useTask(fixture, pumpkin);
    click(fixture, '.weight-button', '5');
    click(fixture, '.weigh');
    expect(hint(fixture)).toContain(en.helpLeftDown);
    expect(hint(fixture)).not.toMatch(/\d/);
    click(fixture, '.pan-chip');
    click(fixture, '.weight-button', '10');
    click(fixture, '.weigh');
    expect(hint(fixture)).toContain(en.helpRightDown);
  });

  it('reads a dial and asks to count the marks after a wrong number', () => {
    const fixture = setup('scales-4');
    start(fixture);
    useTask(fixture, {
      kind: 'dial',
      unit: 'kg',
      dial: { max: 10, step: 1, label: 5 },
      amount: 3,
      item: 'melon',
    });
    click(fixture, '.pad-key', '4');
    click(fixture, '.pad-key.check');
    expect(hint(fixture)).toContain(en.helpMisread);
    expect(hint(fixture)).not.toContain('3');
    click(fixture, '.pad-key', '3');
    click(fixture, '.pad-key.check');
    expect(status(fixture)).toBe(en.statusCooked);
  });

  it('writes the equation with a gap and fills it once the scale is level', () => {
    const fixture = setup('scales-7');
    start(fixture);
    useTask(fixture, {
      kind: 'balance',
      unit: 'kg',
      left: [{ kind: 'weight', amount: 7 }],
      right: [
        { kind: 'weight', amount: 4 },
        { kind: 'weight', amount: 5 },
      ],
      side: 'left',
      sizes: [5, 2, 1],
      need: 2,
      item: 'salt',
      equation: true,
    });
    expect(el(fixture).querySelector('.equation')!.textContent).toContain('7 + □ = 4 + 5');
    click(fixture, '.weight-button', '2');
    click(fixture, '.weigh');
    expect(el(fixture).querySelector('.equation')!.textContent).toContain('7 + 2 = 4 + 5');
  });

  it('swaps a wrong mystery box for a weight and lets the tilt answer', () => {
    const fixture = setup('scales-8');
    start(fixture);
    useTask(fixture, {
      kind: 'missing',
      unit: 'kg',
      left: [
        { kind: 'mystery', amount: 9 },
        { kind: 'weight', amount: 6 },
      ],
      right: [{ kind: 'weight', amount: 15 }],
      answer: 9,
    });
    expect(el(fixture).querySelector('.equation')!.textContent).toContain('□ + 6 = 15');
    click(fixture, '.pad-key', '5');
    click(fixture, '.pad-key.check');
    expect(hint(fixture)).toContain(en.helpRightDown);
    click(fixture, '.pad-key', '9');
    click(fixture, '.pad-key.check');
    expect(el(fixture).querySelector('.equation')!.textContent).toContain('9 + 6 = 15');
  });

  it('pours to the line and says when it went over', () => {
    const fixture = setup('scales-10');
    start(fixture);
    useTask(fixture, {
      kind: 'pour',
      unit: 'l',
      target: 1500,
      jugs: [1000, 500],
      capacity: 3000,
      item: 'milk',
    });
    click(fixture, '.jug-button');
    click(fixture, '.jug-button');
    click(fixture, '.done-pour');
    expect(hint(fixture)).toContain(en.helpOver);
    click(fixture, '.pour-row .button.secondary');
    click(fixture, '.jug-button');
    el(fixture).querySelectorAll<HTMLButtonElement>('.jug-button')[1].click();
    fixture.detectChanges();
    click(fixture, '.done-pour');
    expect(status(fixture)).toBe(en.statusCooked);
  });

  it('writes litres with a decimal comma in German', () => {
    const fixture = setup('scales-10');
    TestBed.inject(LocaleService).select('de');
    start(fixture);
    useTask(fixture, {
      kind: 'pour',
      unit: 'l',
      target: 1500,
      jugs: [1000, 500],
      capacity: 3000,
      item: 'milk',
    });
    expect(el(fixture).querySelector('.recipe-chip')!.textContent).toContain('1,5 l');
    expect(el(fixture).querySelectorAll('.jug-button')[1].textContent).toContain('0,5 l');
    TestBed.inject(LocaleService).select('en');
  });

  it('asks which is heavier and hints with the rule after a wrong pick', () => {
    const fixture = setup('scales-1');
    start(fixture);
    useTask(fixture, {
      kind: 'compare',
      unit: 'kg',
      left: { kind: 'item', item: 'pillow', amount: 1 },
      right: { kind: 'item', item: 'rock', amount: 7 },
      ask: 'heavier',
      claim: 'left',
      labelled: false,
    });
    expect(status(fixture)).toBe(en.askHeavier);
    click(fixture, '.pick', en.pillow);
    expect(hint(fixture)).toContain(en.helpHeavier);
    click(fixture, '.pick', en.rock);
    expect(status(fixture)).toBe(en.statusCooked);
  });

  it('cooks a whole round, puts the dish on the feast table and warms the egg', () => {
    const fixture = setup('scales-5');
    const warm = vi.spyOn(TestBed.inject(HatcheryStore), 'warm');
    start(fixture);
    for (let line = 0; line < 7; line++) {
      solve(fixture);
      click(fixture, '.after-cook .button');
    }
    const page = el(fixture);
    expect(page.querySelector('.outcome')).not.toBeNull();
    expect(page.querySelectorAll('.recipe-lines li')).toHaveLength(7);
    expect(page.querySelector('.stars')!.getAttribute('aria-label')).toBe('3 of 3 stars');
    expect(warm).toHaveBeenCalledTimes(7);
    expect(TestBed.inject(ScalesScores).table()[4]).toBe(true);
    expect(page.querySelector('.dish-line')!.textContent).toContain(en.dish5);
  });

  it('runs the soup timer and lets it bubble over without stopping the line', () => {
    localStorage.setItem('feenland.scales-pace.v1', 'fast');
    const fixture = setup('scales-3');
    start(fixture);
    useTask(fixture, pumpkin);
    expect(el(fixture).querySelector('.soup-chip')).not.toBeNull();
    vi.advanceTimersByTime(40_000);
    fixture.detectChanges();
    expect(status(fixture)).toBe(en.bubbled);
    solve(fixture);
    expect(el(fixture).querySelector('ui-reward-burst')!.textContent).not.toContain(en.inTimeBonus);
  });
});
