import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { emptyProgress, WORLD_CATALOG, worlds } from '../../core/catalog';
import { LocaleService } from '../../core/locale';
import { ProgressService } from '../../core/progress';
const everyLevel = worlds.flatMap((world) => world.chapters).flatMap((chapter) => chapter.levels);
describe('Games hub', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    HTMLDialogElement.prototype.showModal = function () {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function () {
      this.open = false;
    };
  });
  it('lists every game and level as a direct play link for a brand-new player', async () => {
    const h = await RouterTestingHarness.create('/games');
    const page = h.routeNativeElement!;
    for (const chapter of worlds.flatMap((world) => world.chapters))
      expect(page.querySelector(`section#${chapter.id}`), chapter.id).toBeTruthy();
    for (const level of everyLevel)
      expect(
        page.querySelector(`a#${level.id}[href^="/adventure/${level.id}"]`),
        level.id,
      ).toBeTruthy();
    // Four magic-wall levels link straight into the wall game.
    expect(page.querySelectorAll('a[href^="/adventure/number-wall?level="]').length).toBe(4);
    expect(page.querySelector('[aria-label*="unlock" i], .locked')).toBeNull();
    expect(page.querySelector('.recommended')?.id).toBe('defend-fairy-castle');
    expect(TestBed.inject(ProgressService).progress().mastered).toEqual([]);
  });
  it('opens any level directly, in any order, without recording progress', async () => {
    const h = await RouterTestingHarness.create('/adventure/crocodile-6');
    const router = TestBed.inject(Router);
    expect(router.url).toBe('/adventure/crocodile-6');
    await h.navigateByUrl('/adventure/practice-30-9');
    expect(router.url).toBe('/adventure/practice-30-9');
    await h.navigateByUrl('/adventure/number-wall?level=4');
    expect(router.url).toBe('/adventure/number-wall?level=4');
    expect(h.routeNativeElement?.querySelector('.level-tag')?.textContent).toContain('4');
    expect(TestBed.inject(ProgressService).progress()).toEqual(emptyProgress);
  });
  it('sends old world and chapter links to the matching games-hub section', async () => {
    const h = await RouterTestingHarness.create('/worlds');
    const router = TestBed.inject(Router);
    expect(router.url).toBe('/games');
    await h.navigateByUrl('/worlds/numbers');
    expect(router.url).toBe('/games#numbers');
    await h.navigateByUrl('/worlds/numbers/chapters/compare-crocodile');
    expect(router.url).toBe('/games#compare-crocodile');
    expect(h.routeNativeElement?.querySelector('#compare-crocodile h2')?.textContent).toBe(
      TestBed.inject(LocaleService).t('crocodileChapter'),
    );
  });
  it('shows earned stars and mastery, and recommends the next unplayed level', async () => {
    localStorage.setItem(
      'feenland.progress',
      JSON.stringify({
        ...emptyProgress,
        completed: ['crocodile-1', 'crocodile-2'],
        mastered: ['crocodile-1'],
        stars: { 'crocodile-1': 3, 'crocodile-2': 1 },
      }),
    );
    const h = await RouterTestingHarness.create('/games');
    const page = h.routeNativeElement!;
    const i = TestBed.inject(LocaleService);
    expect(page.querySelector('#crocodile-1 .stars')?.getAttribute('aria-label')).toBe(
      i.t('starsOf', { n: 3 }),
    );
    expect(page.querySelector('#crocodile-1')?.classList.contains('mastered')).toBe(true);
    expect(page.querySelector('#crocodile-1')?.textContent).toContain(i.t('masteryEarned'));
    expect(page.querySelector('#crocodile-2')?.textContent).toContain(i.t('completedLabel'));
    expect(page.querySelector('#crocodile-3 .stars')?.getAttribute('aria-label')).toBe(
      i.t('starsOf', { n: 0 }),
    );
    // Every level stays a link, played or not.
    expect(page.querySelectorAll('#compare-crocodile a.level-card').length).toBe(
      worlds[0].chapters[1].levels.length,
    );
  });
  it('grows with the catalog without template changes', async () => {
    const numbers = worlds[0];
    TestBed.overrideProvider(WORLD_CATALOG, {
      useValue: [
        {
          ...numbers,
          chapters: [
            ...numbers.chapters,
            {
              id: 'new-game',
              title: 'numberWalls' as const,
              description: 'numberWallDescription' as const,
              emblem: '🧪',
              levels: [{ ...numbers.chapters[1].levels[0], id: 'new-level', format: 'other' }],
            },
          ],
        },
      ],
    });
    const h = await RouterTestingHarness.create('/games');
    expect(h.routeNativeElement?.querySelector('section#new-game')).toBeTruthy();
    expect(
      h.routeNativeElement?.querySelector('a#new-level[href="/adventure/new-level"]'),
    ).toBeTruthy();
    await h.navigateByUrl('/');
    expect(h.routeNativeElement?.querySelector('[data-game="new-game"]')).toBeTruthy();
  });
});
