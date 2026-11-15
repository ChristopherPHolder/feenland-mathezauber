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
    const status = () =>
      element.querySelector('[role="status"] > span:last-child')?.textContent?.trim() ?? '';
    const openBricks = () => [...element.querySelectorAll<HTMLButtonElement>('.brick.open')];
    const typeNumber = (value: number) => {
      for (const digit of String(value)) {
        const key = [...element.querySelectorAll<HTMLButtonElement>('.pad .key')].find(
          (key) => key.textContent?.trim() === digit,
        );
        key!.click();
        fixture.detectChanges();
      }
      click('Check');
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

  it('opens every level, shows the demo wall and remembers the troll speed', () => {
    const { element, click } = setup();
    expect(element.querySelectorAll('button.level-card')).toHaveLength(11);
    expect(element.querySelector('.level-card.locked')).toBeNull();
    expect(element.querySelector('.demo-wall')?.textContent?.replace(/\s+/g, '')).toBe('52+3');
    expect(element.querySelector('.chip[aria-pressed="true"]')?.textContent).toContain('Brisk');
    click('Cozy');
    expect(element.querySelector('.chip[aria-pressed="true"]')?.textContent).toContain('Cozy');
    expect(JSON.parse(localStorage.getItem('feenland.number-wall.v1')!).pace).toBe('relaxed');
  });

  it('leaves Enter to a focused link or button outside the wall, so All games still opens', () => {
    const { element, click, status } = setup();
    click('Build the magic wall');
    const pad = [...element.querySelectorAll<HTMLButtonElement>('.pad .key')];
    pad.find((key) => key.textContent?.trim() === '1')!.click();
    const before = status();
    const back = element.querySelector<HTMLAnchorElement>('a.games-link')!;
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    back.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(false);
    expect(status()).toBe(before);
  });

  it('starts the first level without a star from the big button', () => {
    localStorage.setItem(
      'feenland.number-wall.v1',
      JSON.stringify({
        version: 1,
        ratings: { 5: 3, 1: 3 },
        bestStreak: 0,
        gems: 0,
        pace: 'relaxed',
      }),
    );
    const { element, click } = setup();
    // Levels are listed easiest first: tiny walls (5), then the original levels 1 and 2.
    expect(element.querySelector('.start-wall')?.textContent).toContain('Level 3');
    click('Build the magic wall');
    expect(element.querySelector('.level-tag')?.textContent).toContain('Level 3');
  });

  it.each(['keypad', 'keyboard'] as const)(
    'waits for submission so a two-digit answer can be corrected with the %s',
    (input) => {
      const { fixture, element, click, key, status } = setup();
      click('Level 2');
      fixture.componentInstance['walls'].set([
        { level: 1, rows: [[7, 8], [15]], missing: [{ row: 1, col: 0 }] },
      ]);
      const digit = (value: string) => (input === 'keypad' ? click(value) : key(value));
      digit('1');
      digit('6');
      expect(status()).toBe('Your number: 16');
      expect(sound.effect).not.toHaveBeenCalledWith('wrong');
      if (input === 'keypad') element.querySelector<HTMLButtonElement>('.key.erase')!.click();
      else key('Backspace');
      digit('5');
      expect(status()).toBe('Your number: 15');
      expect(fixture.componentInstance['filled']()).toEqual([]);
      if (input === 'keypad') click('Check');
      else key('Enter');
      expect(status()).toContain('Wall built! +3 gems!');
      expect(fixture.componentInstance['firstTry']()).toBe(1);
    },
  );

  it.each(['keypad', 'keyboard'] as const)(
    'accepts 100 without checking its prefix with the %s',
    (input) => {
      const { fixture, click, key, status } = setup();
      click('Level 4');
      fixture.componentInstance['walls'].set([
        { level: 6, rows: [[40, 60], [100]], missing: [{ row: 1, col: 0 }] },
      ]);
      fixture.componentInstance['selected'].set({ row: 1, col: 0 });
      const digit = (value: string) => (input === 'keypad' ? click(value) : key(value));
      digit('1');
      digit('0');
      expect(status()).toBe('Your number: 10');
      digit('0');
      expect(status()).toBe('Your number: 100');
      digit('0');
      expect(status()).toBe('Your number: 100');
      expect(sound.effect).not.toHaveBeenCalledWith('wrong');
      if (input === 'keypad') click('Check');
      else key('Enter');
      expect(status()).toContain('Wall built! +3 gems!');
      expect(fixture.componentInstance['firstTry']()).toBe(1);
    },
  );

  it('builds eight fast walls, collects gems, earns three stars and offers the next level', () => {
    const { element, click, status, solveSelected, gems } = setup();
    click('Level 2');
    expect(element.querySelector('.level-tag')?.textContent).toContain('The top brick');
    expect(sound.start).toHaveBeenCalled();
    expect(element.querySelector('.troll')).toBeTruthy();
    for (let wall = 0; wall < 8; wall++) {
      solveSelected();
      expect(status()).toContain('Wall built! +3 gems! Super fast!');
      expect(element.querySelector('.brick.filled')).toBeTruthy();
      expect(element.querySelectorAll('app-wall-reward .row.is-earned')).toHaveLength(3);
      expect(gems()).toBe(String((wall + 1) * 3));
      click(wall < 7 ? 'Next wall' : 'You earned a star!');
    }
    expect(element.textContent).toContain('Three stars!');
    expect(element.querySelector('.summary-lead')?.textContent?.trim()).toBe('You built 8 walls.');
    const reward = (name: string) =>
      element.querySelector(`.reward.${name}`)?.textContent?.replace(/\s+/g, ' ').trim();
    expect(reward('gems')).toBe('💎+24 Gems');
    expect(reward('first-try')).toBe('✨8 / 8 Right first time');
    expect(reward('streak')).toBe('⚡8 Best streak');
    expect(reward('troll')).toBe('0 Knocked down');
    expect(element.querySelector('.summary-fairy img')).toBeTruthy();
    expect(element.querySelectorAll('.star-row app-icon.earned')).toHaveLength(3);
    const store = TestBed.inject(NumberWallStore);
    expect(store.rating(1)).toBe(3);
    expect(store.save()).toMatchObject({ gems: 24, bestStreak: 8 });
    expect(TestBed.inject(ProgressService).progress().completed).toContain('number-wall');
    expect(TestBed.inject(ProgressService).progress().mastered).toEqual([]);
    click('Next level');
    expect(element.querySelector('.level-tag')?.textContent).toContain('Level 3');
  });

  it('lets the troll bonk the wall, break hearts and knock it down after three hits', () => {
    const { element, click, wait, status, solveSelected, gems, openBricks } = setup();
    const hearts = () => element.querySelectorAll('.heart:not(.lost)').length;
    click('Level 2');
    expect(hearts()).toBe(3);
    solveSelected();
    expect(gems()).toBe('3');
    click('Next wall');
    wait(39_900);
    expect(status()).not.toContain('troll');
    wait(200);
    expect(status()).toContain('Bonk! The troll hit the wall. Hearts left: 2. Build faster!');
    expect(hearts()).toBe(2);
    expect(gems()).toBe('3');
    expect(sound.effect).toHaveBeenLastCalledWith('damage');
    expect(element.querySelector('.troll.bump')).toBeTruthy();
    expect(element.querySelector('.wall.hit')).toBeTruthy();
    expect(element.querySelector('.troll')?.getAttribute('aria-valuenow')).toBe('100');
    expect(element.querySelectorAll('.crack')).toHaveLength(1);
    // The clock waits while he staggers back to the start of the road.
    wait(1_500);
    expect(element.querySelector('.troll.bump')).toBeNull();
    expect(Number(element.querySelector('.troll')?.getAttribute('aria-valuenow'))).toBeLessThan(5);
    wait(40_100);
    expect(status()).toContain('Hearts left: 1');
    expect(element.querySelectorAll('.crack')).toHaveLength(2);
    wait(1_500);
    wait(40_100);
    expect(status()).toContain('Crash! The troll knocked the wall down. Build it again!');
    expect(hearts()).toBe(0);
    expect(element.querySelector('.wall.crumble')).toBeTruthy();
    expect(element.querySelector('.troll.victory')).toBeTruthy();
    expect(element.querySelector('.pad')).toBeNull();
    click('Build it again');
    expect(hearts()).toBe(3);
    expect(element.querySelector('.wall.crumble')).toBeNull();
    expect(element.querySelector('.troll')?.getAttribute('aria-valuenow')).toBe('0');
    expect(openBricks()).toHaveLength(1);
    solveSelected();
    expect(status()).toContain('Wall built! +3 gems! Super fast!');
    expect(gems()).toBe('6');
    for (let wall = 2; wall < 8; wall++) {
      click('Next wall');
      solveSelected();
    }
    click('You earned a star!');
    expect(element.querySelector('.reward.troll strong')?.textContent).toBe('1');
    expect(element.querySelector('.reward.troll app-wall-troll')?.classList).toContain(
      'is-cheering',
    );
  });

  it('hands the 3D castle a frame that counts every wall, brick, miss and bonk once', () => {
    const { fixture, click, wait, typeNumber, openBricks, answerFor } = setup();
    const frame = () => fixture.componentInstance['frame']();
    click('Level 1');
    const first = frame();
    expect(first.rows).toEqual(fixture.componentInstance['wall']()!.rows);
    expect(first.selected).toEqual({ row: 1, col: 0 });
    expect(first.pair).toEqual({ row: 0, col: 0 });
    expect(first.troll).toBe(0);
    const brick = openBricks()[0]!;
    const answer = answerFor(brick);
    typeNumber(answer === 1 ? 2 : 1);
    expect(frame().misses).toBe(first.misses + 1);
    typeNumber(answer);
    expect(frame()).toMatchObject({
      placed: first.placed + 1,
      justFilled: { row: 1, col: 0 },
      built: true,
      pair: undefined,
    });
    click('Next wall');
    expect(frame().build).toBe(first.build + 1);
    wait(40_100);
    expect(frame()).toMatchObject({ bonks: first.bonks + 1, trollBump: true, cracks: 1 });
  });

  it('earns fairy dust after three bricks in a row and uses it to freeze the troll', () => {
    const { fixture, element, click, wait, status, solveSelected } = setup();
    click('Level 1');
    expect(element.querySelector<HTMLButtonElement>('.dust')?.disabled).toBe(true);
    for (let wall = 0; wall < 3; wall++) {
      solveSelected();
      click('Next wall');
    }
    expect(element.querySelector('.dust strong')?.textContent).toBe('1');
    expect(element.querySelector('.dust')?.classList).toContain('ready');
    const dust = element.querySelector<HTMLButtonElement>('button.dust')!;
    expect(dust.textContent?.replace(/\s+/g, ' ').trim()).toBe('🪄Fairy dust 1 / 3');
    dust.click();
    fixture.detectChanges();
    expect(status()).toMatch(/^Fairy dust! The troll is asleep\. Trick: \d+ \+ \d+ = \?/);
    expect(element.querySelector('.dust')?.classList).not.toContain('ready');
    expect(element.querySelector('app-wall-troll .sleep-clock')).toBeTruthy();
    expect(element.querySelectorAll('.troll .frost span').length).toBeGreaterThan(0);
    expect(element.querySelector('.troll.asleep')).toBeTruthy();
    expect(element.querySelector('app-wall-troll')?.classList).toContain('is-asleep');
    expect(element.querySelector('.dust strong')?.textContent).toBe('0');
    wait(8_000);
    expect(element.querySelector('.troll.asleep')).toBeNull();
    expect(element.querySelector('app-wall-troll')?.classList).not.toContain('is-asleep');
    expect(element.querySelector('.troll')).toBeTruthy();
  });

  it('draws no rule picture when the hint asks for the other brick first', () => {
    const { fixture, element, click, status } = setup();
    click('Level 3');
    fixture.componentInstance['feedback'].set({ kind: 'hint', hint: { kind: 'fillOther' } });
    fixture.detectChanges();
    expect(status()).toBe('Fill the other glowing brick first.');
    // The add-the-two-below picture would contradict the words, so the status shows only the text.
    expect(element.querySelector('.status .hint-wall')).toBeNull();
    expect(element.querySelector('app-wall-scene')?.classList).toContain('is-hinting');
  });

  it('says one gem, not one gems, for a wall worth a single gem', () => {
    const { fixture, click, status } = setup();
    click('Level 3');
    const won = { kind: 'built', perfect: false, fast: false } as const;
    fixture.componentInstance['feedback'].set({ ...won, gems: 1 });
    fixture.detectChanges();
    expect(status()).toBe('Wall built! +1 gem!');
    fixture.componentInstance['feedback'].set({ ...won, gems: 2 });
    fixture.detectChanges();
    expect(status()).toBe('Wall built! +2 gems!');
  });

  it('gives a gentle retry, then the rule as a picture, and never gives the answer away', () => {
    localStorage.setItem(
      'feenland.number-wall.v1',
      JSON.stringify({ version: 1, stars: [1], bestStreak: 0 }),
    );
    const { element, click, key, status, openBricks, answerFor, typeNumber } = setup();
    expect(TestBed.inject(NumberWallStore).rating(1)).toBe(1);
    click('Level 3');
    const brick = openBricks()[0]!;
    const answer = answerFor(brick);
    const wrong = answer === 10 ? 11 : 10;
    const miss = () => {
      key(String(Math.floor(wrong / 10)));
      key(String(wrong % 10));
      key('Enter');
    };
    miss();
    expect(status()).toMatch(/^Not quite\. Try again! Trick: \d+ \+ \? = \d+\. Count up from/);
    expect(element.querySelector('.brick.wobble')).toBeTruthy();
    expect(sound.effect).toHaveBeenLastCalledWith('wrong');
    expect(element.querySelector('.hint-wall')).toBeNull();
    miss();
    expect(status()).toMatch(/^Trick: \d+ \+ \? = \d+\. Count up from/);
    expect(element.querySelector('.status .hint-wall .ask')?.textContent).toBe('?');
    expect(element.querySelector('app-wall-scene')?.classList).toContain('is-hinting');
    for (let attempt = 0; attempt < 4; attempt++) miss();
    // However many misses, the help names the rule and the two bricks, never the result, and
    // there is no button that fills the brick in.
    expect(status()).toMatch(/^Trick: \d+ \+ \? = \d+\. Count up from \d+ to \d+\.$/);
    expect(element.querySelector('.show-me')).toBeNull();
    expect(element.querySelector('.number-line')).toBeNull();
    expect(openBricks()).toHaveLength(1);
    typeNumber(answer);
    expect(element.querySelector('app-wall-scene')?.classList).not.toContain('is-hinting');
    expect(status()).toMatch(/^Wall built! \+\d gems?!/);
    // The prize card shows the gem won and the one missed for mistakes, still to win next time.
    const rows = [...element.querySelectorAll('app-wall-reward .row')];
    expect(rows[0]?.textContent).toContain('Wall built');
    expect(rows[0]?.classList).toContain('is-earned');
    expect(rows[1]?.textContent).toContain('No mistakes');
    expect(rows[1]?.textContent).toContain('+0');
    expect(rows[1]?.classList).not.toContain('is-earned');
  });

  it('lets the child choose which glowing brick to fill in level 4, in German and without a troll', () => {
    localStorage.setItem(
      'feenland.number-wall.v1',
      JSON.stringify({ version: 1, ratings: { 1: 2, 2: 1, 3: 3 }, bestStreak: 2, pace: 'relaxed' }),
    );
    const { fixture, element, click, key, status, openBricks, answerFor } = setup('de');
    click('Level 7');
    expect(element.querySelector('.troll')).toBeNull();
    expect(openBricks()).toHaveLength(2);
    const second = openBricks().find((brick) => brick.getAttribute('aria-pressed') === 'false')!;
    second.click();
    fixture.detectChanges();
    expect(second.getAttribute('aria-pressed')).toBe('true');
    const answer = answerFor(second);
    for (const digit of String(answer)) key(digit);
    key('Enter');
    expect(status()).toBe(`Ja! ${answer} passt genau.`);
    expect(openBricks()).toHaveLength(1);
    expect(element.querySelector('[aria-label="Zahlenfeld"]')).toBeTruthy();
    expect(element.querySelector('.key.check')?.hasAttribute('disabled')).toBe(true);
  });
});
