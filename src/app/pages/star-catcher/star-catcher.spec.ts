import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { ProgressService } from '../../core/progress';
import { HatcheryStore } from '../hatchery/hatchery-store';
import { StarCatcher } from './star-catcher';
import { lineFor, share, StarItem, starStage } from './star-levels';
import { starTranslations } from './star-messages';
import { StarScores } from './star-scores';

const en = starTranslations.en;

interface Internals {
  item(): StarItem;
  setNet(value: number): void;
  round: WritableSignal<{ items: readonly StarItem[]; index: number; net: number }>;
}

function setup(id: string) {
  TestBed.configureTestingModule({
    imports: [StarCatcher],
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id })) } },
    ],
  });
  const fixture = TestBed.createComponent(StarCatcher);
  fixture.detectChanges();
  return fixture;
}

const element = (fixture: ComponentFixture<StarCatcher>) => fixture.nativeElement as HTMLElement;
const internals = (fixture: ComponentFixture<StarCatcher>) =>
  fixture.componentInstance as unknown as Internals;
const status = (fixture: ComponentFixture<StarCatcher>) =>
  element(fixture).querySelector('.status')!.textContent!.trim();

function start(fixture: ComponentFixture<StarCatcher>) {
  element(fixture).querySelector<HTMLButtonElement>('.start-dock button')!.click();
  fixture.detectChanges();
}

/** Puts a known plain star first, on the level's own bridge. */
function useStar(fixture: ComponentFixture<StarCatcher>, target: number, label = String(target)) {
  const current = internals(fixture).item();
  const star: StarItem = { kind: 'place', line: current.line, target, label, finale: false };
  internals(fixture).round.update((round) => ({
    ...round,
    items: [star, ...round.items.slice(1)],
  }));
  fixture.detectChanges();
}

function moveTo(fixture: ComponentFixture<StarCatcher>, net: number) {
  internals(fixture).setNet(net);
  fixture.detectChanges();
}

function catchButton(fixture: ComponentFixture<StarCatcher>) {
  return element(fixture).querySelector<HTMLButtonElement>('button.catch')!;
}

/** Answers the current star right, whatever kind it is, and moves on. */
function answer(fixture: ComponentFixture<StarCatcher>) {
  const item = internals(fixture).item();
  const options = [...element(fixture).querySelectorAll<HTMLButtonElement>('.option')];
  if (item.kind === 'place') {
    moveTo(fixture, share(item.line, item.target));
    catchButton(fixture).click();
  } else if (item.kind === 'landed') {
    options.find((button) => button.textContent!.trim() === String(item.target))!.click();
  } else {
    options[item.pair[0] > item.pair[1] ? 0 : 1].click();
  }
  fixture.detectChanges();
  vi.advanceTimersByTime(1600);
  fixture.detectChanges();
}

