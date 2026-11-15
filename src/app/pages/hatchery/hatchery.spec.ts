import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { CrocodileGame } from '../crocodile/crocodile-game';
import { evaluate } from '../crocodile/comparison.fixture';
import { Hatchery } from './hatchery';
import { HatcheryStore } from './hatchery-store';
import { hatcheryTranslations } from './hatchery-messages';
import { COACH_KEY } from '../crocodile/coach-memory';

describe('the dragon hatchery', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    localStorage.setItem('feenland.locale', 'en');
    TestBed.configureTestingModule({
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

  it('shows the warmth of a cold egg and sends the child to the games to warm it', () => {
    const fixture = TestBed.createComponent(Hatchery);
    TestBed.inject(HatcheryStore).warm(7);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const meter = element.querySelector('[role="progressbar"]')!;
    expect(meter.getAttribute('aria-valuenow')).toBe('7');
    expect(meter.getAttribute('aria-valuemax')).toBe('20');
    expect(element.textContent).toContain('7 of 20 warm');
    expect(element.querySelector('.egg-tap')).toBeNull();
    expect(element.querySelector('a[href="/games"]')).not.toBeNull();
    expect(element.textContent).toContain('0 of 12 dragons found');
  });

  it('cracks a ready egg in three taps, hatches a dragon into the book and starts a new egg', () => {
    const store = TestBed.inject(HatcheryStore);
    store.warm(20);
    const inside = store.egg();
    const fixture = TestBed.createComponent(Hatchery);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Your egg is ready to hatch!');
    for (const hint of ['Tap the egg to crack it', '2 more taps', 'One more tap!']) {
      expect(element.querySelector('.tap-hint')!.textContent).toContain(hint);
      element.querySelector<HTMLButtonElement>('.egg-tap')!.click();
      fixture.detectChanges();
    }
    const name = store.name(inside);
    expect(element.querySelector('.badge')!.textContent).toContain('A new dragon hatched!');
    expect(element.querySelector('h2')!.textContent).toContain(name);
    expect(element.querySelector('[role="status"]')!.textContent).toContain(name);
    expect(store.hatchery().hatched).toEqual([inside.id]);
    expect(store.hatchery().favorite).toBe(inside.id);
    expect(store.hatchery().warmth).toBe(0);
    expect(element.textContent).toContain(`${name} is your favourite`);
    expect(element.textContent).toContain('1 of 12 dragons found');
    const card = element.querySelector<HTMLButtonElement>('button.dragon-card')!;
    expect(card.textContent).toContain(name);
    // Back to the next egg, which now needs a little more warmth.
    [...element.querySelectorAll<HTMLButtonElement>('.panel button')].at(-1)!.click();
    fixture.detectChanges();
    expect(element.textContent).toContain('0 of 30 warm');
    card.click();
    fixture.detectChanges();
    expect(card.getAttribute('aria-pressed')).toBe('true');
    expect(element.querySelector('.panel h2')!.textContent).toContain(name);
  });

  it('lets any found dragon become the favourite', () => {
    localStorage.setItem(
      'feenland.hatchery',
      JSON.stringify({
        version: 1,
        egg: 'puff',
        warmth: 3,
        hatched: ['ember', 'fern'],
        hatches: 2,
        favorite: 'ember',
        answers: 60,
      }),
    );
    const fixture = TestBed.createComponent(Hatchery);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelectorAll('button.dragon-card').length).toBe(2);
    expect(element.querySelectorAll('.is-mystery').length).toBe(10);
    element.querySelectorAll<HTMLButtonElement>('button.dragon-card')[1].click();
    fixture.detectChanges();
    element.querySelector<HTMLButtonElement>('.panel .secondary')!.click();
    fixture.detectChanges();
    expect(TestBed.inject(HatcheryStore).hatchery().favorite).toBe('fern');
    expect(JSON.parse(localStorage.getItem('feenland.hatchery')!).favorite).toBe('fern');
  });

  it('warms the egg with every right answer in a game', () => {
    localStorage.setItem(COACH_KEY, '1');
    const store = TestBed.inject(HatcheryStore);
    const fixture = TestBed.createComponent(CrocodileGame);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    element.querySelector<HTMLButtonElement>('.intro button')!.click();
    fixture.detectChanges();
    expect(element.querySelector('app-egg-chip [role="img"]')!.getAttribute('aria-label')).toBe(
      'Dragon egg: 0 of 20 warm',
    );
    const [left, right] = [...element.querySelectorAll('.side-text')].map((side) =>
      evaluate({ text: side.textContent!.trim(), value: 0 }),
    );
    const label =
      left > right
        ? 'Greater than. The crocodile eats the left side.'
        : left < right
          ? 'Less than. The crocodile eats the right side.'
          : 'Equal. The crocodile is full.';
    element.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!.click();
    fixture.detectChanges();
    expect(store.hatchery().warmth).toBe(1);
    expect(element.querySelector('app-egg-chip [role="img"]')!.getAttribute('aria-label')).toBe(
      'Dragon egg: 1 of 20 warm',
    );
    expect(element.querySelector('app-egg-chip')!.classList).toContain('is-warming');
  });

  it('has identical hatchery message keys for every language', () => {
    const keys = Object.keys(hatcheryTranslations.en).sort();
    for (const messages of Object.values(hatcheryTranslations))
      expect(Object.keys(messages).sort()).toEqual(keys);
  });
});
