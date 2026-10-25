import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { FairyDefenseComponent } from './fairy-defense.component';
import { GameAudio } from './game-audio';
import { PlaytestStore } from './playtest-store';
import { LocaleService } from '../../core/locale';
import { ProgressService } from '../../core/progress';
import { gameMessages } from './game-messages';
import { Locale } from '../../core/messages';

describe('Wave 1 playable integration', () => {
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
    localStorage.setItem('feenland.campaign-math', '10');
    TestBed.configureTestingModule({
      imports: [FairyDefenseComponent],
      providers: [provideRouter([])],
    });
    TestBed.overrideComponent(FairyDefenseComponent, {
      set: { providers: [{ provide: GameAudio, useValue: sound }] },
    });
    HTMLDialogElement.prototype.showModal = function () {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function () {
      this.open = false;
    };
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
    vi.clearAllMocks();
  });
  function setup() {
    const fixture = TestBed.createComponent(FairyDefenseComponent);
    TestBed.inject(LocaleService).select('en');
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const click = (text: string) => {
      const button = [...element.querySelectorAll('button')].find(
        (button) =>
          button.textContent?.trim() === text || button.getAttribute('aria-label') === text,
      );
      expect(button, text).toBeTruthy();
      button!.click();
      fixture.detectChanges();
    };
    return { fixture, element, click };
  }
  it('completes both encounters without writing learning achievements', () => {
    const { fixture, element, click } = setup();
    const progress = TestBed.inject(ProgressService).progress();
    click('Play');
    click('Cast spell 1');
    click('Cast spell 5'); // Disabled during cast: must not count.
    vi.advanceTimersByTime(2650);
    fixture.detectChanges();
    expect(element.querySelector('.number-badge')?.textContent?.trim()).toBe('8');
    click('Cast spell 2');
    vi.advanceTimersByTime(2650);
    fixture.detectChanges();
    expect(element.textContent).toContain('Wave 1 complete!');
    expect(TestBed.inject(ProgressService).progress()).toEqual(progress);
    expect(localStorage.getItem('feenland.progress')).toBeNull();
    expect(localStorage.getItem('feenland.result')).toBeNull();
    expect(localStorage.getItem('feenland.castle-campaign.v1')).toContain('results');
    expect(element.textContent).toContain('Next wave');
  });
  it('pauses a pending cast and resumes its remaining transition only once', () => {
    const { fixture, element, click } = setup();
    click('Play');
    click('Cast spell 1');
    vi.advanceTimersByTime(200);
    click('Pause');
    vi.advanceTimersByTime(10000);
    fixture.detectChanges();
    expect(element.querySelector('.number-badge')?.textContent?.trim()).toBe('9');
    click('Keep playing');
    vi.advanceTimersByTime(350);
    fixture.detectChanges();
    expect(element.textContent).toContain('9 + 1 = 10');
    vi.advanceTimersByTime(2100);
    fixture.detectChanges();
    expect(element.querySelector('.number-badge')?.textContent?.trim()).toBe('8');
  });
  it('loses after nine wrong spells and lets the child choose a full-wave retry', () => {
    const { fixture, element, click } = setup();
    click('Play');
    for (let wrong = 0; wrong < 9; wrong++) {
      click('Cast spell 5');
      vi.advanceTimersByTime(1300);
      fixture.detectChanges();
    }
    expect(element.textContent).toContain('Try this wave again');
    expect(element.querySelector('[aria-label="0 hearts remaining out of three"]')).toBeTruthy();
    vi.advanceTimersByTime(60000);
    fixture.detectChanges();
    expect(element.textContent).toContain('Try this wave again');
    click('Try this wave again');
    expect(element.querySelector('.number-badge')?.textContent?.trim()).toBe('9');
    expect(element.querySelector('[aria-label="3 hearts remaining out of three"]')).toBeTruthy();
    expect(element.querySelectorAll('.ten-frame .filled')).toHaveLength(9);
    click('Cast spell 5');
    vi.advanceTimersByTime(1300);
    fixture.detectChanges();
    click('Pause');
    click('Hear the full explanation');
    expect(element.querySelector('.instruction')?.textContent).toContain(
      'This monster has 9 magic points.',
    );
    expect(sound.speak).toHaveBeenLastCalledWith(
      element.querySelector('.instruction')?.textContent?.trim(),
      true,
    );
  });
  it('cancels a pending turn on exit and remembers tutorial and audio preferences', () => {
    const { fixture, click } = setup();
    click('Play');
    click('Cast spell 1');
    const store = TestBed.inject(PlaytestStore);
    store.toggle('music');
    store.toggle('speech');
    fixture.destroy();
    vi.advanceTimersByTime(10000);
    expect(store.read('tutorial-seen')).toBe('true');
    expect(store.read('audio')).toContain('"music":false');
    const next = TestBed.createComponent(FairyDefenseComponent);
    next.detectChanges();
    const play = [...(next.nativeElement as HTMLElement).querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === 'Play',
    )!;
    play.click();
    next.detectChanges();
    expect(next.nativeElement.textContent).toContain('Count the empty spaces to make ten.');
    expect(
      next.nativeElement.querySelector('[aria-label="3 hearts remaining out of three"]'),
    ).toBeTruthy();
  });
  it('lets the child start any wave straight from the always-open wave grid', () => {
    const { fixture, element, click } = setup();
    const waveButtons = element.querySelectorAll<HTMLButtonElement>('.wave-path button');
    expect(waveButtons).toHaveLength(20);
    expect([...waveButtons].every((button) => !button.disabled)).toBe(true);
    expect(element.querySelector('details[open]')).toBeNull();
    expect(element.textContent).toContain('What do you want to play?');
    click('Wave 7');
    expect(element.textContent).toContain('Wave 7 of 20');
    expect(element.querySelector('.wave-path')).toBeNull();
    click('Pause');
    click('Choose a wave');
    fixture.detectChanges();
    expect(element.querySelectorAll('.wave-path button')).toHaveLength(20);
  });
  it('switches to a practice stage with one tap on its card', () => {
    const { fixture, element } = setup();
    const cards = element.querySelectorAll<HTMLInputElement>('.level-card input');
    expect(cards).toHaveLength(10);
    expect(cards[0].checked).toBe(true);
    expect(element.textContent).toContain('4 + □ = 9');
    cards[3].click();
    fixture.detectChanges();
    expect(element.querySelector('.level-card.selected')?.textContent).toContain('4 + □ = 9');
    expect(element.querySelector('.wave-path')).toBeNull();
    expect(element.querySelector('#campaign-math')).toBeNull();
    expect(element.textContent).toContain('Stage 3 / 9');
    cards[0].click();
    fixture.detectChanges();
    expect(element.querySelectorAll('.wave-path button')).toHaveLength(20);
  });
  it('has a complete translated game vocabulary', () => {
    for (const locale of Object.keys(gameMessages) as Locale[]) {
      expect(Object.keys(gameMessages[locale]).sort()).toEqual(Object.keys(gameMessages.en).sort());
      expect(Object.values(gameMessages[locale]).every((value) => value.trim().length > 0)).toBe(
        true,
      );
    }
  });
});
