import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { LocaleService } from '../../core/locale';
import { Locale } from '../../core/messages';
import { ProgressService } from '../../core/progress';
import { GameAudio } from '../fairy-defense/game-audio';
import { relation, ROUND_SIZE } from './compare';
import { CrocodileComponent } from './crocodile.component';
import { crocMessages } from './crocodile-messages';
import { CrocodileStore, parseCrocodileSave } from './crocodile-store';
function evaluate(text: string): number {
  const [a, operator, b] = text.split(' ');
  if (!operator) return Number(a);
  return operator === '+' ? Number(a) + Number(b) : Number(a) - Number(b);
}
describe('Hungry crocodile game', () => {
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
    sessionStorage.clear();
    TestBed.configureTestingModule({
      imports: [CrocodileComponent],
      providers: [provideRouter([])],
    });
    TestBed.overrideComponent(CrocodileComponent, {
      set: { providers: [{ provide: GameAudio, useValue: sound }] },
    });
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
    vi.clearAllMocks();
  });
  function setup() {
    const fixture = TestBed.createComponent(CrocodileComponent);
    TestBed.inject(LocaleService).select('en');
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const button = (label: string) =>
      [...element.querySelectorAll('button')].find(
        (candidate) =>
          candidate.textContent?.trim() === label ||
          candidate.getAttribute('aria-label') === label ||
          candidate.getAttribute('aria-label')?.startsWith(label),
      );
    const click = (label: string) => {
      const target = button(label);
      expect(target, label).toBeTruthy();
      target!.click();
      fixture.detectChanges();
    };
    const sides = () => {
      const left = element.querySelector('.number-card.left .card-text')!.textContent!.trim();
      const right = element.querySelector('.number-card.right .card-text')!.textContent!.trim();
      return { left, right, answer: relation(evaluate(left), evaluate(right)) };
    };
    const labels = { '>': 'Greater than', '<': 'Less than', '=': 'Equal' } as const;
    const answerCorrectly = () => {
      click(labels[sides().answer]);
      vi.advanceTimersByTime(1500);
      fixture.detectChanges();
    };
    return { fixture, element, button, click, sides, answerCorrectly, labels };
  }
  it('opens only the first pond, clears it with three stars and records real progress', () => {
    const { element, button, click, answerCorrectly } = setup();
    const ponds = [...element.querySelectorAll<HTMLButtonElement>('.pond-card')];
    expect(ponds).toHaveLength(5);
    expect(ponds.map((pond) => pond.disabled)).toEqual([false, true, true, true, true]);
    click('Pond 1');
    expect(element.querySelectorAll('.fish-row')).toHaveLength(2);
    for (let question = 0; question < ROUND_SIZE; question++) answerCorrectly();
    expect(element.textContent).toContain('Pond cleared!');
    expect(element.textContent).toContain('10 of 10 right on the first try');
    expect(element.querySelector('.stars')?.getAttribute('aria-label')).toBe('3 of 3 stars');
    expect(button('Next pond')).toBeTruthy();
    expect(button('See your celebration')).toBeTruthy();
    expect(TestBed.inject(CrocodileStore).unlocked()).toBe(2);
    expect(JSON.parse(localStorage.getItem('feenland.crocodile.v1')!).stars).toEqual({ 1: 3 });
    const progress = TestBed.inject(ProgressService).progress();
    expect(progress.completed).toEqual(['hungry-crocodile']);
    expect(progress.stars?.['hungry-crocodile']).toBe(3);
    expect(progress.mastered).toEqual([]);
    click('Next pond');
    expect(element.textContent).toContain('Pond 2');
    expect(element.querySelectorAll('.fish-row')).toHaveLength(0);
  });
  it('shows counting help after a mistake, resets the streak and still lets the child finish', () => {
    const { fixture, element, click, sides, answerCorrectly, labels } = setup();
    click('Pond 1');
    answerCorrectly();
    answerCorrectly();
    expect(element.textContent).toContain('Streak: 2');
    const wrong = sides().answer === '=' ? '<' : '=';
    click(labels[wrong]);
    expect(element.textContent).toContain('Not quite');
    expect(element.querySelector('.answers')?.hasAttribute('disabled')).toBe(true);
    vi.advanceTimersByTime(900);
    fixture.detectChanges();
    expect(element.textContent).toContain('Streak: 0');
    expect(element.querySelector('.instruction')?.textContent).toContain('Count the fish');
    for (let question = 2; question < ROUND_SIZE; question++) answerCorrectly();
    expect(element.textContent).toContain('9 of 10 right on the first try');
    expect(element.querySelector('.stars')?.getAttribute('aria-label')).toBe('2 of 3 stars');
    expect(element.textContent).toContain('Best streak: 8');
  });
  it('explains calculations in the sum ponds and keeps locked ponds closed', () => {
    localStorage.setItem(
      'feenland.crocodile.v1',
      JSON.stringify({ version: 1, stars: { 1: 2, 2: 1 }, bestStreak: 4 }),
    );
    const { element, click } = setup();
    expect(TestBed.inject(CrocodileStore).unlocked()).toBe(3);
    expect(element.textContent).toContain('Best streak: 4');
    click('Pond 3');
    click('Show help');
    expect(element.querySelector('.calc')?.textContent).toMatch(/[+−].* = \d+/);
    expect(element.querySelector('.instruction')?.textContent).toContain('Work it out first');
  });
  it('answers with arrow keys and leaves a pond with Escape without saving anything', () => {
    const { fixture, element, click, sides } = setup();
    click('Pond 1');
    const expected = sides().answer;
    const key = expected === '>' ? 'ArrowLeft' : expected === '<' ? 'ArrowRight' : 'ArrowDown';
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    fixture.detectChanges();
    expect(element.textContent).toMatch(/Chomp!|Both the same!/);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(element.textContent).toContain('Choose a pond');
    expect(localStorage.getItem('feenland.crocodile.v1')).toBeNull();
    expect(localStorage.getItem('feenland.progress')).toBeNull();
  });
  it('recovers corrupt saves and never unlocks past a missing star', () => {
    expect(parseCrocodileSave(null)).toEqual({ version: 1, stars: {}, bestStreak: 0 });
    expect(parseCrocodileSave({ version: 1, stars: { 1: 3, 9: 3, 2: 7 }, bestStreak: -1 })).toEqual(
      { version: 1, stars: { 1: 3 }, bestStreak: 0 },
    );
    localStorage.setItem(
      'feenland.crocodile.v1',
      JSON.stringify({ version: 1, stars: { 1: 3, 3: 3, 4: 3, 5: 3 }, bestStreak: 2 }),
    );
    const store = TestBed.inject(CrocodileStore);
    expect(store.unlocked()).toBe(2);
    expect(store.mastered()).toBe(false);
  });
  it('has a complete translated vocabulary', () => {
    for (const locale of Object.keys(crocMessages) as Locale[]) {
      expect(Object.keys(crocMessages[locale]).sort()).toEqual(Object.keys(crocMessages.en).sort());
      expect(Object.values(crocMessages[locale]).every((value) => value.trim().length > 0)).toBe(
        true,
      );
    }
  });
});
