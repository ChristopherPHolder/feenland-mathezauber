import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ProgressService } from '../../core/progress';
import { HatcheryStore } from '../hatchery/hatchery-store';
import { lockTranslations } from './lock-messages';
import { bestPath, cast, LockPuzzle, spellText } from './lock-puzzles';
import { LockScores } from './lock-scores';
import { TreasureLock } from './treasure-lock';

const en = lockTranslations.en;

interface Internals {
  lock(): LockPuzzle;
  round: WritableSignal<{ locks: readonly LockPuzzle[]; index: number; value: number }>;
}

function setup(id: string) {
  TestBed.configureTestingModule({
    imports: [TreasureLock],
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id })) } },
    ],
  });
  const fixture = TestBed.createComponent(TreasureLock);
  fixture.detectChanges();
  return fixture;
}

function start(fixture: ComponentFixture<TreasureLock>) {
  (fixture.nativeElement as HTMLElement)
    .querySelector<HTMLButtonElement>('.start-dock button')!
    .click();
  fixture.detectChanges();
}

function internals(fixture: ComponentFixture<TreasureLock>) {
  return fixture.componentInstance as unknown as Internals;
}

function spellButton(fixture: ComponentFixture<TreasureLock>, text: string) {
  return [
    ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.spell'),
  ].find((button) => button.textContent!.trim() === text)!;
}

/** Walks the current lock's best way, one button press per hop. */
function solve(fixture: ComponentFixture<TreasureLock>) {
  const lock = internals(fixture).lock();
  let value = lock.start;
  for (const step of bestPath(lock)) {
    const spell = lock.spells.find((candidate) => cast(value, candidate, lock.max) === step)!;
    spellButton(fixture, spellText(spell)).click();
    fixture.detectChanges();
    value = step;
  }
}