describe('the star catcher', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    sessionStorage.clear();
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it('teaches the trick, catches a whole round and records three stars', () => {
    const fixture = setup('star-catcher-6');
    expect(element(fixture).textContent).toContain(en.nearTen);
    expect(element(fixture).textContent).toContain('Level 6 of 12');
    expect(element(fixture).querySelectorAll('.level-pill').length).toBe(12);
    expect(element(fixture).querySelectorAll('.collection li').length).toBe(12);
    const warm = vi.spyOn(TestBed.inject(HatcheryStore), 'warm');
    start(fixture);
    expect(TestBed.inject(ProgressService).progress().explored).toContain('tens');
    expect(element(fixture).querySelector('.count')!.textContent).toContain('Star 1 of 10');
    for (let star = 0; star < 13; star++) answer(fixture);
    // The finished picture shows on the board first, then the finish card.
    expect(status(fixture)).toContain('You drew the rocket in the sky!');
    vi.advanceTimersByTime(2500);
    fixture.detectChanges();
    expect(element(fixture).querySelector('.outcome h2')!.textContent).toContain(en.perfectRound);
    expect(element(fixture).querySelector('app-star-reward')!.getAttribute('aria-hidden')).toBe(
      'true',
    );
    expect(element(fixture).textContent).toContain('13 of 13 caught first try');
    expect(warm).toHaveBeenCalledTimes(13);
    const progress = TestBed.inject(ProgressService).progress();
    expect(progress.stars?.['star-catcher-6']).toBe(3);
    expect(progress.mastered).toContain('star-catcher-6');
    expect(TestBed.inject(StarScores).best()['star-catcher-6']).toBeGreaterThan(0);
    expect(TestBed.inject(StarScores).constellations()).toEqual(['rocket']);
  });

  it('announces the shooting-star finale', () => {
    const fixture = setup('star-catcher-1');
    start(fixture);
    for (let star = 0; star < 10; star++) answer(fixture);
    expect(status(fixture)).toContain(en.finaleStart);
    expect(element(fixture).querySelector('.count')!.textContent).toContain('Shooting star 1 of 3');
  });

  it('pays for a golden dead-on catch and lights the comet after three in a row', () => {
    const fixture = setup('star-catcher-4');
    start(fixture);
    useStar(fixture, 70);
    moveTo(fixture, 0.7);
    catchButton(fixture).click();
    fixture.detectChanges();
    expect(status(fixture)).toContain('Dead on! A golden star! +40 points.');
    vi.advanceTimersByTime(1600);
    fixture.detectChanges();
    answer(fixture);
    expect(element(fixture).querySelector('.comet-chip')).toBeNull();
    answer(fixture);
    expect(element(fixture).querySelector('.comet-chip')!.textContent).toContain(en.comet);
  });

  it('keeps the same star after a miss: direction first, then a landmark question', () => {
    const fixture = setup('star-catcher-6');
    start(fixture);
    useStar(fixture, 63);
    moveTo(fixture, 0.3);
    catchButton(fixture).click();
    fixture.detectChanges();
    expect(status(fixture)).toBe(en.further);
    expect(element(fixture).querySelector('.cue')!.textContent).toContain(en.further);
    expect(element(fixture).querySelector('.tip')).toBeNull();
    vi.advanceTimersByTime(1000);
    fixture.detectChanges();
    expect(internals(fixture).item().kind === 'place' && internals(fixture).item()).toMatchObject({
      target: 63,
    });
    moveTo(fixture, 0.95);
    catchButton(fixture).click();
    fixture.detectChanges();
    expect(status(fixture)).toBe(en.back);
    vi.advanceTimersByTime(1000);
    fixture.detectChanges();
    const help = element(fixture).querySelector('.tip')!.textContent!;
    expect(help).toContain('Is 63 more or less than 50, the middle?');
    // Help never names a spot or a number the star does not already show.
    const numbers = help.match(/\d+/g) ?? [];
    expect(numbers.every((n) => ['63', '50'].includes(n))).toBe(true);
    moveTo(fixture, 0.67);
    catchButton(fixture).click();
    fixture.detectChanges();
    // A late catch still counts, without the first-try bonus.
    expect(status(fixture)).toContain('+5 points');
  });

  it('never gives away the answer to a sum in the help', () => {
    const fixture = setup('star-catcher-10');
    start(fixture);
    useStar(fixture, 63, '38 + 25');
    expect(element(fixture).querySelector('.ask .big')!.textContent).toBe('38 + 25');
    for (const net of [0.1, 0.95, 0.1]) {
      moveTo(fixture, net);
      catchButton(fixture).click();
      fixture.detectChanges();
      vi.advanceTimersByTime(1000);
      fixture.detectChanges();
    }
    const text =
      element(fixture).querySelector('.controls')!.textContent! +
      element(fixture).querySelector('.tip')!.textContent!;
    expect(text).toContain(en.hintWider);
    expect(text).not.toContain('63');
    expect(text).not.toContain('60');
  });

  it('brings back the faded posts for one star after the second miss', () => {
    const fixture = setup('star-catcher-7');
    start(fixture);
    useStar(fixture, 40);
    const hints = () => element(fixture).querySelectorAll('app-star-bridge .post.is-hint').length;
    expect(hints()).toBe(0);
    for (const net of [0.9, 0.9]) {
      moveTo(fixture, net);
      catchButton(fixture).click();
      fixture.detectChanges();
      vi.advanceTimersByTime(1000);
      fixture.detectChanges();
    }
    expect(hints()).toBe(lineFor(starStage('star-catcher-7')!).hintTicks.length);
    expect(element(fixture).querySelectorAll('app-star-bridge .post-label').length).toBe(2);
    moveTo(fixture, 0.4);
    catchButton(fixture).click();
    fixture.detectChanges();
    vi.advanceTimersByTime(1600);
    fixture.detectChanges();
    expect(hints()).toBe(0);
  });

  it('is a slider with a coarse value, played with arrows and Enter', () => {
    const fixture = setup('star-catcher-7');
    start(fixture);
    useStar(fixture, 60);
    const slider = element(fixture).querySelector<HTMLElement>('[role="slider"]')!;
    expect(slider.getAttribute('tabindex')).toBe('0');
    expect(slider.getAttribute('aria-label')).toBe(en.sliderLabel);
    expect(slider.getAttribute('aria-valuetext')).toBe(en.zoneHalf);
    const key = (name: string, shiftKey = false) => {
      slider.dispatchEvent(new KeyboardEvent('keydown', { key: name, shiftKey, bubbles: true }));
      fixture.detectChanges();
    };
    key('ArrowRight', true);
    expect(internals(fixture).round().net).toBeCloseTo(0.6);
    expect(slider.getAttribute('aria-valuetext')).toBe(en.zonePastHalf);
    expect(slider.getAttribute('aria-valuetext')).not.toMatch(/\d/);
    key('ArrowLeft');
    key('ArrowRight');
    key('Enter');
    expect(status(fixture)).toContain('Dead on!');
  });

  it('says "about 60" only where the tens are written on the bridge', () => {
    const fixture = setup('star-catcher-5');
    start(fixture);
    moveTo(fixture, 0.62);
    expect(element(fixture).querySelector('[role="slider"]')!.getAttribute('aria-valuetext')).toBe(
      'Nova is at about 60',
    );
  });

  it('remembers the pace; a star that reaches the bridge loses its stardust and waits', () => {
    localStorage.setItem('feenland.star-pace.v1', 'fast');
    const fixture = setup('star-catcher-4');
    expect(element(fixture).querySelector<HTMLInputElement>('input[value="fast"]')!.checked).toBe(
      true,
    );
    start(fixture);
    useStar(fixture, 30);
    expect(element(fixture).querySelector('.stardust strong')!.textContent).toBe('+15');
    vi.advanceTimersByTime(8000);
    fixture.detectChanges();
    expect(status(fixture)).toBe(en.drained);
    expect(element(fixture).querySelector('.stardust strong')!.textContent).toBe('+0');
    expect(catchButton(fixture).disabled).toBe(false);
    moveTo(fixture, 0.3);
    catchButton(fixture).click();
    fixture.detectChanges();
    expect(status(fixture)).toContain('+40 points');
    element(fixture).querySelector<HTMLButtonElement>('.next')!.click();
    fixture.detectChanges();
    expect(element(fixture).querySelector('.stardust strong')!.textContent).toBe('+15');
  });

  it('lets the child pick No rush and keeps it for next time', () => {
    const fixture = setup('star-catcher-2');
    element(fixture).querySelector<HTMLInputElement>('input[value="normal"]')!.click();
    fixture.detectChanges();
    expect(localStorage.getItem('feenland.star-pace.v1')).toBe('normal');
    element(fixture).querySelector<HTMLInputElement>('input[value="off"]')!.click();
    fixture.detectChanges();
    start(fixture);
    expect(element(fixture).querySelector('.stardust')).toBeNull();
    vi.advanceTimersByTime(60_000);
    fixture.detectChanges();
    expect(status(fixture)).not.toContain(en.drained);
  });

  it('asks where a landed star is and which star is further, with buttons', () => {
    const fixture = setup('star-catcher-9');
    start(fixture);
    const line = internals(fixture).item().line;
    internals(fixture).round.update((round) => ({
      ...round,
      items: [
        { kind: 'landed', line, target: 40, options: [10, 40, 80], finale: false },
        { kind: 'compare', line, pair: [61, 59], finale: false },
        ...round.items.slice(2),
      ],
    }));
    fixture.detectChanges();
    expect(element(fixture).querySelector('[role="slider"]')).toBeNull();
    expect(element(fixture).querySelector('.ask')!.textContent).toContain(en.askLanded);
    const options = () => [...element(fixture).querySelectorAll<HTMLButtonElement>('.option')];
    options()[2].click();
    fixture.detectChanges();
    expect(status(fixture)).toBe(en.missedLanded);
    expect(options()[2].disabled).toBe(true);
    vi.advanceTimersByTime(1000);
    fixture.detectChanges();
    options()[1].click();
    fixture.detectChanges();
    expect(status(fixture)).toContain('Yes, that star is 40!');
    vi.advanceTimersByTime(1600);
    fixture.detectChanges();
    expect(element(fixture).querySelector('.ask')!.textContent).toContain(en.askCompare);
    expect(options().map((b) => b.textContent!.trim())).toEqual(['61', '59']);
    options()[0].click();
    fixture.detectChanges();
    expect(status(fixture)).toContain('Yes! 61 lives further along.');
  });

  it('shows a mystery bridge with its step, and a "?" for the far end', () => {
    const fixture = setup('star-catcher-12');
    start(fixture);
    const line = internals(fixture).item().line;
    expect(element(fixture).querySelector('.ask-help')!.textContent).toContain(
      `One step is ${line.unit}.`,
    );
    const labels = [...element(fixture).querySelectorAll('app-star-bridge .post-label')].map(
      (label) => label.textContent!.trim(),
    );
    expect(labels).toEqual(['0', String(line.unit), '?']);
  });

  it('goes to the celebration from the finish card', () => {
    const fixture = setup('star-catcher-12');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    start(fixture);
    for (let star = 0; star < 13; star++) answer(fixture);
    element(fixture).querySelector<HTMLButtonElement>('.controls .finish')!.click();
    fixture.detectChanges();
    const buttons = [...element(fixture).querySelectorAll<HTMLButtonElement>('.outcome button')];
    buttons.find((button) => button.textContent!.includes(en.celebrate))!.click();
    expect(navigate).toHaveBeenCalledWith(['/complete', 'star-catcher-12']);
  });

  it('speaks German', () => {
    localStorage.setItem('feenland.locale', 'de');
    const fixture = setup('star-catcher-1');
    start(fixture);
    expect(catchButton(fixture).textContent!.trim()).toBe(starTranslations.de.catch);
    expect(starTranslations.de.catch).not.toBe(en.catch);
  });
});

