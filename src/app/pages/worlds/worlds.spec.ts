import { worlds } from '../../core/preview-catalog.fixture';
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
} from '../../core/catalog';
import { ProgressService } from '../../core/progress';
import { LocaleService } from '../../core/locale';

const first = worlds.find((world) => world.id === 'missing-number')!;
const level = first.chapters[0].levels[0];
const gated: World = {
  ...worlds.find((world) => world.id === 'numbers')!,
  chapters: [{ id: 'gated', levels: [{ ...level, id: 'gated-level', prerequisites: [level.id] }] }],
};

describe('world availability', () => {
  it('derives soon, locked, available and completed from published content', () => {
    expect(worldState(worlds.find(world => world.id === 'subtraction')!, emptyProgress)).toBe('soon');
    expect(worldState(worlds.find(world => world.id === 'numbers')!, emptyProgress)).toBe('available');
    expect(worldState(gated, emptyProgress)).toBe('locked');
    expect(worldRequirements(gated, emptyProgress)[0].prerequisites).toEqual([level.id]);
    expect(worldState(first, emptyProgress)).toBe('available');
    const earned = { ...emptyProgress, mastered: [level.id, 'missing-number-subtract-to-30'] };
    expect(worldState(first, earned)).toBe('completed');
    expect(worldState(gated, earned)).toBe('available');
    expect(worldRequirements(gated, earned)).toEqual([]);
  });
  it('keeps alternative entry paths separate in locked previews', () => {
    const branch = {
      ...gated,
      chapters: [
        {
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
  it('reveals newly published content while retaining replay and earned achievements', () => {
    const earned = { ...emptyProgress, mastered: [level.id], chapters: ['earned'] };
    const expanded = {
      ...first,
      chapters: [{ ...first.chapters[0], levels: [level, { ...level, id: 'new' }] }],
    };
    expect(worldState(expanded, earned)).toBe('available');
    expect(
      worldState(
        {
          ...expanded,
          chapters: [
            { id: 'chapter', levels: [level, { ...level, id: 'new', prerequisites: ['other'] }] },
          ],
        },
        earned,
      ),
    ).toBe('available');
    expect(earned.chapters).toEqual(['earned']);
    expect(
      worldState(
        { ...first, chapters: [{ id: 'chapter', levels: [{ ...level, implemented: false }] }] },
        earned,
      ),
    ).toBe('soon');
  });
});

describe('World Map navigation', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), { provide: WORLD_CATALOG, useValue: worlds }],
    });
  });
  it('renders eleven localized destinations and routes through a world landing without earning mastery', async () => {
    const h = await RouterTestingHarness.create('/worlds');
    expect(h.routeNativeElement?.querySelectorAll('[data-world]').length).toBe(11);
    const link = h.routeNativeElement?.querySelector<HTMLAnchorElement>(
      '[data-world="missing-number"] a',
    );
    expect(link?.getAttribute('href')).toBe('/worlds/missing-number');
    await h.navigateByUrl(link!.getAttribute('href')!);
    expect(TestBed.inject(ProgressService).progress().explored).toEqual(['missing-number']);
    expect(TestBed.inject(ProgressService).progress().mastered).toEqual([]);
    expect(h.routeNativeElement?.querySelector('a[href="/worlds"]')).toBeTruthy();
    expect(
      h.routeNativeElement?.querySelector(
        'a[href="/worlds/missing-number/chapters/missing-number-first-steps"]',
      ),
    ).toBeTruthy();
    await h.navigateByUrl('/worlds');
    for (const locale of ['en', 'de', 'es', 'fr'] as const) {
      const i = TestBed.inject(LocaleService);
      i.select(locale);
      h.detectChanges();
      expect(h.routeNativeElement?.textContent).toContain(i.t('numbersPreview'));
    }
  });
  it('guards unknown, unpublished and locked world deep links', async () => {
    TestBed.overrideProvider(WORLD_CATALOG, { useValue: [first, gated, ...worlds.slice(2)] });
    const h = await RouterTestingHarness.create('/worlds/no-such-world');
    const router = TestBed.inject(Router);
    expect(router.url).toBe('/worlds');
    await h.navigateByUrl('/worlds/tens');
    expect(router.url).toBe('/worlds');
    await h.navigateByUrl('/worlds/numbers');
    expect(router.url).toBe('/worlds');
    expect(TestBed.inject(ProgressService).progress().explored).toEqual([]);
  });
  it('supports catalog additions without screen changes and renders locked explanations', async () => {
    TestBed.overrideProvider(WORLD_CATALOG, { useValue: [...worlds, { ...gated, id: 'extra' }] });
    const h = await RouterTestingHarness.create('/worlds');
    expect(h.routeNativeElement?.querySelectorAll('[data-world]').length).toBe(12);
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
      JSON.stringify({ ...emptyProgress, mastered: [level.id, 'missing-number-subtract-to-30'] }),
    );
    const h = await RouterTestingHarness.create('/worlds');
    expect(
      h.routeNativeElement?.querySelector('[data-world="missing-number"]')?.textContent,
    ).toContain(TestBed.inject(LocaleService).t('completed'));
    await h.navigateByUrl('/worlds/missing-number');
    expect(TestBed.inject(Router).url).toBe('/worlds/missing-number');
    expect(h.routeNativeElement?.textContent).toContain(
      TestBed.inject(LocaleService).t('worldCaught'),
    );
  });
});
