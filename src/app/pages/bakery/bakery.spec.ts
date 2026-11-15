import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { ProgressService } from '../../core/progress';
import { HatcheryStore } from '../hatchery/hatchery-store';
import { Bakery } from './bakery';
import { Fact } from './bakery-levels';
import { bakeryTranslations } from './bakery-messages';
import { BakeryScores } from './bakery-scores';

const en = bakeryTranslations.en;

interface Internals {
  round: WritableSignal<{ orders: readonly Fact[]; order: { fact: Fact } }>;
}

function setup(id: string) {
  TestBed.configureTestingModule({
    imports: [Bakery],
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id })) } },
    ],
  });
  const fixture = TestBed.createComponent(Bakery);
  fixture.detectChanges();
  return fixture;
}

const el = (fixture: ComponentFixture<Bakery>) => fixture.nativeElement as HTMLElement;

function start(fixture: ComponentFixture<Bakery>) {
  el(fixture).querySelector<HTMLButtonElement>('.start-dock button')!.click();
  fixture.detectChanges();
}

/** Puts a known tray first in the round. */
function useOrder(fixture: ComponentFixture<Bakery>, fact: Fact) {
  const component = fixture.componentInstance as unknown as Internals;
  component.round.update((round) => ({
    ...round,
    orders: [fact, ...round.orders.slice(1)],
    order: { ...round.order, fact },
  }));
  fixture.detectChanges();
}

function click(fixture: ComponentFixture<Bakery>, selector: string, text?: string) {
  const buttons = [...el(fixture).querySelectorAll<HTMLButtonElement>(selector)];
  const button = text ? buttons.find((b) => b.textContent!.trim() === text) : buttons[0];
  if (!button) throw new Error(`No ${selector} ${text ?? ''}`);
  button.click();
  fixture.detectChanges();
}

const status = (fixture: ComponentFixture<Bakery>) =>
  el(fixture).querySelector('.status')!.textContent!.trim();

function key(fixture: ComponentFixture<Bakery>, value: string, target?: Element) {
  (target ?? document).dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true }));
  fixture.detectChanges();
}

function typeTotal(fixture: ComponentFixture<Bakery>, total: number) {
  for (const digit of String(total)) click(fixture, '.pad-key', digit);
  click(fixture, '.pad-key.bake');
}

/** Names every piece by reading its fact off the chip. */
function namePieces(fixture: ComponentFixture<Bakery>) {
  for (let guard = 0; guard < 5; guard++) {
    const chip = el(fixture).querySelector('.piece-chip[aria-pressed="true"]:not([disabled])');
    if (!chip) return;
    const [, a, b] = /(\d+) × (\d+)/.exec(chip.textContent!)!;
    click(fixture, '.choice', String(Number(a) * Number(b)));
  }
}

