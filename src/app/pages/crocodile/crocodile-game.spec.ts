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
import { CrocodileGame } from './crocodile-game';
import { crocodileTranslations } from './crocodile-messages';
import { evaluate } from './comparison.fixture';

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
    for (let n = 0; n < 10; n++) {
      expect(element.textContent).toContain(`${n} of 10 snacks`);
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
      pick(element, question.answer === '=' ? '<' : '=');
      fixture.detectChanges();
      expect(element.querySelector('.slot-sign')?.textContent?.trim()).toBe(question.answer);
      vi.advanceTimersByTime(1400);
      fixture.detectChanges();
    }
    expect(seen).toEqual(new Set(['<', '=', '>']));
    expect(element.textContent).toContain(crocodileTranslations.en.done);
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
  it('shows help after a wrong pick, counts one mistake per snack and keeps the path gated', () => {
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
    expect(element.querySelectorAll('.stars .earned').length).toBe(1);
    expect(element.textContent).toContain(crocodileTranslations.en.oneStar);
    expect(element.querySelector('a[href="/adventure/crocodile-2"]')).toBeNull();
    const progress = TestBed.inject(ProgressService).progress();
    expect(progress.completed).toContain('crocodile-1');
    expect(progress.mastered).not.toContain('crocodile-1');
    expect(progress.stars?.['crocodile-1']).toBe(1);
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
  it('lists six chained levels and sends locked deep links back to the chapter', async () => {
    const h = await RouterTestingHarness.create('/worlds/numbers/chapters/compare-crocodile');
    expect(h.routeNativeElement?.querySelectorAll('.level-stop').length).toBe(6);
    expect(h.routeNativeElement?.querySelectorAll('a[href^="/adventure/crocodile-"]').length).toBe(
      1,
    );
    expect(h.routeNativeElement?.textContent).toContain(
      TestBed.inject(LocaleService).t('crocodilePlay'),
    );
    await h.navigateByUrl('/adventure/crocodile-2');
    expect(TestBed.inject(Router).url).toBe('/worlds/numbers/chapters/compare-crocodile');
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
        source: 'practice',
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