describe('showing the star catcher instead of telling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it('plays a short film on the level card, then waits on the last picture', () => {
    const fixture = setup('star-catcher-5');
    const film = () => element(fixture).querySelector('app-star-demo .film')!;
    const caption = () => element(fixture).querySelector('app-star-demo .caption')!.textContent;
    expect(caption()).toBe(en.demoStar);
    expect(element(fixture).querySelector('app-star-demo .label')!.textContent).toBe('80');
    for (const [ms, text] of [
      [2100, en.demoSlide],
      [1700, en.demoCatch],
      [1100, en.demoCaught],
    ] as const) {
      vi.advanceTimersByTime(ms);
      fixture.detectChanges();
      expect(caption()).toBe(text);
    }
    vi.advanceTimersByTime(5000);
    fixture.detectChanges();
    expect(film().getAttribute('data-step')).toBe('5');
    const replay = element(fixture).querySelector<HTMLButtonElement>('app-star-demo .replay')!;
    expect(replay.getAttribute('aria-label')).toBe(en.demoReplay);
    replay.click();
    fixture.detectChanges();
    expect(film().getAttribute('data-step')).toBe('0');
    expect(element(fixture).querySelector('app-star-demo .sr-only')!.textContent).toBe(
      en.demoSummary,
    );
  });

  it('hops Nova first, then Catch!, for the first three catches on a device', () => {
    const fixture = setup('star-catcher-4');
    start(fixture);
    const handle = () => element(fixture).querySelector('[role="slider"]')!;
    expect(handle().classList).toContain('is-hop');
    expect(catchButton(fixture).classList).not.toContain('is-hop');
    moveTo(fixture, 0.3);
    expect(handle().classList).not.toContain('is-hop');
    expect(catchButton(fixture).classList).toContain('is-hop');
    for (let star = 0; star < 3; star++) answer(fixture);
    expect(localStorage.getItem('feenland.star-guided.v1')).toBe('3');
    expect(handle().classList).not.toContain('is-hop');
    // After a quiet wait it shows what to tap next again.
    vi.advanceTimersByTime(6000);
    fixture.detectChanges();
    expect(handle().classList).toContain('is-hop');
  });

  it('shows Nova’s tip over the sky, away from Nova', () => {
    const fixture = setup('star-catcher-6');
    start(fixture);
    useStar(fixture, 63);
    for (const net of [0.2, 0.2]) {
      moveTo(fixture, net);
      catchButton(fixture).click();
      fixture.detectChanges();
      vi.advanceTimersByTime(1000);
      fixture.detectChanges();
    }
    const tip = element(fixture).querySelector('.board .tip')!;
    expect(tip.textContent).toContain('Is 63 more or less than 50, the middle?');
    expect(tip.classList).toContain('is-right');
  });

  it('opens the film from ? and holds the falling star while it is open', () => {
    localStorage.setItem('feenland.star-pace.v1', 'fast');
    const fixture = setup('star-catcher-4');
    start(fixture);
    useStar(fixture, 30);
    const dialog = element(fixture).querySelector<HTMLDialogElement>('dialog.how-to-dialog')!;
    dialog.showModal = vi.fn(() => dialog.setAttribute('open', ''));
    element(fixture).querySelector<HTMLButtonElement>('.how-to')!.click();
    fixture.detectChanges();
    expect(dialog.showModal).toHaveBeenCalled();
    expect(dialog.querySelector('app-star-demo')).not.toBeNull();
    vi.advanceTimersByTime(20_000);
    fixture.detectChanges();
    expect(element(fixture).querySelector('.stardust strong')!.textContent).toBe('+15');
    dialog.dispatchEvent(new Event('close'));
    fixture.detectChanges();
    vi.advanceTimersByTime(4000);
    fixture.detectChanges();
    expect(element(fixture).querySelector('.stardust strong')!.textContent).not.toBe('+15');
  });
});