describe('the fairy bakery', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    sessionStorage.clear();
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it('cuts a tray into facts the child knows, names the pieces and bakes the total', () => {
    const fixture = setup('bakery-4');
    expect(el(fixture).textContent).toContain(en.tip4);
    expect(el(fixture).querySelectorAll('.level-pill').length).toBe(12);
    const warm = vi.spyOn(TestBed.inject(HatcheryStore), 'warm');
    start(fixture);
    useOrder(fixture, { rows: 6, cols: 7 });
    expect(el(fixture).querySelector('.question')!.textContent).toContain('6 rows of 7');
    // The knife starts next to the glowing gap; move it down to row 5 with the arrows.
    const knife = el(fixture).querySelector('.knife-handle')!;
    for (let i = 0; i < 6; i++) key(fixture, 'ArrowDown', knife);
    expect(knife.getAttribute('aria-valuetext')).toBe('After row 5 of 6');
    click(fixture, '.cut-button');
    expect(status(fixture)).toContain('5 × 7 and 1 × 7');
    const labels = [...el(fixture).querySelectorAll('.piece-label')].map((l) => l.textContent);
    expect(labels).toEqual(['5 × 7', '1 × 7']);
    click(fixture, '.choice', '35');
    expect(status(fixture)).toBe('5 × 7 = 35. Yum!');
    click(fixture, '.choice', '7');
    expect(status(fixture)).toContain('Put the pieces together');
    typeTotal(fixture, 42);
    expect(status(fixture)).toBe(en.bakedFirst);
    expect(el(fixture).querySelector('.points strong')!.textContent).toBe('30');
    const card = el(fixture).querySelector('app-bakery-reward')!;
    expect(card.getAttribute('aria-hidden')).toBe('true');
    expect(card.textContent).toContain(en.trickBonus);
    expect(warm).toHaveBeenCalledTimes(1);
    const board = TestBed.inject(BakeryScores).board();
    expect(board[5 * 10 + 6]).toBe(2);
    expect(board[6 * 10 + 5]).toBe(2);
  });

  it('accepts a cut the other way and plays the order by keyboard', () => {
    const fixture = setup('bakery-4');
    start(fixture);
    useOrder(fixture, { rows: 6, cols: 7 });
    key(fixture, 'c');
    const knife = el(fixture).querySelector('.knife-handle')!;
    expect(knife.getAttribute('aria-valuetext')).toContain('column');
    key(fixture, 'ArrowRight', knife);
    key(fixture, 'ArrowRight', knife);
    expect(knife.getAttribute('aria-valuetext')).toBe('After column 5 of 7');
    key(fixture, 'Enter', knife);
    expect(status(fixture)).toBe(en.cutWorks);
    const choices = () =>
      [...el(fixture).querySelectorAll('.choice')].map((b) => b.textContent!.trim());
    key(fixture, String(choices().indexOf('30') + 1));
    key(fixture, String(choices().indexOf('12') + 1));
    for (const d of '42') key(fixture, d);
    key(fixture, 'Enter');
    expect(status(fixture)).toBe(en.bakedFirst);
  });

  it('helps after slips without giving the answer away, and spots added factors', () => {
    const fixture = setup('bakery-4');
    start(fixture);
    useOrder(fixture, { rows: 6, cols: 7 });
    click(fixture, '.dir-button', en.knifeRows);
    const knife = el(fixture).querySelector('.knife-handle')!;
    for (let guard = 0; guard < 6 && knife.getAttribute('aria-valuenow') !== '5'; guard++) {
      [...el(fixture).querySelectorAll<HTMLButtonElement>('.nudge')][1].click();
      fixture.detectChanges();
    }
    expect(knife.getAttribute('aria-valuenow')).toBe('5');
    click(fixture, '.cut-button');
    click(fixture, '.choice', '12');
    expect(el(fixture).querySelector('.hint')!.textContent).toContain(
      '12 would be 5 cookies and 7 cookies',
    );
    namePieces(fixture);
    typeTotal(fixture, 35);
    expect(el(fixture).querySelector('.hint')!.textContent).toContain(en.onePiece);
    typeTotal(fixture, 40);
    const hint = el(fixture).querySelector('.hint')!.textContent!;
    expect(hint).toContain('You have 35 and 7');
    expect(hint).not.toContain('42');
    typeTotal(fixture, 41);
    expect(el(fixture).querySelector('app-bakery-card')).not.toBeNull();
    for (const line of el(fixture).querySelectorAll('app-bakery-card li'))
      expect(line.textContent).not.toMatch(/\b42\b/);
    typeTotal(fixture, 42);
    expect(status(fixture)).toBe(en.baked);
    expect(TestBed.inject(BakeryScores).missed()).toContainEqual({ rows: 6, cols: 7 });
  });

  it('takes the ghost-row way on ×9', () => {
    const fixture = setup('bakery-8');
    start(fixture);
    useOrder(fixture, { rows: 9, cols: 6 });
    click(fixture, '.ghost-button');
    expect(status(fixture)).toContain('10 rows of 6');
    click(fixture, '.choice', '60');
    expect(status(fixture)).toContain('one row of 6 gone');
    typeTotal(fixture, 60);
    expect(el(fixture).querySelector('.hint')!.textContent).toContain(en.ghostFull);
    typeTotal(fixture, 54);
    expect(el(fixture).querySelector('app-bakery-reward')!.textContent).toContain(en.trickBonus);
  });

  it('pays a second-way bonus for cutting a baked tray another way', () => {
    const fixture = setup('bakery-9');
    start(fixture);
    useOrder(fixture, { rows: 7, cols: 8 });
    click(fixture, '.cut-button');
    namePieces(fixture);
    typeTotal(fixture, 56);
    const before = Number(el(fixture).querySelector('.points strong')!.textContent);
    click(fixture, '.another');
    expect(status(fixture)).toBe(en.statusCutAgain);
    click(fixture, '.dir-button', en.knifeCols);
    click(fixture, '.cut-button');
    namePieces(fixture);
    expect(status(fixture)).toBe(en.secondWayDone);
    expect(Number(el(fixture).querySelector('.points strong')!.textContent)).toBe(before + 15);
  });

  it('turns the tray on the turnaround level for the trick bonus', () => {
    const fixture = setup('bakery-2');
    start(fixture);
    useOrder(fixture, { rows: 5, cols: 7 });
    click(fixture, '.button', en.turnButton);
    expect(el(fixture).querySelector('.question')!.textContent).toContain('7 rows of 5');
    typeTotal(fixture, 35);
    expect(el(fixture).querySelector('app-bakery-reward')!.textContent).toContain(en.trickBonus);
  });

  it('finishes seven trays, records the stars and celebrates', async () => {
    const fixture = setup('bakery-1');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    start(fixture);
    for (let order = 0; order < 7; order++) {
      const [, a, b] = /(\d+) × (\d+)/.exec(
        el(fixture).querySelector('.question strong')!.textContent!,
      )!;
      typeTotal(fixture, Number(a) * Number(b));
      vi.advanceTimersByTime(5000);
      fixture.detectChanges();
    }
    expect(el(fixture).querySelector('.outcome h2')!.textContent).toContain(en.perfectRound);
    expect(el(fixture).textContent).toContain(en.treatAdded);
    const progress = TestBed.inject(ProgressService).progress();
    expect(progress.stars?.['bakery-1']).toBe(3);
    expect(progress.mastered).toContain('bakery-1');
    expect(TestBed.inject(BakeryScores).best()['bakery-1']).toBeGreaterThan(0);
    click(fixture, '.outcome .button', en.celebrate);
    expect(navigate).toHaveBeenCalledWith(['/complete', 'bakery-1']);
  });

  it('lets the cookies go crispy when the timer runs out, and the order still sells', () => {
    localStorage.setItem('feenland.bakery-pace.v1', 'fast');
    const fixture = setup('bakery-1');
    start(fixture);
    expect(el(fixture).querySelector('.oven-chip')).not.toBeNull();
    vi.advanceTimersByTime(60_000);
    fixture.detectChanges();
    expect(status(fixture)).toBe(en.crispy);
    const [, a, b] = /(\d+) × (\d+)/.exec(
      el(fixture).querySelector('.question strong')!.textContent!,
    )!;
    typeTotal(fixture, Number(a) * Number(b));
    expect(el(fixture).querySelector('app-bakery-reward')!.textContent).not.toContain(
      en.perfectBonus,
    );
  });

  it('shows the film on the level card with other numbers than the order', () => {
    const fixture = setup('bakery-4');
    const demo = el(fixture).querySelector('app-bakery-demo')!;
    expect(demo).not.toBeNull();
    useOrder(fixture, { rows: 6, cols: 7 });
    vi.advanceTimersByTime(20_000);
    fixture.detectChanges();
    const lines = [...demo.querySelectorAll('.line')].map((l) => l.textContent!.trim());
    expect(lines.at(-1)).toMatch(/=/);
    for (const line of lines) expect(line).not.toMatch(/\b42\b/);
  });

  it('opens the film from ? during play and holds the oven timer', () => {
    localStorage.setItem('feenland.bakery-pace.v1', 'fast');
    const fixture = setup('bakery-4');
    start(fixture);
    click(fixture, '.help');
    expect(el(fixture).querySelector('app-bakery-coach')).not.toBeNull();
    vi.advanceTimersByTime(120_000);
    fixture.detectChanges();
    expect(status(fixture)).not.toBe(en.crispy);
    click(fixture, 'app-bakery-coach .button');
    expect(el(fixture).querySelector('app-bakery-coach')).toBeNull();
  });

  it('shows what to use next for the first trays, then only after a wait', () => {
    const fixture = setup('bakery-1');
    start(fixture);
    const controls = () => el(fixture).querySelector('.controls')!;
    expect(controls().getAttribute('data-guide')).toBe('pad');
    localStorage.setItem('feenland.bakery-guided.v1', '3');
    TestBed.resetTestingModule();
    const later = setup('bakery-1');
    start(later);
    const laterControls = () => (later.nativeElement as HTMLElement).querySelector('.controls')!;
    expect(laterControls().getAttribute('data-guide')).toBeNull();
    vi.advanceTimersByTime(6500);
    later.detectChanges();
    expect(laterControls().getAttribute('data-guide')).toBe('pad');
  });
});
