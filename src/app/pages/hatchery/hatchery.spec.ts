import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { CrocodileGame } from '../crocodile/crocodile-game';
import { evaluate } from '../crocodile/comparison.fixture';
import { DRAGONS } from './dragons';
import { EggChip } from './egg-chip';
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
    expect(
      element.querySelector('app-egg-chip a[href="/hatchery"]')!.getAttribute('aria-label'),
    ).toBe('Dragon Hatchery. Dragon egg: 0 of 20 warm');
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
    expect(
      element.querySelector('app-egg-chip a[href="/hatchery"]')!.getAttribute('aria-label'),
    ).toBe('Dragon Hatchery. Dragon egg: 1 of 20 warm');
    expect(element.querySelector('app-egg-chip')!.classList).toContain('is-warming');
  });

  describe('once every dragon has hatched', () => {
    const everyone = DRAGONS.map((dragon) => dragon.id);
    const save = (extra: Record<string, unknown> = {}) =>
      localStorage.setItem(
        'feenland.hatchery',
        JSON.stringify({
          version: 1,
          egg: 'ember',
          warmth: 0,
          hatched: everyone,
          hatches: 12,
          favorite: 'fern',
          answers: 600,
          growth: 0,
          ...extra,
        }),
      );
    const panelButton = (element: HTMLElement, text: string) =>
      [...element.querySelectorAll<HTMLButtonElement>('.panel button')].find((button) =>
        button.textContent!.includes(text),
      )!;
    const tapThrice = (fixture: { detectChanges(): void }, element: HTMLElement) => {
      for (let i = 0; i < 3; i++) {
        element.querySelector<HTMLButtonElement>('.egg-tap')!.click();
        fixture.detectChanges();
      }
    };

    it('evolves the favourite into a new form with right answers and three taps', () => {
      save();
      const store = TestBed.inject(HatcheryStore);
      const fixture = TestBed.createComponent(Hatchery);
      fixture.detectChanges();
      const element = fixture.nativeElement as HTMLElement;
      expect(element.querySelector('.intro p')!.textContent).toContain('evolve into new forms');
      expect(element.querySelector('.panel h2')!.textContent).toContain(
        'Fern is getting ready to evolve',
      );
      expect(element.querySelector('.panel .stage-line')!.textContent).toContain('Baby form');
      const meter = element.querySelector('[role="progressbar"]')!;
      expect(meter.getAttribute('aria-valuetext')).toBe('0 of 30 to evolve');
      expect(element.querySelector('.egg-tap')).toBeNull();

      store.warm(30);
      fixture.detectChanges();
      expect(element.querySelector('.panel h2')!.textContent).toContain('Fern is ready to evolve!');
      expect(element.querySelector('.egg-tap')!.getAttribute('aria-label')).toBe(
        'Help Fern evolve. 3 taps to go.',
      );
      expect(element.querySelector('.tap-hint')!.textContent).toContain('Tap Fern!');
      tapThrice(fixture, element);
      expect(element.querySelector('.badge')!.textContent).toContain('Evolved!');
      // A new form has a new name.
      expect(element.querySelector('.panel h2')!.textContent).toContain('Bramble');
      expect(element.querySelector('.panel')!.textContent).toContain('Fern evolved into Bramble!');
      expect(element.querySelector('[role="status"]')!.textContent).toContain(
        'Fern evolved into Bramble!',
      );
      expect(store.hatchery().stages).toEqual({ fern: 1 });
      expect(JSON.parse(localStorage.getItem('feenland.hatchery')!).stages).toEqual({ fern: 1 });

      panelButton(element, 'Back to the nest').click();
      fixture.detectChanges();
      expect(element.querySelector('[role="progressbar"]')!.getAttribute('aria-valuetext')).toBe(
        '0 of 50 to evolve',
      );
      expect(element.querySelector('.panel .stage-line')!.textContent).toContain('Young form');
      const card = element.querySelector('button.dragon-card.is-raising')!;
      expect(card.textContent).toContain('Bramble');
      expect(card.textContent).toContain('Evolving');
    });

    it('lets the child pick which dragon evolves next', () => {
      save();
      const store = TestBed.inject(HatcheryStore);
      const fixture = TestBed.createComponent(Hatchery);
      fixture.detectChanges();
      const element = fixture.nativeElement as HTMLElement;
      const puff = [...element.querySelectorAll<HTMLButtonElement>('button.dragon-card')].find(
        (card) => card.textContent!.includes('Puff'),
      )!;
      puff.click();
      fixture.detectChanges();
      panelButton(element, 'Evolve Puff next').click();
      fixture.detectChanges();
      expect(store.hatchery().raising).toBe('puff');
      expect(element.querySelector('.panel')!.textContent).toContain('Puff evolves next');
      expect(element.querySelector('[role="status"]')!.textContent).toBe('Puff evolves next');
    });

    it('says when a dragon reaches its final form and who is next', () => {
      save({ stages: { fern: 1 }, growth: 50 });
      const fixture = TestBed.createComponent(Hatchery);
      fixture.detectChanges();
      const element = fixture.nativeElement as HTMLElement;
      tapThrice(fixture, element);
      expect(element.querySelector('.panel')!.textContent).toContain(
        'Bramble evolved into Oakheart! Next up: Ember.',
      );
      expect(TestBed.inject(HatcheryStore).hatchery().raising).toBe('ember');
      expect(element.querySelector('.panel .stage-line')!.textContent).toContain('Final form');
    });

    it('shows the evolving dragon in the game header', () => {
      save({ growth: 5 });
      const fixture = TestBed.createComponent(EggChip);
      fixture.detectChanges();
      const element = fixture.nativeElement as HTMLElement;
      expect(element.querySelector('a')!.getAttribute('aria-label')).toBe(
        'Dragon Hatchery. Fern evolves: 5 of 30',
      );
      expect(element.querySelector('app-dragon-face')).not.toBeNull();
      expect(element.querySelector('app-egg-icon')).toBeNull();
      TestBed.inject(HatcheryStore).warm(25);
      fixture.detectChanges();
      expect(element.querySelector('a')!.getAttribute('aria-label')).toBe(
        'Dragon Hatchery. Fern is ready to evolve! Visit the hatchery.',
      );
      expect(element.querySelector('[aria-live]')!.textContent).toBe('Fern is ready to evolve!');
    });

    it('starts evolving when the last egg hatches', () => {
      save({
        hatched: everyone.filter((id) => id !== 'prism-starlight'),
        hatches: 11,
        egg: 'prism-starlight',
        warmth: 50,
      });
      const fixture = TestBed.createComponent(Hatchery);
      fixture.detectChanges();
      const element = fixture.nativeElement as HTMLElement;
      tapThrice(fixture, element);
      expect(element.querySelector('.panel')!.textContent).toContain(
        'All twelve dragons found! Now they can evolve.',
      );
      panelButton(element, 'Help Fern evolve').click();
      fixture.detectChanges();
      expect(element.querySelector('.panel h2')!.textContent).toContain(
        'Fern is getting ready to evolve',
      );
    });
  });

  it('has identical hatchery message keys for every language', () => {
    const keys = Object.keys(hatcheryTranslations.en).sort();
    for (const messages of Object.values(hatcheryTranslations))
      expect(Object.keys(messages).sort()).toEqual(keys);
  });
});
