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
    vi.clearAllMocks();
  });
  function setup(locale: 'en' | 'de' = 'en') {
    const fixture = TestBed.createComponent(NumberWallComponent);
    TestBed.inject(LocaleService).select(locale);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const buttons = () => [...element.querySelectorAll('button')];
    const click = (text: string) => {
      const button = buttons().find(
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
    return { fixture, element, click, key, status, openBricks, typeNumber, answerFor };
  }

  it('only opens level 1 at first and lists the other levels as locked', () => {
    const { element } = setup();
    expect(element.querySelectorAll('button.level-card')).toHaveLength(1);
    expect(element.querySelectorAll('.level-card.locked')).toHaveLength(3);
  });

  it('builds five walls, celebrates and earns the star that unlocks level 2', () => {
    const { element, click, status, openBricks, typeNumber } = setup();
    click('Level 1');
    expect(sound.start).toHaveBeenCalled();
    for (let wall = 0; wall < 5; wall++) {
      const brick = openBricks()[0]!;
      expect(brick.getAttribute('aria-pressed')).toBe('true');
      const [a, b] = element.querySelectorAll('.brick:not(.open)');
      typeNumber(Number(a!.textContent) + Number(b!.textContent));
      expect(status()).toContain('Wall built!');
      expect(element.querySelector('.brick.filled')).toBeTruthy();
      click(wall < 4 ? 'Next wall' : 'You earned a star!');
    }
    expect(element.textContent).toContain('You built 5 walls.');
    expect(element.textContent).toContain('5 bricks right on the first try.');
    expect(TestBed.inject(NumberWallStore).unlocked(2)).toBe(true);
    expect(TestBed.inject(NumberWallStore).save().bestStreak).toBe(5);
    expect(JSON.parse(localStorage.getItem('feenland.number-wall.v1')!)).toMatchObject({
      stars: [1],
      bestStreak: 5,
    });
    expect(TestBed.inject(ProgressService).progress().completed).toContain('number-wall');
    expect(TestBed.inject(ProgressService).progress().mastered).toEqual([]);
    click('Next level');
    expect(element.querySelector('.level-tag')?.textContent).toContain('Level 2');
  });

  it('gives a gentle retry, then the trick with a number line, then an answer', () => {
    localStorage.setItem(
      'feenland.number-wall.v1',
      JSON.stringify({ version: 1, stars: [1], bestStreak: 0 }),
    );
    const { element, click, key, status, openBricks, answerFor } = setup();
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
    expect(status()).toMatch(/^The brick is \d+, because .* Wall built!$/);
    expect(element.textContent).not.toContain('Every brick on the first try');
    key('Enter');
    expect(element.querySelector('.progress-brick.done')).toBeTruthy();
    expect(openBricks()).toHaveLength(1);
  });

  it('lets the child choose which glowing brick to fill in level 4 and speaks German', () => {
    localStorage.setItem(
      'feenland.number-wall.v1',
      JSON.stringify({ version: 1, stars: [1, 2, 3], bestStreak: 2 }),
    );
    const { fixture, element, click, key, status, openBricks, answerFor } = setup('de');
    click('Level 4');
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
