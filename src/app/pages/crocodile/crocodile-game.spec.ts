import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { routes } from '../../app.routes';
import { emptyProgress } from '../../core/catalog';
import { ProgressService } from '../../core/progress';
import { LocaleService } from '../../core/locale';
import { Locale } from '../../core/messages';
import { BUBBLE_PACE_KEY } from './bubble-pace';
import { CrocodileGame } from './crocodile-game';
import { crocodileTranslations } from './crocodile-messages';
import { evaluate } from './comparison.fixture';
import { SnackKind, snackPoints } from './crocodile-score';

const labels = {
  '>': 'Greater than. The crocodile eats the left side.',
  '=': 'Equal. The crocodile is full.',
  '<': 'Less than. The crocodile eats the right side.',
};
function current(element: HTMLElement) {
  const [left, right] = [...element.querySelectorAll('.side-text')].map((side) =>
    evaluate({ text: side.textContent!.trim(), value: 0 }),
  );
  return { left, right, answer: left < right ? '<' : left > right ? '>' : '=' } as const;
}
function pick(element: HTMLElement, sign: keyof typeof labels) {
  element.querySelector<HTMLButtonElement>(`button[aria-label="${labels[sign]}"]`)!.click();
}
describe('the hungry crocodile game', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({
      imports: [CrocodileGame],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ id: 'crocodile-1' })) },
        },
      ],
    });
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });
  it('teaches the trick, feeds ten snacks and records three stars for a flawless round', () => {
    const fixture = TestBed.createComponent(CrocodileGame);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain(crocodileTranslations.en.trick);
    expect(element.textContent).toContain('Level 1 of 6');
    element.querySelector<HTMLButtonElement>('.intro button')!.click();
    fixture.detectChanges();
    expect(TestBed.inject(ProgressService).progress().explored).toContain('numbers');
    expect(element.querySelectorAll('.choice').length).toBe(3);
    const seen = new Set<string>();
    let expectedScore = 0;
    for (let n = 0; n < 10; n++) {
      expect(element.textContent).toContain(`${n} of 10 snacks`);
      const board = element.querySelector<HTMLElement>('.board')!;
      const kind = board.dataset['snackKind'] as SnackKind;
      expect(kind).toBe(n === 9 ? 'boss' : kind);
      expectedScore += snackPoints(kind, n + 1);
      if (n === 9) expect(element.querySelector('.banner')?.textContent).toContain('big fish');
      const question = current(element);
      seen.add(question.answer);
      if (n === 0) {
        const key = { '<': 'ArrowRight', '>': 'ArrowLeft', '=': 'ArrowDown' }[question.answer];
        document.dispatchEvent(new KeyboardEvent('keydown', { key }));
      } else pick(element, question.answer);
      fixture.detectChanges();
      expect(element.querySelector('.slot-sign')?.textContent?.trim()).toBe(question.answer);
      expect(element.querySelector('.instruction')!.textContent).toContain(
        question.answer === '=' ? 'full' : 'bigger than',
      );
      expect(element.querySelector('.points-float')?.textContent).toBe(
        `+${snackPoints(kind, n + 1)}`,
      );
      if (n === 2)
        expect(element.querySelector('.banner')?.textContent).toContain('Three in a row');
      if (n === 5) expect(element.querySelector('.banner')?.textContent).toContain('frenzy');
      pick(element, question.answer === '=' ? '<' : '=');
      fixture.detectChanges();
      expect(element.querySelector('.slot-sign')?.textContent?.trim()).toBe(question.answer);
      vi.advanceTimersByTime(1400);
      fixture.detectChanges();
    }
    expect(seen).toEqual(new Set(['<', '=', '>']));
    expect(element.textContent).toContain(`Perfect pond! ${expectedScore} points.`);
    expect(element.querySelector('.score-line')?.textContent).toContain('New best score!');
    expect(element.querySelector('.hat-unlocked')?.textContent).toContain(
      'New hat for Kiki: Party hat!',
    );
    expect(element.querySelectorAll('.hat-slot.owned').length).toBe(1);
    expect(element.querySelectorAll('.confetti span').length).toBe(10);
    expect(JSON.parse(localStorage.getItem('feenland.crocodile-scores.v1')!).best).toEqual({
      'crocodile-1': expectedScore,
    });
    expect(element.querySelectorAll('.stars .earned').length).toBe(3);
    expect(element.querySelector('a.button.primary')!.getAttribute('href')).toBe(
      '/adventure/crocodile-2',
    );
    const progress = TestBed.inject(ProgressService).progress();
    expect(progress.mastered).toContain('crocodile-1');
    expect(progress.stars?.['crocodile-1']).toBe(3);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    element.querySelector<HTMLButtonElement>('button.button.secondary')!.click();
    expect(navigate).toHaveBeenCalledWith(['/complete', 'crocodile-1']);
  });
  it('shows help after a wrong pick, counts one mistake per snack and still offers the next level', () => {
    const fixture = TestBed.createComponent(CrocodileGame);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    element.querySelector<HTMLButtonElement>('.intro button')!.click();
    fixture.detectChanges();
    for (let n = 0; n < 10; n++) {
      const question = current(element);
      if (n < 3) {
        const wrong = (['<', '=', '>'] as const).filter((sign) => sign !== question.answer);
        pick(element, wrong[0]);
        fixture.detectChanges();
        expect(element.querySelector('.instruction')!.textContent).toContain('Try again');
        expect(element.querySelector('.slot-sign')).toBeNull();
        expect(element.querySelector('.bars')).not.toBeNull();
        vi.advanceTimersByTime(900);
        fixture.detectChanges();
        expect(element.querySelector('.instruction')!.textContent).toContain(
          `left side makes ${question.left}`,
        );
        pick(element, wrong[1]);
        fixture.detectChanges();
      }
      pick(element, question.answer);
      fixture.detectChanges();
      vi.advanceTimersByTime(1400);
      fixture.detectChanges();
    }
    expect(element.textContent).toContain('Mistakes: 3');
    expect(element.textContent).toContain(crocodileTranslations.en.done);
    expect(element.querySelector('.hat-unlocked')).toBeNull();
    expect(element.querySelectorAll('.hat-slot.owned').length).toBe(0);
    expect(element.querySelector('.confetti')).toBeNull();
    expect(element.querySelectorAll('.stars .earned').length).toBe(1);
    expect(element.textContent).toContain(crocodileTranslations.en.oneStar);
    expect(element.querySelector('a[href="/adventure/crocodile-2"]')).not.toBeNull();
    const progress = TestBed.inject(ProgressService).progress();
    expect(progress.completed).toContain('crocodile-1');
    expect(progress.mastered).not.toContain('crocodile-1');
    expect(progress.stars?.['crocodile-1']).toBe(1);
  });
  it('starts neutral, previews each direction and returns to neutral after a snack', () => {
    const fixture = TestBed.createComponent(CrocodileGame);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    element.querySelector<HTMLButtonElement>('.intro button')!.click();
    fixture.detectChanges();
    vi.advanceTimersByTime(20);
    fixture.detectChanges();
    expect(document.activeElement).not.toBe(element.querySelector('.choice'));
    expect(element.querySelector('.slot .front')).not.toBeNull();
    const left = element.querySelector<HTMLButtonElement>('.choice')!;
    left.dispatchEvent(new Event('focus'));
    fixture.detectChanges();
    expect(element.querySelector('.slot .profile.flip.open')).not.toBeNull();
    left.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(element.querySelector('.slot .front')).not.toBeNull();
    const right = element.querySelectorAll('.choice')[2];
    right.dispatchEvent(new Event('pointerenter'));
    fixture.detectChanges();
    expect(element.querySelector('.slot .profile.open:not(.flip)')).not.toBeNull();
    pick(element, current(element).answer);
    fixture.detectChanges();
    vi.advanceTimersByTime(1400);
    fixture.detectChanges();
    expect(element.querySelector('.slot .front')).not.toBeNull();
  });
  it('keeps the timer optional and lets a popped bubble recover on the same snack', async () => {
    const fixture = TestBed.createComponent(CrocodileGame);
    await vi.advanceTimersByTimeAsync(20);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector<HTMLInputElement>('input[value=normal]')!.checked).toBe(false);
    element.querySelector<HTMLInputElement>('input[value=normal]')!.click();
    element.querySelector<HTMLButtonElement>('.intro .primary')!.click();
    await vi.advanceTimersByTimeAsync(20);
    await fixture.whenStable();
    expect(element.querySelector('.bubble-seconds')!.textContent).toContain('15 s');
    vi.advanceTimersByTime(15100);
    await vi.advanceTimersByTimeAsync(20);
    await fixture.whenStable();
    expect(element.querySelector('.bubble-race.popped')).not.toBeNull();
    expect(element.querySelector('.instruction')!.textContent).toContain('Pop!');
    expect(element.querySelector('.bars')).not.toBeNull();
    vi.advanceTimersByTime(30000);
    await vi.advanceTimersByTimeAsync(20);
    await fixture.whenStable();
    expect(element.querySelector('.snack-count')!.textContent).toContain('0 of 10');
    pick(element, current(element).answer);
    await vi.advanceTimersByTimeAsync(20);
    await fixture.whenStable();
    vi.advanceTimersByTime(1400);
    await vi.advanceTimersByTimeAsync(20);
    await fixture.whenStable();
    expect(element.querySelector('.bubble-race.popped')).toBeNull();
    expect(element.querySelector('.bubble-seconds')!.textContent).toContain('15 s');
    element.querySelector<HTMLButtonElement>('.bubble-heading button')!.click();
    await vi.advanceTimersByTimeAsync(20);
    await fixture.whenStable();
    expect(element.querySelector('.bubble-race')).toBeNull();
    vi.advanceTimersByTime(30000);
    await vi.advanceTimersByTimeAsync(20);
    await fixture.whenStable();
    expect(element.querySelector('.snack-count')!.textContent).toContain('1 of 10');
  });
  it('freezes the bubble during chomping and cleans up when leaving the game', async () => {
    const fixture = TestBed.createComponent(CrocodileGame);
    await vi.advanceTimersByTimeAsync(20);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    element.querySelector<HTMLInputElement>('input[value=normal]')!.click();
    element.querySelector<HTMLButtonElement>('.intro .primary')!.click();
    await vi.advanceTimersByTimeAsync(20);
    await fixture.whenStable();
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    vi.advanceTimersByTime(30000);
    await vi.advanceTimersByTimeAsync(20);
    await fixture.whenStable();
    expect(element.querySelector('.bubble-seconds')!.textContent).toContain('15 s');
    hidden.mockReturnValue(false);
    document.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(5000);
    await vi.advanceTimersByTimeAsync(20);
    await fixture.whenStable();
    pick(element, current(element).answer);
    await vi.advanceTimersByTimeAsync(20);
    await fixture.whenStable();
    const remaining = element.querySelector('.bubble-seconds')!.textContent;
    vi.advanceTimersByTime(1000);
    await vi.advanceTimersByTimeAsync(20);
    await fixture.whenStable();
    expect(element.querySelector('.bubble-seconds')!.textContent).toBe(remaining);
    fixture.destroy();
    hidden.mockRestore();
    expect(() => vi.advanceTimersByTime(30000)).not.toThrow();
  });
  it.each([
    ['relaxed', 30, 45],
    ['normal', 15, 25],
    ['fast', 8, 15],
  ] as const)(
    'remembers %s across visits and uses its deadline for numbers and sums',
    async (pace, seconds, mathsSeconds) => {
      const fixture = TestBed.createComponent(CrocodileGame);
      await vi.advanceTimersByTimeAsync(20);
      await fixture.whenStable();
      const element = fixture.nativeElement as HTMLElement;
      element.querySelector<HTMLInputElement>(`input[value=${pace}]`)!.click();
      await vi.advanceTimersByTimeAsync(20);
      await fixture.whenStable();
      expect(localStorage.getItem(BUBBLE_PACE_KEY)).toBe(pace);
      fixture.destroy();
      const restored = TestBed.createComponent(CrocodileGame);
      await vi.advanceTimersByTimeAsync(20);
      await restored.whenStable();
      const game = restored.nativeElement as HTMLElement;
      expect(game.querySelector<HTMLInputElement>(`input[value=${pace}]`)!.checked).toBe(true);
      game.querySelector<HTMLButtonElement>('.intro .primary')!.click();
      await vi.advanceTimersByTimeAsync(20);
      await restored.whenStable();
      expect(game.querySelector('.bubble-seconds')!.textContent).toContain(`${seconds} s`);
      vi.advanceTimersByTime((seconds - 1) * 1000);
      await vi.advanceTimersByTimeAsync(20);
      await restored.whenStable();
      expect(game.querySelector('.bubble-race.popped')).toBeNull();
      vi.advanceTimersByTime(1200);
      await vi.advanceTimersByTimeAsync(20);
      await restored.whenStable();
      expect(game.querySelector('.bubble-race.popped')).not.toBeNull();
      game.querySelector<HTMLButtonElement>('.bubble-heading button')!.click();
      await vi.advanceTimersByTimeAsync(20);
      await restored.whenStable();
      expect(localStorage.getItem(BUBBLE_PACE_KEY)).toBe('off');
      expect(document.activeElement).toBe(game.querySelector('.choices'));
      restored.destroy();
      localStorage.setItem(BUBBLE_PACE_KEY, pace);
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [CrocodileGame],
        providers: [
          provideRouter([]),
          {
            provide: ActivatedRoute,
            useValue: { paramMap: of(convertToParamMap({ id: 'crocodile-3' })) },
          },
        ],
      });
      const maths = TestBed.createComponent(CrocodileGame);
      await vi.advanceTimersByTimeAsync(20);
      await maths.whenStable();
      const mathsGame = maths.nativeElement as HTMLElement;
      mathsGame.querySelector<HTMLButtonElement>('.intro .primary')!.click();
      await vi.advanceTimersByTimeAsync(20);
      await maths.whenStable();
      expect(mathsGame.querySelector('.bubble-seconds')!.textContent).toContain(
        `${mathsSeconds} s`,
      );
    },
  );
  it('recovers from an invalid saved pace and remains usable when storage is blocked', async () => {
    localStorage.setItem(BUBBLE_PACE_KEY, 'turbo');
    const fixture = TestBed.createComponent(CrocodileGame);
    await vi.advanceTimersByTimeAsync(20);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector<HTMLInputElement>('input[value=off]')!.checked).toBe(true);
    const save = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    try {
      element.querySelector<HTMLInputElement>('input[value=fast]')!.click();
      element.querySelector<HTMLButtonElement>('.intro .primary')!.click();
      await vi.advanceTimersByTimeAsync(20);
      await fixture.whenStable();
      expect(element.querySelector('.bubble-seconds')!.textContent).toContain('8 s');
    } finally {
      save.mockRestore();
    }
  });
  it('has identical crocodile message keys for every language', () => {
    for (const locale of Object.keys(crocodileTranslations) as Locale[])
      expect(Object.keys(crocodileTranslations[locale]).sort()).toEqual(
        Object.keys(crocodileTranslations.en).sort(),
      );
  });
});
describe('crocodile navigation', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
  });
  afterEach(() => TestBed.resetTestingModule());
  it('lists six open levels and sends unknown deep links home', async () => {
    const h = await RouterTestingHarness.create('/worlds/numbers/chapters/compare-crocodile');
    expect(h.routeNativeElement?.querySelectorAll('.level-stop').length).toBe(6);
    expect(h.routeNativeElement?.querySelectorAll('a[href^="/adventure/crocodile-"]').length).toBe(
      6,
    );
    expect(h.routeNativeElement?.textContent).toContain(
      TestBed.inject(LocaleService).t('crocodilePlay'),
    );
    await h.navigateByUrl('/adventure/crocodile-7');
    expect(TestBed.inject(Router).url).toBe('/');
    await h.navigateByUrl('/adventure/crocodile-1');
    expect(TestBed.inject(Router).url).toBe('/adventure/crocodile-1');
    expect(h.routeNativeElement?.textContent).toContain(crocodileTranslations.en.start);
  });
  it('recommends the next crocodile level after a mastered round', async () => {
    localStorage.setItem(
      'feenland.progress',
      JSON.stringify({
        ...emptyProgress,
        mastered: ['crocodile-1'],
        completed: ['crocodile-1'],
        stars: { 'crocodile-1': 2 },
      }),
    );
    sessionStorage.setItem(
      'feenland.result',
      JSON.stringify({
        levelId: 'crocodile-1',
        completed: true,
        mastered: true,
        stars: 2,
      }),
    );
    const h = await RouterTestingHarness.create('/complete/crocodile-1');
    expect(h.routeNativeElement?.querySelector('a.button.primary')?.getAttribute('href')).toBe(
      '/adventure/crocodile-2',
    );
    await h.navigateByUrl('/adventure/crocodile-2');
    expect(TestBed.inject(Router).url).toBe('/adventure/crocodile-2');
  });
});
