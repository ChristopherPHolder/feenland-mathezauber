import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import {
  emptyProgress,
  WORLD_CATALOG,
  worldState,
  worldRequirements,
  World,
  worlds,
} from '../../core/catalog';
import { ProgressService } from '../../core/progress';
import { LocaleService } from '../../core/locale';

const numbers = worlds.find((world) => world.id === 'numbers')!;
const tens = worlds.find((world) => world.id === 'tens')!;
const level = numbers.chapters[0].levels[0];
const gated: World = {
  ...numbers,
  chapters: [
    {
      ...numbers.chapters[0],
      id: 'gated',
      levels: [{ ...level, id: 'gated-level', prerequisites: [level.id] }],
    },
  ],
};

describe('world availability', () => {
  it('derives locked, available and completed from a world’s levels', () => {
    expect(worldState(numbers, emptyProgress)).toBe('available');
    expect(worldState(gated, emptyProgress)).toBe('locked');
    expect(worldRequirements(gated, emptyProgress)[0].prerequisites).toEqual([level.id]);
    const earned = { ...emptyProgress, mastered: [level.id, 'number-wall'] };
    expect(worldState(tens, earned)).toBe('completed');
    expect(worldState(gated, earned)).toBe('available');
    expect(worldRequirements(gated, earned)).toEqual([]);
  });
  it('keeps alternative entry paths separate in locked previews', () => {
    const branch = {
      ...gated,
      chapters: [
        {
          ...gated.chapters[0],
          id: 'branch',
          levels: [
            { ...level, id: 'a', prerequisites: ['one', 'two'] },
            { ...level, id: 'b', prerequisites: ['three'] },
          ],
        },
      ],
    };
    expect(worldRequirements(branch, emptyProgress).map((entry) => entry.prerequisites)).toEqual([
      ['one', 'two'],
      ['three'],
    ]);
    expect(worldState(branch, { ...emptyProgress, mastered: ['three'] })).toBe('available');
  });
  it('keeps an earned world open when new locked levels arrive', () => {
    const earned = { ...emptyProgress, mastered: [level.id], chapters: ['earned'] };
    const expanded = {
      ...numbers,
      chapters: [
        {
          ...numbers.chapters[0],
          levels: [level, { ...level, id: 'new', prerequisites: ['other'] }],
        },
      ],
    };
    expect(worldState(expanded, earned)).toBe('available');
    expect(earned.chapters).toEqual(['earned']);
  });
});

describe('World Map navigation', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
  });
  it('renders every localized world and routes through a world landing without earning mastery', async () => {
    const h = await RouterTestingHarness.create('/worlds');
    expect(h.routeNativeElement?.querySelectorAll('[data-world]').length).toBe(worlds.length);
    const link = h.routeNativeElement?.querySelector<HTMLAnchorElement>('[data-world="numbers"] a');
    expect(link?.getAttribute('href')).toBe('/worlds/numbers');
    await h.navigateByUrl(link!.getAttribute('href')!);
    expect(TestBed.inject(ProgressService).progress().explored).toEqual(['numbers']);
    expect(TestBed.inject(ProgressService).progress().mastered).toEqual([]);
    expect(h.routeNativeElement?.querySelector('a[href="/worlds"]')).toBeTruthy();
    expect(
      h.routeNativeElement?.querySelector('a[href="/worlds/numbers/chapters/friends-of-ten"]'),
    ).toBeTruthy();
    await h.navigateByUrl('/worlds');
    for (const locale of ['en', 'de', 'es', 'fr'] as const) {
      const i = TestBed.inject(LocaleService);
      i.select(locale);
      h.detectChanges();
      expect(h.routeNativeElement?.textContent).toContain(i.t('numbersPreview'));
    }
  });
  it('guards unknown and locked world deep links', async () => {
    TestBed.overrideProvider(WORLD_CATALOG, { useValue: [gated, ...worlds.slice(1)] });
    const h = await RouterTestingHarness.create('/worlds/no-such-world');
    const router = TestBed.inject(Router);
    expect(router.url).toBe('/worlds');
    await h.navigateByUrl('/worlds/numbers');
    expect(router.url).toBe('/worlds');
    expect(TestBed.inject(ProgressService).progress().explored).toEqual([]);
  });
  it('supports catalog additions without screen changes and renders locked explanations', async () => {
    TestBed.overrideProvider(WORLD_CATALOG, { useValue: [...worlds, { ...gated, id: 'extra' }] });
    const h = await RouterTestingHarness.create('/worlds');
    expect(h.routeNativeElement?.querySelectorAll('[data-world]').length).toBe(worlds.length + 1);
    const button = h.routeNativeElement?.querySelector<HTMLButtonElement>(
      '[data-world="extra"] button',
    );
    expect(button?.textContent).toContain(TestBed.inject(LocaleService).t('unlock'));
    // Native modal focus and keyboard behavior are verified in a real browser.
    const dialog = h.routeNativeElement!.querySelector('dialog')!;
    dialog.showModal = () => dialog.setAttribute('open', '');
    button?.click();
    h.detectChanges();
    expect(dialog.textContent).toContain(TestBed.inject(LocaleService).t(level.title));
  });
  it('keeps completed worlds revisitable and reflects progress restored on reload', async () => {
    localStorage.setItem(
      'feenland.progress',
      JSON.stringify({ ...emptyProgress, mastered: ['number-wall'] }),
    );
    const h = await RouterTestingHarness.create('/worlds');
    expect(h.routeNativeElement?.querySelector('[data-world="tens"]')?.textContent).toContain(
      TestBed.inject(LocaleService).t('completed'),
    );
    await h.navigateByUrl('/worlds/tens');
    expect(TestBed.inject(Router).url).toBe('/worlds/tens');
    expect(h.routeNativeElement?.textContent).toContain(
      TestBed.inject(LocaleService).t('worldCaught'),
    );
  });
});
