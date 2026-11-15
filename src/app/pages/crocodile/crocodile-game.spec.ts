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
/** Level 1 (numbers up to 20) is a quick-look level with a longer round. */
const SNACKS = 15;
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
    expect(element.textContent).toContain('Level 2 of 17');
    element.querySelector<HTMLButtonElement>('.intro button')!.click();
    fixture.detectChanges();
    expect(TestBed.inject(ProgressService).progress().explored).toContain('numbers');
    expect(element.querySelectorAll('.choice').length).toBe(3);
    const seen = new Set<string>();
    let expectedScore = 0;
    for (let n = 0; n < SNACKS; n++) {
      expect(element.textContent).toContain(`${n} of ${SNACKS} snacks`);
      const board = element.querySelector<HTMLElement>('.board')!;
      const kind = board.dataset['snackKind'] as SnackKind;
      expect(kind).toBe(n === SNACKS - 1 ? 'boss' : kind);
      expectedScore += snackPoints(kind, n + 1);
      if (n === SNACKS - 1)
        expect(element.querySelector('.banner')?.textContent).toContain('big fish');
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
    const unlocked = element.querySelector('.hat-unlocked')!;
    expect(unlocked.textContent).toContain('New hat for Kiki!');
    expect(unlocked.querySelector('strong')?.textContent).toBe('Party hat');
    // Kiki shows off the new hat in the reveal, and three filled stars land one after another.
    expect(unlocked.querySelector('app-crocodile svg.front')).not.toBeNull();
    expect(element.querySelectorAll('.stars .star.earned').length).toBe(3);
    expect(element.querySelectorAll('.hat-slot.owned').length).toBe(1);
    expect(element.querySelectorAll('.confetti span').length).toBe(SNACKS);
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
    for (let n = 0; n < SNACKS; n++) {
      const question = current(element);
      if (n < 3) {
        const wrong = (['<', '=', '>'] as const).filter((sign) => sign !== question.answer);
        pick(element, wrong[0]);
        fixture.detectChanges();
        const instruction = () => element.querySelector('.instruction')!.textContent!;
        // A real space after "Try again!", so the inline phone-landscape card and screen readers
        // never run it into the rule.
        expect(instruction()).toMatch(/Try again! \S/);
        // Level 1 starts with Kiki's rule, whatever the right answer is.
        expect(instruction()).toContain(crocodileTranslations.en.ruleBigger);
        expect(element.querySelector('app-rule-hint .picture')).not.toBeNull();
        expect(element.querySelector('.slot-sign')).toBeNull();
        vi.advanceTimersByTime(900);
        fixture.detectChanges();
        // The rule stays up for the retry and never gives the worked-out values away.
        expect(element.querySelector('.bars')).toBeNull();
        expect(element.querySelector('.side-value')).toBeNull();
        expect(instruction()).toContain(crocodileTranslations.en.ruleBigger);
        expect(instruction()).not.toMatch(/\d/);
        pick(element, wrong[1]);
        fixture.detectChanges();
        // A second wrong pick offers a different way to compare, still without numbers.
        expect(instruction()).toContain(crocodileTranslations.en.ruleCountUp);
        expect(instruction()).not.toMatch(/\d{2}|[02-9]/);
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
  it('keeps the 2D pond inside the 3D stage wherever WebGL is missing', () => {
    const fixture = TestBed.createComponent(CrocodileGame);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    element.querySelector<HTMLButtonElement>('.intro button')!.click();
    fixture.detectChanges();
    const pond = element.querySelector('.board.pond')!;
    expect(pond.classList).not.toContain('in-3d');
    expect(pond.querySelector('app-three-stage canvas')?.getAttribute('aria-hidden')).toBe('true');
    expect(pond.querySelector('app-three-stage app-pond-scene')).not.toBeNull();
    expect(pond.querySelectorAll('button[data-side]').length).toBe(3);
  });
  it('puts a coin on each golden pad that shows what a first try is worth', () => {
    const fixture = TestBed.createComponent(CrocodileGame);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    element.querySelector<HTMLButtonElement>('.intro button')!.click();
    fixture.detectChanges();
    const coins = () =>
      [...element.querySelectorAll('.side .coin')].map((c) => c.getAttribute('data-points'));
    let golden = 0;
    for (let n = 0; n < SNACKS; n++) {
      const kind = element.querySelector<HTMLElement>('.board')!.dataset['snackKind'];
      const question = current(element);
      if (kind === 'golden') {
        golden++;
        // Every earlier snack was a first try, so the coin carries the combo with it.
        const promised = `+${snackPoints('golden', n + 1)}`;
        expect(coins()).toEqual([promised, promised]);
        expect(element.querySelector('.board')!.classList.contains('frenzy')).toBe(n >= 6);
        // The coins are decoration: the pads keep their plain spoken names.
        expect(element.querySelector('.side')!.getAttribute('aria-label')).not.toContain('+');
      } else expect(coins()).toEqual([]);
      pick(element, question.answer);
      fixture.detectChanges();
      vi.advanceTimersByTime(1400);
      fixture.detectChanges();
    }
    expect(golden).toBe(2);
  });
  it('drops the golden coin back to base points after a wrong pick', () => {
    const fixture = TestBed.createComponent(CrocodileGame);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    element.querySelector<HTMLButtonElement>('.intro button')!.click();
    fixture.detectChanges();
    for (let n = 0; n < SNACKS; n++) {
      const question = current(element);
      if (element.querySelector<HTMLElement>('.board')!.dataset['snackKind'] === 'golden') {
        pick(element, question.answer === '=' ? '<' : '=');
        fixture.detectChanges();
        const coin = element.querySelector('.side .coin')!;
        expect(coin.getAttribute('data-points')).toBe(`+${snackPoints('golden', 0)}`);
        return;
      }
      pick(element, question.answer);
      fixture.detectChanges();
      vi.advanceTimersByTime(1400);
      fixture.detectChanges();
    }
    throw new Error('no golden snack in the round');
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
    expect(element.querySelector('.slot .waiting')).not.toBeNull();
    const left = element.querySelector<HTMLButtonElement>('.choice')!;
    left.dispatchEvent(new Event('focus'));
    fixture.detectChanges();
    expect(element.querySelector('.slot .profile.flip.open')).not.toBeNull();
    left.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(element.querySelector('.slot .waiting')).not.toBeNull();
    const right = element.querySelectorAll('.choice')[2];
    right.dispatchEvent(new Event('pointerenter'));
    fixture.detectChanges();
    expect(element.querySelector('.slot .profile.open:not(.flip)')).not.toBeNull();
    pick(element, current(element).answer);
    fixture.detectChanges();
    vi.advanceTimersByTime(1400);
    fixture.detectChanges();
    expect(element.querySelector('.slot .waiting')).not.toBeNull();
  });
  it('races the heron at the chosen pace: a slow snack is snatched, a quick one earns a bonus', () => {
    const fixture = TestBed.createComponent(CrocodileGame);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector<HTMLInputElement>('input[value=normal]')!.checked).toBe(false);
    element.querySelector<HTMLInputElement>('input[value=normal]')!.click();
    fixture.detectChanges();
    expect(localStorage.getItem(BUBBLE_PACE_KEY)).toBe('normal');
    element.querySelector<HTMLButtonElement>('.intro .primary')!.click();
    fixture.detectChanges();
    expect(element.querySelector('.banner')?.textContent).toContain('heron');
    const heron = element.querySelector<HTMLElement>('app-heron.flying')!;
    expect(heron).not.toBeNull();
    expect(heron.style.getPropertyValue('--flight')).toBe('15000ms');
    vi.advanceTimersByTime(15000);
    fixture.detectChanges();
    expect(element.querySelector('.instruction')!.textContent).toContain('snatched');
    expect(element.querySelector('app-heron.stole')).not.toBeNull();
    if (current(element).answer !== '=')
      expect(element.querySelector('.side.snatched')).not.toBeNull();
    vi.advanceTimersByTime(1400);
    fixture.detectChanges();
    expect(element.querySelector('.snack-count')!.textContent).toContain(`1 of ${SNACKS}`);
    // Feeding Kiki right away beats the heron: full quick bonus on top of the base points.
    const kind = element.querySelector<HTMLElement>('.board')!.dataset['snackKind'] as SnackKind;
    pick(element, current(element).answer);
    fixture.detectChanges();
    expect(element.querySelector('.points-float')?.textContent).toBe(
      `+${snackPoints(kind, 1) + 20}`,
    );
    expect(element.querySelector('.instruction')!.textContent).toMatch(/points! Shoo, heron!/);
    expect(element.querySelector('app-heron.shooed')).not.toBeNull();
    vi.advanceTimersByTime(1400);
    fixture.detectChanges();
    for (let n = 2; n < SNACKS; n++) {
      pick(element, current(element).answer);
      fixture.detectChanges();
      vi.advanceTimersByTime(1400);
      fixture.detectChanges();
    }
    expect(element.textContent).toContain('The heron snatched 1 snacks.');
    expect(element.textContent).toContain('Mistakes: 1');
    expect(
      JSON.parse(localStorage.getItem('feenland.crocodile-scores.v1')!).best['crocodile-1/race'],
    ).toBeGreaterThan(0);
    expect(TestBed.inject(ProgressService).progress().stars?.['crocodile-1']).toBe(2);
  });
  it('remembers the pace, pauses the heron in a hidden tab and can send it away mid-round', () => {
    localStorage.setItem(BUBBLE_PACE_KEY, 'relaxed');
    const fixture = TestBed.createComponent(CrocodileGame);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector<HTMLInputElement>('input[value=relaxed]')!.checked).toBe(true);
    element.querySelector<HTMLButtonElement>('.intro .primary')!.click();
    fixture.detectChanges();
    expect(
      element.querySelector<HTMLElement>('app-heron.in-pond')!.style.getPropertyValue('--flight'),
    ).toBe('30000ms');
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    fixture.detectChanges();
    expect(element.querySelector('app-heron.paused')).not.toBeNull();
    vi.advanceTimersByTime(60000);
    fixture.detectChanges();
    expect(element.querySelector('app-heron.stole')).toBeNull();
    hidden.mockReturnValue(false);
    document.dispatchEvent(new Event('visibilitychange'));
    fixture.detectChanges();
    expect(element.querySelector('app-heron.paused')).toBeNull();
    vi.advanceTimersByTime(30000);
    fixture.detectChanges();
    expect(element.querySelector('app-heron.stole')).not.toBeNull();
    hidden.mockRestore();
    vi.advanceTimersByTime(1400);
    fixture.detectChanges();
    element.querySelector<HTMLButtonElement>('.heron-off')!.click();
    fixture.detectChanges();
    expect(localStorage.getItem(BUBBLE_PACE_KEY)).toBe('off');
    expect(element.querySelector('app-heron')).toBeNull();
    vi.advanceTimersByTime(60000);
    fixture.detectChanges();
    expect(element.querySelector('.snack-count')!.textContent).toContain(`1 of ${SNACKS}`);
    fixture.destroy();
    expect(() => vi.advanceTimersByTime(60000)).not.toThrow();
    // Sums get the longer maths time of the same pace.
    localStorage.setItem(BUBBLE_PACE_KEY, 'fast');
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
    maths.detectChanges();
    const mathsGame = maths.nativeElement as HTMLElement;
    mathsGame.querySelector<HTMLButtonElement>('.intro .primary')!.click();
    maths.detectChanges();
    expect(
      mathsGame.querySelector<HTMLElement>('app-heron.in-pond')!.style.getPropertyValue('--flight'),
    ).toBe('15000ms');
  });
  it('recovers from an invalid saved pace and remains usable when storage is blocked', () => {
    localStorage.setItem(BUBBLE_PACE_KEY, 'turbo');
    const fixture = TestBed.createComponent(CrocodileGame);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector<HTMLInputElement>('input[value=off]')!.checked).toBe(true);
    const save = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    try {
      element.querySelector<HTMLInputElement>('input[value=fast]')!.click();
      element.querySelector<HTMLButtonElement>('.intro .primary')!.click();
      fixture.detectChanges();
      expect(
        element.querySelector<HTMLElement>('app-heron.in-pond')!.style.getPropertyValue('--flight'),
      ).toBe('8000ms');
    } finally {
      save.mockRestore();
    }
  });
  it('feeds Kiki by tapping a lily pad or Kiki herself in the calm pond', () => {
    const fixture = TestBed.createComponent(CrocodileGame);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    element.querySelector<HTMLButtonElement>('.intro .primary')!.click();
    fixture.detectChanges();
    expect(element.querySelector('app-heron')).toBeNull();
    const question = current(element);
    const target = question.answer === '>' ? 'left' : question.answer === '<' ? 'right' : 'center';
    element.querySelector<HTMLButtonElement>(`[data-side="${target}"]`)!.click();
    fixture.detectChanges();
    expect(element.querySelector('.slot-sign')?.textContent?.trim()).toBe(question.answer);
    expect(element.querySelector('.points-float')?.textContent).toBe('+10');
  });
  it('shows a halving snack in the child’s language, with the word between the tiles', () => {
    TestBed.overrideProvider(ActivatedRoute, {
      useValue: { paramMap: of(convertToParamMap({ id: 'crocodile-15' })) },
    });
    TestBed.inject(LocaleService).select('de');
    const fixture = TestBed.createComponent(CrocodileGame);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    element.querySelector<HTMLButtonElement>('.intro button')!.click();
    fixture.detectChanges();
    const left = element.querySelector('[data-side="left"]')!;
    expect(left.querySelector('.side-text')?.textContent?.trim()).toMatch(/^½ von \d+$/);
    expect(
      [...left.querySelectorAll('.expression > span')].map((token) => token.className),
    ).toEqual(['tile', 'word', 'tile']);
    expect(left.querySelector('.word')?.textContent).toBe('von');
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
  it('lists seventeen open levels and sends unknown deep links home', async () => {
    const h = await RouterTestingHarness.create('/games#compare-crocodile');
    expect(
      h.routeNativeElement?.querySelectorAll('#compare-crocodile a[href^="/adventure/crocodile-"]')
        .length,
    ).toBe(17);
    expect(h.routeNativeElement?.querySelector('#compare-crocodile')?.textContent).toContain(
      TestBed.inject(LocaleService).t('crocodileChapter'),
    );
    await h.navigateByUrl('/adventure/crocodile-18');
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
