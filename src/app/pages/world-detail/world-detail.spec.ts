import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { chapterState, emptyProgress, WORLD_CATALOG, worlds } from '../../core/catalog';
import { LocaleService } from '../../core/locale';
import { ProgressService } from '../../core/progress';

describe('World chapter path', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
  });
  it('opens a distinct chapter route and preserves the chapter anchor on return', async () => {
    const h = await RouterTestingHarness.create('/worlds/numbers');
    const href = h
      .routeNativeElement!.querySelector('a[href*="/chapters/"]')!
      .getAttribute('href')!;
    await h.navigateByUrl(href);
    expect(h.routeNativeElement?.querySelector('h1')?.textContent).toBe(
      TestBed.inject(LocaleService).t('friendsOfTen'),
    );
    expect(
      h.routeNativeElement?.querySelector('a[href="/worlds/numbers#friends-of-ten"]'),
    ).toBeTruthy();
    expect(TestBed.inject(ProgressService).progress().mastered).toEqual([]);
  });
  it('explains locked chapters without launching them and keeps earned chapter awards', async () => {
    const world = worlds.find((world) => world.id === 'numbers')!;
    const level = world.chapters[0].levels[0];
    const newChapter = {
      id: 'new',
      title: 'numberWalls' as const,
      description: 'numberWallDescription' as const,
      levels: [
        { ...level, id: 'later', prerequisites: [level.id] },
        { ...level, id: 'alternative', prerequisites: ['unrelated-gate'] },
      ],
    };
    TestBed.overrideProvider(WORLD_CATALOG, {
      useValue: [{ ...world, chapters: [...world.chapters, newChapter] }],
    });
    localStorage.setItem(
      'feenland.progress',
      JSON.stringify({ ...emptyProgress, chapters: [world.chapters[0].id] }),
    );
    const h = await RouterTestingHarness.create('/worlds/numbers');
    expect(h.routeNativeElement?.querySelectorAll('.chapter-stop').length).toBe(3);
    expect(h.routeNativeElement?.textContent).toContain(
      TestBed.inject(LocaleService).t('chapterAward'),
    );
    expect(chapterState(newChapter, emptyProgress)).toBe('locked');
    const dialog = h.routeNativeElement!.querySelector('dialog')!;
    dialog.showModal = () => dialog.setAttribute('open', '');
    h.routeNativeElement!.querySelector<HTMLButtonElement>('#new button')!.click();
    h.detectChanges();
    expect(dialog.textContent).toContain(TestBed.inject(LocaleService).t(level.title));
    expect(dialog.textContent).not.toContain(TestBed.inject(LocaleService).t('unknownRequirement'));
    expect(dialog.querySelector('a')).toBeNull();
    await h.navigateByUrl('/worlds/numbers/chapters/new');
    expect(TestBed.inject(Router).url).toBe('/worlds');
  });
});
