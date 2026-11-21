import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { Market } from './market';
import { affordable, leftAfter, MarketTurn, seeded } from './market-levels';
import { marketTranslations } from './market-messages';
import { MarketScores } from './market-scores';
import { Denomination } from './market-money';

const en = marketTranslations.en;

interface Internals {
  random: () => number;
  round: WritableSignal<{ turns: readonly MarketTurn[]; index: number; phase: string }>;
}

function setup(id: string) {
  TestBed.configureTestingModule({
    imports: [Market],
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id })) } },
    ],
  });
  const fixture = TestBed.createComponent(Market);
  (fixture.componentInstance as unknown as Internals).random = seeded(5);
  fixture.detectChanges();
  return fixture;
}

const element = (fixture: ComponentFixture<Market>) => fixture.nativeElement as HTMLElement;
const internals = (fixture: ComponentFixture<Market>) =>
  fixture.componentInstance as unknown as Internals;
const current = (fixture: ComponentFixture<Market>) => {
  const round = internals(fixture).round();
  return round.turns[round.index];
};
const status = (fixture: ComponentFixture<Market>) =>
  element(fixture).querySelector('.status')!.textContent!.trim();
const points = (fixture: ComponentFixture<Market>) =>
  Number(element(fixture).querySelector('.points strong')!.textContent!.trim());

function click(fixture: ComponentFixture<Market>, selector: string) {
  const button = element(fixture).querySelector<HTMLButtonElement>(selector);
  if (!button) throw new Error(`no ${selector}`);
  button.click();
  fixture.detectChanges();
}

function start(fixture: ComponentFixture<Market>) {
  click(fixture, '.start-dock button');
}

/** Taps a purse coin of the given value onto the tray. */
function tapCoin(fixture: ComponentFixture<Market>, value: Denomination) {
  const name = en.coinAdd.replace('{value}', `€${value / 100} ${value >= 500 ? 'note' : 'coin'}`);
  const button = [
    ...element(fixture).querySelectorAll<HTMLButtonElement>('.coin-row .coin-button'),
  ].find((b) => b.getAttribute('aria-label') === name);
  if (!button) throw new Error(`no ${name}`);
  button.click();
  fixture.detectChanges();
}

/** Pays the current price with the fewest coins in the purse, biggest first. */
function payExactly(fixture: ComponentFixture<Market>) {
  const turn = current(fixture);
  let left = turn.price;
  const purse = [...turn.purse].sort((a, b) => b - a);
  for (const coin of purse) {
    if (coin <= left) {
      tapCoin(fixture, coin);
      left -= coin;
    }
  }
  click(fixture, '.pay');
}

function type(fixture: ComponentFixture<Market>, n: number) {
  for (const digit of String(n)) {
    const key = [
      ...element(fixture).querySelectorAll<HTMLButtonElement>('ui-number-pad .key'),
    ].find((b) => b.textContent!.trim() === digit)!;
    key.click();
  }
  fixture.detectChanges();
  click(fixture, 'ui-number-pad .ok');
}

function next(fixture: ComponentFixture<Market>) {
  vi.advanceTimersByTime(2700);
  fixture.detectChanges();
}

describe('The Fairy Market', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  it('shows the level card with the tip, the timer choice and Lumi’s empty shelf', () => {
    const fixture = setup('market-1');
    const text = element(fixture).textContent!;
    expect(text).toContain(en.coinByCoin);
    expect(text).toContain(en.paceTitle);
    expect(text).toContain(en.shelfEmpty);
    expect(element(fixture).querySelectorAll('.level-pill')).toHaveLength(5);
  });

  it('plays level 1 by paying exactly, and helps without saying how much is missing', () => {
    const fixture = setup('market-1');
    start(fixture);
    const turn = current(fixture);
    expect(element(fixture).querySelector('.price-line')!.textContent).toContain(
      `€${turn.price / 100}`,
    );
    // One coin short of nothing: a lone 1 € coin is short for every level-1 price.
    tapCoin(fixture, 100);
    click(fixture, '.pay');
    expect(status(fixture)).toBe(en.short);
    expect(status(fixture)).not.toMatch(/\d/);
    // Take it back and pay properly.
    click(fixture, '.tray .coin-button');
    payExactly(fixture);
    expect(internals(fixture).round().phase).toBe('solved');
    expect(points(fixture)).toBe(10);
    next(fixture);
    payExactly(fixture);
    expect(points(fixture)).toBe(30);
  });

  it('says when too much is on the tray', () => {
    const fixture = setup('market-1');
    start(fixture);
    for (const coin of current(fixture).purse) tapCoin(fixture, coin);
    click(fixture, '.pay');
    expect(status(fixture)).toBe(en.over);
  });

  it('never reads out the sum on the tray, only the coins', () => {
    const fixture = setup('market-1');
    start(fixture);
    tapCoin(fixture, 200);
    tapCoin(fixture, 100);
    expect(status(fixture)).toBe('On the tray: €2, €1');
  });

  it('finishes a round with a receipt, stars and new treats on the shelf', () => {
    const fixture = setup('market-1');
    start(fixture);
    for (let index = 0; index < 7; index++) {
      payExactly(fixture);
      next(fixture);
    }
    const text = element(fixture).textContent!;
    expect(text).toContain(en.perfectRound);
    expect(text).toContain(en.receipt);
    expect(element(fixture).querySelectorAll('.receipt li')).toHaveLength(7);
    expect(TestBed.inject(MarketScores).shelf().length).toBeGreaterThan(0);
    expect(text).toContain('New on Lumi’s shelf');
  });

  it('asks "enough?" on level 3 and puts the treat back when it is not', () => {
    const fixture = setup('market-3');
    start(fixture);
    for (let index = 0; index < 8; index++) {
      const turn = current(fixture);
      const wrong = affordable(turn) ? '.judge-button.no' : '.judge-button.yes';
      click(fixture, wrong);
      expect(status(fixture)).toBe(en.enoughWrong);
      click(fixture, affordable(turn) ? '.judge-button.yes' : '.judge-button.no');
      if (!affordable(turn)) expect(status(fixture)).toContain(en.cheerNo);
      next(fixture);
    }
    expect(element(fixture).textContent).toContain(en.done);
  });

  it('types what is left on level 4, with help for adding the price on', () => {
    const fixture = setup('market-4');
    start(fixture);
    const turn = current(fixture);
    const purse = turn.purse.reduce((a, b) => a + b, 0);
    type(fixture, (purse + turn.price) / 100);
    expect(status(fixture)).toBe(en.added);
    type(fixture, leftAfter(turn) / 100);
    expect(internals(fixture).round().phase).toBe('solved');
  });

  it('runs the shopping spree as "enough?" then "what is left?"', () => {
    const fixture = setup('market-5');
    start(fixture);
    for (let index = 0; index < 7; index++) {
      const turn = current(fixture);
      expect(element(fixture).querySelector('.purse-tag strong')!.textContent).toContain(
        `€${turn.purse.reduce((a, b) => a + b, 0) / 100}`,
      );
      if (affordable(turn)) {
        click(fixture, '.judge-button.yes');
        type(fixture, leftAfter(turn) / 100);
      } else click(fixture, '.judge-button.no');
      next(fixture);
    }
    expect(element(fixture).textContent).toContain(en.perfectRound);
  });
});