describe('the treasure lock game', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    sessionStorage.clear();
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it('teaches the trick, opens six chests in the fewest hops and records three stars', () => {
    const fixture = setup('treasure-lock-4');
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain(en.nines);
    expect(element.textContent).toContain('Level 4 of 9');
    expect(element.querySelectorAll('.level-pill').length).toBe(9);
    const warm = vi.spyOn(TestBed.inject(HatcheryStore), 'warm');
    start(fixture);
    expect(TestBed.inject(ProgressService).progress().explored).toContain('tens');
    expect([...element.querySelectorAll('.spell')].map((b) => b.textContent!.trim())).toEqual([
      '+10',
      '+1',
      '−1',
    ]);
    for (let chest = 0; chest < 6; chest++) {
      solve(fixture);
      expect(element.querySelector('.status')!.textContent).toContain('Three golden keys');
      element.querySelector<HTMLButtonElement>('.lock-actions .primary')!.click();
      fixture.detectChanges();
    }
    expect(element.querySelector('.outcome h2')!.textContent).toContain(en.perfectRound);
    expect(element.textContent).toContain('18 golden keys');
    expect(warm).toHaveBeenCalledTimes(6);
    const progress = TestBed.inject(ProgressService).progress();
    expect(progress.stars?.['treasure-lock-4']).toBe(3);
    expect(progress.mastered).toContain('treasure-lock-4');
    expect(TestBed.inject(LockScores).best()['treasure-lock-4']).toBeGreaterThan(0);
  });

  it('bounces Pip back off a thorn and still counts the hop', () => {
    const fixture = setup('treasure-lock-4');
    start(fixture);
    const lock: LockPuzzle = {
      start: 0,
      target: 19,
      max: 50,
      spells: internals(fixture).lock().spells,
      thorns: [10],
      gem: null,
      par: 5,
    };
    internals(fixture).round.update((round) => ({
      ...round,
      locks: [lock, ...round.locks.slice(1)],
    }));
    fixture.detectChanges();
    spellButton(fixture, '+10').click();
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.status')!.textContent).toContain(en.thorn);
    vi.advanceTimersByTime(600);
    fixture.detectChanges();
    expect(internals(fixture).round().value).toBe(0);
    expect(element.querySelector('.hop-count strong')!.textContent).toBe('1');
  });

  it('collects the gem on the way and greys out hops that leave the dial', () => {
    const fixture = setup('treasure-lock-1');
    start(fixture);
    const lock: LockPuzzle = {
      start: 0,
      target: 9,
      max: 20,
      spells: internals(fixture).lock().spells,
      thorns: [],
      gem: 5,
      par: 3,
    };
    internals(fixture).round.update((round) => ({
      ...round,
      locks: [lock, ...round.locks.slice(1)],
    }));
    fixture.detectChanges();
    expect(spellButton(fixture, '−1').disabled).toBe(true);
    spellButton(fixture, '+5').click();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.status')!.textContent).toContain(
      en.gem,
    );
    spellButton(fixture, '+5').click();
    spellButton(fixture, '−1').click();
    fixture.detectChanges();
    // 30 coins for three keys and 10 for the gem.
    expect((fixture.nativeElement as HTMLElement).querySelector('.coins strong')!.textContent).toBe(
      '40',
    );
  });

  it('celebrates an opened chest over the dial with the cheer, the keys won and the coins', () => {
    const fixture = setup('treasure-lock-1');
    start(fixture);
    const element = fixture.nativeElement as HTMLElement;
    const lock: LockPuzzle = {
      start: 0,
      target: 9,
      max: 20,
      spells: internals(fixture).lock().spells,
      thorns: [],
      gem: null,
      par: 3,
    };
    internals(fixture).round.update((round) => ({
      ...round,
      locks: [lock, lock, ...round.locks.slice(2)],
    }));
    fixture.detectChanges();
    expect(element.querySelector('app-lock-reward')).toBeNull();
    for (const hop of ['+5', '+5', '−1']) {
      spellButton(fixture, hop).click();
      fixture.detectChanges();
    }
    const reward = element.querySelector('.board app-lock-reward')!;
    expect(reward.getAttribute('aria-hidden')).toBe('true');
    expect(reward.querySelector('.cheer')!.textContent).toBe(en.rewardPerfect);
    expect(reward.querySelectorAll('.key.won').length).toBe(3);
    expect(reward.querySelector('.gain')!.textContent).toBe('+30 coins');
    // The card goes away with the next chest.
    vi.advanceTimersByTime(3000);
    fixture.detectChanges();
    expect(element.querySelector('app-lock-reward')).toBeNull();
    // Five hops on a three-hop lock still opens it, for two keys.
    for (const hop of ['+1', '+1', '+1', '+1', '+5']) {
      spellButton(fixture, hop).click();
      fixture.detectChanges();
    }
    expect(element.querySelector('.cheer')!.textContent).toBe(en.rewardOpened);
    expect(element.querySelectorAll('app-lock-reward .key.won').length).toBe(2);
    expect(element.querySelector('app-lock-reward .gain')!.textContent).toBe('+20 coins');
  });

  it('numbers a slotted-in level by its place and greys out halving on odd numbers', () => {
    const fixture = setup('treasure-lock-8');
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Level 7 of 9');
    expect(element.textContent).toContain(en.halving);
    const pills = [...element.querySelectorAll<HTMLAnchorElement>('.level-pill')];
    expect(pills.map((pill) => pill.textContent!.trim())).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
    ]);
    expect(pills[6].getAttribute('href')).toBe('/adventure/treasure-lock-8');
    expect(pills[6].getAttribute('aria-current')).toBe('page');
    expect(pills[7].getAttribute('href')).toBe('/adventure/treasure-lock-7');
    start(fixture);
    expect([...element.querySelectorAll('.spell')].map((b) => b.textContent!.trim())).toEqual([
      '÷2',
      '−1',
      '+1',
    ]);
    const lock: LockPuzzle = {
      start: 40,
      target: 9,
      max: 50,
      spells: internals(fixture).lock().spells,
      thorns: [],
      gem: null,
      par: 3,
    };
    internals(fixture).round.update((round) => ({
      ...round,
      locks: [lock, ...round.locks.slice(1)],
    }));
    fixture.detectChanges();
    expect(element.querySelector('.halve-note')).toBeNull();
    spellButton(fixture, '÷2').click();
    spellButton(fixture, '÷2').click();
    spellButton(fixture, '÷2').click();
    fixture.detectChanges();
    expect(internals(fixture).round().value).toBe(5);
    const halve = spellButton(fixture, '÷2');
    expect(halve.disabled).toBe(true);
    expect(element.querySelector('.halve-note')!.textContent).toContain('5 is odd');
    expect(halve.getAttribute('aria-describedby')).toBe('halve-note');
    expect(halve.title).toContain('5 is odd');
    spellButton(fixture, '−1').click();
    fixture.detectChanges();
    expect(element.querySelector('.halve-note')).toBeNull();
    expect(spellButton(fixture, '÷2').disabled).toBe(false);
  });

  it('plays the double-and-halve level to the end and offers no next level', () => {
    const fixture = setup('treasure-lock-9');
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Level 9 of 9');
    start(fixture);
    for (let chest = 0; chest < 6; chest++) {
      solve(fixture);
      vi.advanceTimersByTime(600);
      element.querySelector<HTMLButtonElement>('.lock-actions .primary')!.click();
      fixture.detectChanges();
    }
    expect(element.querySelector('.outcome h2')!.textContent).toContain(en.perfectRound);
    expect(element.querySelector('.outcome a.primary')).toBeNull();
  });

  it('sends the slotted-in halving level on to the treasure master', () => {
    const fixture = setup('treasure-lock-8');
    start(fixture);
    const element = fixture.nativeElement as HTMLElement;
    for (let chest = 0; chest < 6; chest++) {
      solve(fixture);
      element.querySelector<HTMLButtonElement>('.lock-actions .primary')!.click();
      fixture.detectChanges();
    }
    expect(element.querySelector('.outcome a.primary')!.getAttribute('href')).toBe(
      '/adventure/treasure-lock-7',
    );
  });

  it('reminds the child of the trick after extra hops, without showing the answer', () => {
    const fixture = setup('treasure-lock-3');
    start(fixture);
    const element = fixture.nativeElement as HTMLElement;
    const lock = internals(fixture).lock();
    for (let hop = 0; hop < lock.par + 2; hop++) {
      // Hop +1 and come back to the start, so the lock never opens by accident.
      if (internals(fixture).round().value + 1 === lock.target) {
        element.querySelector<HTMLButtonElement>('.restart')!.click();
        fixture.detectChanges();
      }
      spellButton(fixture, '+1').click();
      fixture.detectChanges();
    }
    expect(element.querySelector('.status')!.textContent).toContain(en.hintLead);
    expect(element.querySelector('.status')!.textContent).toContain(en.tens);
  });

  it('lets the crystal fade when the hourglass runs out, without blocking the chest', () => {
    localStorage.setItem('feenland.treasure-lock-pace.v1', 'fast');
    const fixture = setup('treasure-lock-2');
    start(fixture);
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.hourglass')).not.toBeNull();
    vi.advanceTimersByTime(60_000);
    fixture.detectChanges();
    expect(element.querySelector('.status')!.textContent).toContain(en.sandOut);
    solve(fixture);
    expect(element.querySelector('.lock-actions .primary')).not.toBeNull();
    // Three keys, maybe a gem, but no crystal: no 15-coin crystal bonus.
    expect(['30', '40']).toContain(element.querySelector('.coins strong')!.textContent);
  });
});
