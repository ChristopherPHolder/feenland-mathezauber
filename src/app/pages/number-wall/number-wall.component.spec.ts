import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { NumberWallComponent } from './number-wall.component';
import { GameAudio } from '../fairy-defense/game-audio';
import { LocaleService } from '../../core/locale';
import { ProgressService } from '../../core/progress';
import { NumberWallStore } from './number-wall-store';

describe('Number wall game', () => {
  const sound = {
    start: vi.fn(),
    pause: vi.fn(),
    sync: vi.fn(),
    effect: vi.fn(),
    speak: vi.fn(),
    updateVoice: vi.fn(),
    canSpeak: () => false,
  };
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [NumberWallComponent],
      providers: [provideRouter([])],
    });
    TestBed.overrideComponent(NumberWallComponent, {
      set: { providers: [{ provide: GameAudio, useValue: sound }] },
    });
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
    vi.clearAllMocks();
  });
  function setup(locale: 'en' | 'de' = 'en') {
    const fixture = TestBed.createComponent(NumberWallComponent);
    TestBed.inject(LocaleService).select(locale);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const click = (text: string) => {
      const button = [...element.querySelectorAll('button')].find(
        (button) =>
          button.textContent?.trim().startsWith(text) || button.getAttribute('aria-label') === text,
      );
      expect(button, text).toBeTruthy();
      button!.click();
      fixture.detectChanges();
    };
    const key = (key: string) => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      fixture.detectChanges();
    };
    const wait = (ms: number) => {
      vi.advanceTimersByTime(ms);
      fixture.detectChanges();
    };
    const status = () => element.querySelector('[role="status"]')?.textContent?.trim() ?? '';
    const openBricks = () => [...element.querySelectorAll<HTMLButtonElement>('.brick.open')];
    const typeNumber = (value: number) => {
      for (const digit of String(value)) {
        const key = [...element.querySelectorAll<HTMLButtonElement>('.pad .key')].find(
          (key) => key.textContent?.trim() === digit,
        );
        key!.click();
        fixture.detectChanges();
      }
      if (String(value).length === 1) click('Check');
    };
    /** Read the solution from the component's wall so the test never depends on randomness. */
    const answerFor = (button: HTMLButtonElement) => {
      const wall = fixture.componentInstance['wall']()!;
      return wall.rows[Number(button.dataset['row'])]![Number(button.dataset['col'])]!;
    };
    const solveSelected = () => {
      const brick = openBricks().find((brick) => brick.getAttribute('aria-pressed') === 'true')!;
      typeNumber(answerFor(brick));
    };
    const gems = () => element.querySelector('.gems strong')?.textContent?.trim();
    return {
      fixture,
      element,
      click,
      key,
      wait,
      status,
      openBricks,
      typeNumber,
      answerFor,
      solveSelected,
      gems,
    };
  }

  it('only opens level 1 at first, remembers the troll speed and lists locked levels', () => {
    const { element, click } = setup();
    expect(element.querySelectorAll('button.level-card')).toHaveLength(1);
    expect(element.querySelectorAll('.level-card.locked')).toHaveLength(3);
    expect(element.querySelector('.chip[aria-pressed="true"]')?.textContent).toContain('Brisk');
    click('Cozy');
    expect(element.querySelector('.chip[aria-pressed="true"]')?.textContent).toContain('Cozy');
    expect(JSON.parse(localStorage.getItem('feenland.number-wall.v1')!).pace).toBe('relaxed');
  });

  it('builds five fast walls, collects gems, earns three stars and unlocks level 2', () => {
    const { element, click, status, solveSelected, gems } = setup();
    click('Level 1');
    expect(sound.start).toHaveBeenCalled();
    expect(element.querySelector('.troll')).toBeTruthy();
    for (let wall = 0; wall < 5; wall++) {
      solveSelected();
      expect(status()).toContain('Wall built! +3 gems! Super fast!');
      expect(element.querySelector('.brick.filled')).toBeTruthy();
      expect(gems()).toBe(String((wall + 1) * 3));
      click(wall < 4 ? 'Next wall' : 'You earned a star!');
    }
    expect(element.textContent).toContain('Three stars!');
    expect(element.textContent).toContain(
      'You built 5 walls. +15 gems! 5 bricks right on the first try.',
    );
    expect(element.querySelectorAll('.star-row app-icon.earned')).toHaveLength(3);
    const store = TestBed.inject(NumberWallStore);
    expect(store.unlocked(2)).toBe(true);
    expect(store.rating(1)).toBe(3);
    expect(store.save()).toMatchObject({ gems: 15, bestStreak: 5 });
    expect(TestBed.inject(ProgressService).progress().completed).toContain('number-wall');
    expect(TestBed.inject(ProgressService).progress().mastered).toEqual([]);
    click('Next level');
    expect(element.querySelector('.level-tag')?.textContent).toContain('Level 2');
  });

  it('lets the troll pinch a gem when the wall takes too long, then keeps walking', () => {
    const { element, click, wait, status, solveSelected, gems } = setup();
    click('Level 1');
    solveSelected();
    expect(gems()).toBe('3');
    click('Next wall');
    wait(39_900);
    expect(status()).not.toContain('troll');
    wait(200);
    expect(status()).toContain('Oh no, the troll pinched a gem! Keep building!');
    expect(gems()).toBe('2');
    expect(sound.effect).toHaveBeenLastCalledWith('damage');
    expect(element.querySelector('.troll.bump')).toBeTruthy();
    wait(20_000);
    solveSelected();
    expect(status()).toContain('Wall built! +2 gems!');
    expect(gems()).toBe('4');
  });

  it('earns fairy dust after three bricks in a row and uses it to freeze the troll', () => {
    const { element, click, wait, status, solveSelected } = setup();
    click('Level 1');
    expect(element.querySelector<HTMLButtonElement>('.dust')?.disabled).toBe(true);
    for (let wall = 0; wall < 3; wall++) {
      solveSelected();
      click('Next wall');
    }
    expect(element.querySelector('.dust strong')?.textContent).toBe('1');
    click('Fairy dust · 1 / 3');
    expect(status()).toMatch(
      /^Fairy dust! The troll fell asleep for a moment\. Trick: \d+ \+ \d+ = \?/,
    );
    expect(element.querySelector('.troll.asleep')).toBeTruthy();
    expect(element.querySelector('.dust strong')?.textContent).toBe('0');
    wait(8_000);
    expect(element.querySelector('.troll.asleep')).toBeNull();
    expect(element.querySelector('.troll')).toBeTruthy();
  });

  it('gives a gentle retry, then the trick with a number line, then an answer', () => {
    localStorage.setItem(
      'feenland.number-wall.v1',
      JSON.stringify({ version: 1, stars: [1], bestStreak: 0 }),
    );
    const { element, click, key, status, openBricks, answerFor } = setup();
    expect(TestBed.inject(NumberWallStore).rating(1)).toBe(1);
    click('Level 2');
    const brick = openBricks()[0]!;
    const answer = answerFor(brick);
    const wrong = answer === 10 ? 11 : 10;
    key(String(Math.floor(wrong / 10)));
    key(String(wrong % 10));
    expect(status()).toBe('Not quite. Try again!');
    expect(element.querySelector('.brick.wobble')).toBeTruthy();
    expect(sound.effect).toHaveBeenLastCalledWith('wrong');
    expect(element.querySelector('.show-me')).toBeNull();
    key(String(Math.floor(wrong / 10)));
    key(String(wrong % 10));
    expect(status()).toMatch(/^Trick: \d+ \+ \? = \d+\. Count up from/);
    expect(element.querySelector('.number-line')).toBeTruthy();
    key(String(Math.floor(wrong / 10)));
    key(String(wrong % 10));
    click('Show me');
    expect(status()).toMatch(/^The brick is \d+, because .* Wall built! \+2 gems! Super fast!$/);
    key('Enter');
    expect(element.querySelector('.progress-brick.done')).toBeTruthy();
    expect(openBricks()).toHaveLength(1);
  });

  it('lets the child choose which glowing brick to fill in level 4, in German and without a troll', () => {
    localStorage.setItem(
      'feenland.number-wall.v1',
      JSON.stringify({ version: 1, ratings: { 1: 2, 2: 1, 3: 3 }, bestStreak: 2, pace: 'relaxed' }),
    );
    const { fixture, element, click, key, status, openBricks, answerFor } = setup('de');
    click('Level 4');
    expect(element.querySelector('.troll')).toBeNull();
    expect(openBricks()).toHaveLength(2);
    const second = openBricks().find((brick) => brick.getAttribute('aria-pressed') === 'false')!;
    second.click();
    fixture.detectChanges();
    expect(second.getAttribute('aria-pressed')).toBe('true');
    const answer = answerFor(second);
    for (const digit of String(answer)) key(digit);
    if (String(answer).length === 1) key('Enter');
    expect(status()).toBe(`Ja! ${answer} passt genau.`);
    expect(openBricks()).toHaveLength(1);
    expect(element.querySelector('[aria-label="Zahlenfeld"]')).toBeTruthy();
    expect(element.querySelector('.key.check')?.hasAttribute('disabled')).toBe(true);
  });
});
