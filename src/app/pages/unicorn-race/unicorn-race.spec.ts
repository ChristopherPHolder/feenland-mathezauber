import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { UnicornRace } from './unicorn-race';
import { RaceSounds } from './race-sounds';
import { LocaleService } from '../../core/locale';
import { ProgressService } from '../../core/progress';
import { CompletionService } from '../../core/completion';
import { RaceStore } from './race-store';
import { RaceQuestion } from './race-questions';
import { RaceState } from './race';

describe('Unicorn race game', () => {
  const sounds = { play: vi.fn(), toggle: vi.fn(), enabled: true };
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({
      imports: [UnicornRace],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ id: 'unicorn-race-1' })) },
        },
      ],
    });
    TestBed.overrideComponent(UnicornRace, {
      set: { providers: [{ provide: RaceSounds, useValue: sounds }] },
    });
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
    vi.clearAllMocks();
  });
  function setup(locale: 'en' | 'de' = 'en') {
    const fixture = TestBed.createComponent(UnicornRace);
    TestBed.inject(LocaleService).select(locale);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const component = fixture.componentInstance as unknown as {
      question: () => RaceQuestion;
      race: () => RaceState;
    };
    const click = (text: string) => {
      const button = [...element.querySelectorAll('button')].find(
        (button) =>
          button.textContent?.trim().startsWith(text) || button.getAttribute('aria-label') === text,
      );
      expect(button, text).toBeTruthy();
      button!.click();
      fixture.detectChanges();
    };
    const wait = (ms: number) => {
      vi.advanceTimersByTime(ms);
      fixture.detectChanges();
    };
    const answers = () => [...element.querySelectorAll<HTMLButtonElement>('.answer')];
    const answerRight = () => {
      const right = answers().find(
        (button) =>
          button.querySelector('.value')?.textContent?.trim() ===
          String(component.question().answer),
      );
      expect(right).toBeTruthy();
      right!.click();
      fixture.detectChanges();
    };
    const answerWrong = () => {
      const wrong = answers().find(
        (button) =>
          !button.disabled &&
          button.querySelector('.value')?.textContent?.trim() !==
            String(component.question().answer),
      );
      expect(wrong).toBeTruthy();
      wrong!.click();
      fixture.detectChanges();
    };
    const status = () => element.querySelector('.status')?.textContent?.trim() ?? '';
    const start = (label = 'Start the race') => {
      click(label);
      wait(4 * 800 + 300);
    };
    return {
      fixture,
      element,
      component,
      click,
      wait,
      answers,
      answerRight,
      answerWrong,
      status,
      start,
    };
  }
  it('shows the intro with the pace choice and all five races open', () => {
    const { element } = setup();
    expect(element.querySelector('h1')?.textContent).toContain('Unicorn Rainbow Race');
    const chips = [...element.querySelectorAll('.chip')];
    expect(chips.map((chip) => chip.textContent?.trim())).toEqual([
      'No rush',
      'Relaxed',
      'Normal',
      'Fast',
    ]);
    expect(chips[0].getAttribute('aria-pressed')).toBe('true');
    const cards = [...element.querySelectorAll<HTMLAnchorElement>('.level-card')];
    expect(cards).toHaveLength(5);
    expect(cards[0].getAttribute('aria-current')).toBe('page');
    expect(cards[4].getAttribute('href')).toBe('/adventure/unicorn-race-5');
  });
  it('counts down, then races: right answers gallop and wrong ones strike the choice out', () => {
    const { element, component, click, wait, answers, answerRight, answerWrong, status } = setup();
    click('Start the race');
    wait(100);
    expect(element.querySelector('.countdown')?.textContent?.trim()).toBe('3');
    wait(4 * 800 + 200);
    expect(element.querySelector('.countdown')).toBeNull();
    expect(answers()).toHaveLength(4);
    expect(answers().every((button) => !button.disabled)).toBe(true);
    const first = component.question().text;
    answerRight();
    expect(status()).toBe('Gallop!');
    expect(component.question().text).not.toBe(first);
    expect(component.race().correct).toBe(1);
    expect(element.querySelector('.sparkles strong')?.textContent).toBe('10');
    answerWrong();
    expect(status()).toContain('stumble');
    expect(answers().filter((button) => button.classList.contains('struck'))).toHaveLength(1);
    expect(answers().filter((button) => button.disabled)).toHaveLength(1);
    expect(component.race().mistakes).toBe(1);
    // The struck choice stays out; the question itself stays, so the child works it out.
    expect(element.querySelector('.equation')?.textContent).toContain(component.question().text);
  });
  it('lets a child answer with the number keys', () => {
    const { component, start } = setup();
    start();
    const index = component.question().choices.indexOf(component.question().answer);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: String(index + 1), bubbles: true }));
    expect(component.race().correct).toBe(1);
  });
  it('finishes a no-rush race, records stars and the cup, and offers the next race', () => {
    const { element, component, wait, answerRight, start } = setup();
    start();
    for (let n = 0; n < 14 && !component.race().done; n++) {
      answerRight();
      wait(1200);
    }
    expect(component.race().done).toBe(true);
    wait(100);
    const summary = element.querySelector('.summary');
    expect(summary).toBeTruthy();
    expect(summary?.querySelector('h2')?.textContent).toContain('Lumi wins the race!');
    expect(summary?.querySelectorAll('.star-row app-icon.earned')).toHaveLength(3);
    expect(summary?.textContent).toContain('Gold cup');
    expect(summary?.textContent).toContain('Next race');
    const progress = TestBed.inject(ProgressService).progress();
    expect(progress.completed).toContain('unicorn-race-1');
    expect(progress.mastered).toContain('unicorn-race-1');
    expect(progress.stars?.['unicorn-race-1']).toBe(3);
    expect(TestBed.inject(CompletionService).result()?.levelId).toBe('unicorn-race-1');
    expect(TestBed.inject(RaceStore).record(1)?.cup).toBe('gold');
    expect(TestBed.inject(RaceStore).save().sparkles).toBeGreaterThan(100);
  });
  it('remembers the chosen pace and runs the rivals on a clock in a timed race', () => {
    const { component, click, wait, start } = setup();
    click('Fast');
    expect(TestBed.inject(RaceStore).save().pace).toBe('fast');
    start();
    wait(3000);
    const cloud = component.race().racers.find((racer) => racer.id === 'cloud')!;
    expect(cloud.position).toBeGreaterThan(5);
    expect(component.race().elapsedMs).toBeGreaterThanOrEqual(3000);
  });
  it('speaks German on the intro and during the race', () => {
    const { element, status, start } = setup('de');
    expect(element.querySelector('h1')?.textContent).toContain('Einhorn-Regenbogenrennen');
    expect(element.textContent).toContain('Blumenwiese');
    start('Rennen starten');
    expect(status()).toContain('Du bist 1.');
  });
});
