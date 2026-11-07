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
  const sounds = { play: vi.fn(), toggle: vi.fn(), unlock: vi.fn(), enabled: true };
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
  function setup(locale: 'en' | 'de' = 'en', levelId = 'unicorn-race-1') {
    TestBed.overrideProvider(ActivatedRoute, {
      useValue: { paramMap: of(convertToParamMap({ id: levelId })) },
    });
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
          button.getAttribute('aria-disabled') !== 'true' &&
          button.querySelector('.value')?.textContent?.trim() !==
            String(component.question().answer),
      );
      expect(wrong).toBeTruthy();
      wrong!.click();
      fixture.detectChanges();
    };
    const status = () => element.querySelector('.status')?.textContent?.trim() ?? '';
    const chooseHeat = (heat: number) => {
      [...element.querySelectorAll<HTMLButtonElement>('.heat')][heat - 1].click();
      fixture.detectChanges();
    };
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
      chooseHeat,
    };
  }
  it('shows the intro with the pace choice and all fifteen races open in five cups', () => {
    const { element } = setup();
    expect(element.querySelector('h1')?.textContent).toContain('Unicorn Rainbow Race');
    const chips = [...element.querySelectorAll('.pace:not(.wardrobe) .chip')];
    expect(chips.map((chip) => chip.textContent?.trim())).toEqual(['Relaxed', 'Normal', 'Fast']);
    expect(chips[1].getAttribute('aria-pressed')).toBe('true');
    const cups = [...element.querySelectorAll('.cup-title')].map((cup) => cup.textContent?.trim());
    expect(cups).toEqual([
      '🌸 Meadow Cup',
      '☁️ Sky Cup',
      '🌙 Starlight Cup',
      '🏰 Castle Cup',
      '🌈 Rainbow Cup',
    ]);
    const cards = [...element.querySelectorAll<HTMLAnchorElement>('.level-card')];
    expect(cards).toHaveLength(15);
    expect(cards[0].getAttribute('aria-current')).toBe('page');
    expect(cards[1].textContent).toContain('0 of 6 heats');
    const heats = [...element.querySelectorAll('.heat')];
    expect(heats).toHaveLength(6);
    expect(heats[0].getAttribute('aria-pressed')).toBe('true');
    expect(heats.map((heat) => heat.querySelector('.heat-name')?.textContent?.trim())).toEqual([
      'Warm-up',
      'Key chase',
      'Shadow run',
      'Big race',
      'Night chase',
      'Cup final',
    ]);
    expect(cards[14].getAttribute('href')).toBe('/adventure/unicorn-race-15');
    expect(element.textContent).toContain('0 of 5 cups complete');
    // Keepsakes stay locked until a whole cup is finished.
    expect(element.querySelectorAll('.wardrobe .chip.locked')).toHaveLength(5);
    expect(element.querySelector('.wardrobe .chip[aria-pressed="true"]')?.textContent).toContain(
      'Just Lumi',
    );
  });
  it('hands out the cup keepsake once all three races are finished and lets Lumi wear it', () => {
    const { element, component, wait, answerRight, start, click, fixture } = setup(
      'en',
      'unicorn-race-3',
    );
    const store = TestBed.inject(RaceStore);
    store.recordRace(1, 1, 'bronze', 10, 50000);
    store.recordRace(2, 4, 'gold', 10, 50000);
    start();
    for (let n = 0; n < 80 && !component.race().done; n++) {
      answerRight();
      wait(400);
    }
    wait(1400);
    expect(element.querySelector('.summary .new-outfit')?.textContent).toContain('Flower wreath');
    expect(store.save().outfit).toBe('wreath');
    expect(store.completedCups()).toBe(1);
    click('Choose a race');
    expect(element.textContent).toContain('1 of 5 cups complete');
    expect(element.querySelectorAll('.wardrobe .chip.locked')).toHaveLength(4);
    expect(element.querySelector('.lineup app-racer .wreath')).toBeTruthy();
    click('Just Lumi');
    fixture.detectChanges();
    expect(store.save().outfit).toBeNull();
    expect(element.querySelector('.lineup app-racer .wreath')).toBeNull();
    expect(
      [...element.querySelectorAll('.level-card')][2].querySelectorAll('.level-stars .earned'),
    ).toHaveLength(3);
  });
  it('lights the streak pips and calls the final stretch', () => {
    const { element, component, wait, answerRight, start } = setup();
    start();
    expect(element.querySelectorAll('.pip.lit')).toHaveLength(0);
    answerRight();
    wait(400);
    answerRight();
    expect(element.querySelectorAll('.pip.lit')).toHaveLength(2);
    for (
      let n = 0;
      n < 80 && component.race().racers[0].position < component.race().length * 0.8;
      n++
    ) {
      answerRight();
      wait(400);
    }
    wait(100);
    expect(element.querySelector('.status')?.textContent).toContain('Final stretch!');
    expect(sounds.play.mock.calls.some(([kind]) => kind === 'overtake')).toBe(true);
  });
  it('counts down, then races: right answers gallop and wrong ones strike the choice out', () => {
    const { fixture, element, component, click, wait, answers, answerRight, answerWrong, status } =
      setup();
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
    // A double tap right after a correct answer is ignored instead of answering blindly.
    answers()[0].click();
    fixture.detectChanges();
    expect(component.race().mistakes + component.race().correct).toBe(1);
    wait(400);
    answerWrong();
    expect(status()).toContain('stumble');
    expect(answers().filter((button) => button.classList.contains('struck'))).toHaveLength(1);
    expect(
      answers().filter((button) => button.getAttribute('aria-disabled') === 'true'),
    ).toHaveLength(1);
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
  it('finishes a race, records stars, the cup and the time, and offers the next race', () => {
    const { element, component, wait, answerRight, start } = setup();
    start();
    for (let n = 0; n < 60 && !component.race().done; n++) {
      answerRight();
      wait(1200);
    }
    expect(component.race().done).toBe(true);
    expect(element.querySelector('.countdown')?.textContent).toContain('Finish!');
    expect(element.querySelector('.summary')).toBeNull();
    wait(1400);
    const summary = element.querySelector('.summary');
    expect(summary).toBeTruthy();
    expect(summary?.querySelector('h2')?.textContent).toContain('Lumi wins the race!');
    expect(summary?.querySelectorAll('.star-row app-icon.earned')).toHaveLength(3);
    expect(summary?.textContent).toContain('Gold cup');
    expect(summary?.textContent).toContain('Next heat');
    const progress = TestBed.inject(ProgressService).progress();
    expect(progress.completed).toContain('unicorn-race-1');
    expect(progress.mastered).toContain('unicorn-race-1');
    expect(progress.stars?.['unicorn-race-1']).toBe(3);
    expect(TestBed.inject(CompletionService).result()?.levelId).toBe('unicorn-race-1');
    expect(TestBed.inject(RaceStore).record(1, 1)?.cup).toBe('gold');
    expect(TestBed.inject(RaceStore).record(1, 1)?.bestMs).toBeGreaterThan(0);
    expect(TestBed.inject(RaceStore).save().sparkles).toBeGreaterThan(100);
  });
  it('can be raced again right after a last-moment finish', () => {
    const { component, click, wait, answerRight, start } = setup();
    start();
    for (let n = 0; n < 80 && !component.race().done; n++) {
      answerRight();
      // Answer again while the previous leap is still playing out, so the final leap
      // crosses the line while the input lock is still pending.
      wait(400);
    }
    expect(component.race().done).toBe(true);
    wait(1400);
    click('Race again');
    wait(4 * 800 + 300);
    answerRight();
    expect(component.race().correct).toBe(1);
  });
  it('does not finish twice when the tab is switched during the finish hold', () => {
    const { component, wait, answerRight, start, fixture } = setup();
    start();
    for (let n = 0; n < 60 && !component.race().done; n++) {
      answerRight();
      wait(1200);
    }
    const sparkles = TestBed.inject(RaceStore).save().sparkles;
    document.dispatchEvent(new Event('visibilitychange'));
    wait(300);
    document.dispatchEvent(new Event('visibilitychange'));
    wait(1500);
    fixture.detectChanges();
    expect(TestBed.inject(RaceStore).save().sparkles).toBe(sparkles);
    expect(sounds.play.mock.calls.filter(([kind]) => kind === 'win')).toHaveLength(1);
  });
  it('keeps everyone running from the start and shows the standings over the track', () => {
    const { element, component, click, wait, start } = setup();
    click('Fast');
    expect(TestBed.inject(RaceStore).save().pace).toBe('fast');
    start();
    wait(3000);
    const cloud = component.race().racers.find((racer) => racer.id === 'cloud')!;
    const player = component.race().racers.find((racer) => racer.id === 'player')!;
    expect(cloud.position).toBeGreaterThan(5);
    expect(player.position).toBeGreaterThan(1);
    expect(component.race().elapsedMs).toBeGreaterThanOrEqual(3000);
    const standings = [...element.querySelectorAll('app-race-overview .entry')];
    expect(standings).toHaveLength(4);
    expect(standings[0].textContent).toContain('1st');
    expect(standings[0].textContent).toContain('Cloud');
    expect(standings[3].textContent).toContain('Lumi');
    expect(element.querySelector('app-race-overview ol')?.getAttribute('aria-label')).toBe(
      'Who is ahead',
    );
  });
  it('runs a chase against Storm with the gap on the HUD and the key as the prize', () => {
    const { element, component, wait, answerRight, start, click, chooseHeat } = setup(
      'en',
      'unicorn-race-2',
    );
    chooseHeat(2);
    expect(element.querySelector('.cup-tag')?.textContent).toContain('Key chase');
    expect(element.textContent).toContain('Storm has snatched the castle key');
    expect(element.querySelectorAll('.lineup-racer')).toHaveLength(2);
    start();
    expect(element.querySelector('.hud .rival')?.textContent).toContain('Storm');
    expect(element.querySelector('.hud .rival')?.textContent).toContain('ahead');
    expect(element.querySelectorAll('app-race-overview .entry')).toHaveLength(2);
    for (let n = 0; n < 80 && !component.race().done; n++) {
      answerRight();
      wait(400);
    }
    expect(component.race().done).toBe(true);
    wait(1400);
    expect(element.querySelector('.summary h2')?.textContent).toContain('got the key back');
    expect(TestBed.inject(RaceStore).record(2, 2)?.cup).toBe('gold');
    expect(TestBed.inject(RaceStore).record(2, 1)).toBeUndefined();
    // The summary moves on to the next heat of the same track.
    expect(element.querySelector('.summary-actions .primary')?.textContent).toContain(
      'Next heat · Shadow run',
    );
    click('Next heat');
    wait(4 * 800 + 300);
    expect(component.race().mode).toBe('shadow');
    expect(component.race().racers.map((racer) => racer.id)).toEqual(['player', 'shadow']);
  });
  it('shows a missing-number question with its own equals sign', () => {
    const { element, component, start } = setup('en', 'unicorn-race-10');
    expect(element.querySelector('.stage-example')?.textContent?.trim()).toBe('7 + ? = 12');
    start();
    const text = component.question().text;
    expect(text).toContain('?');
    expect(element.querySelector('.equation')?.textContent).toContain(text);
    expect(element.querySelector('.equation')?.textContent).not.toContain('= ?');
  });
  it('races the shadow at par and asks to beat it', () => {
    const { element, component, start, chooseHeat } = setup('en', 'unicorn-race-5');
    chooseHeat(3);
    expect(element.textContent).toContain('Lumi races her own shadow');
    start();
    expect(component.race().shadowMs).toBe(81000);
    expect(element.querySelector('.hud .rival')?.textContent).toContain('Shadow 81 s');
  });
  it('opens a track on its first unfinished heat and migrates old saves to heat one', () => {
    localStorage.setItem(
      'feenland.unicorn-race.v1',
      JSON.stringify({
        version: 1,
        records: { 1: { cup: 'gold', bestMs: 61000 } },
        sparkles: 50,
        pace: 'fast',
      }),
    );
    const { element } = setup();
    const store = TestBed.inject(RaceStore);
    expect(store.record(1, 1)?.cup).toBe('gold');
    expect(store.heatsDone(1)).toBe(1);
    expect(store.save().sparkles).toBe(50);
    expect(element.querySelector('.heat[aria-pressed="true"] .heat-name')?.textContent).toContain(
      'Key chase',
    );
    expect(element.querySelector('.cup-tag')?.textContent).toContain('Key chase');
    expect([...element.querySelectorAll('.level-card')][0].textContent).toContain('1 of 6 heats');
  });
  it('speaks German on the intro and during the race', () => {
    const { element, status, start } = setup('de');
    expect(element.querySelector('h1')?.textContent).toContain('Einhorn-Regenbogenrennen');
    expect(element.textContent).toContain('Blumenwiese');
    start('Rennen starten');
    expect(status()).toContain('Du bist auf Platz 1');
  });
});
