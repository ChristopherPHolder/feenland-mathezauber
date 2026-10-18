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
    const h = await RouterTestingHarness.create('/worlds/missing-number');
    const href = h
      .routeNativeElement!.querySelector('a[href*="/chapters/"]')!
      .getAttribute('href')!;
    await h.navigateByUrl(href);
    expect(h.routeNativeElement?.querySelector('h1')?.textContent).toBe(
      TestBed.inject(LocaleService).t('firstSteps'),
    );
    expect(
      h.routeNativeElement?.querySelector(
        'a[href="/worlds/missing-number#missing-number-first-steps"]',
      ),
    ).toBeTruthy();
    expect(TestBed.inject(ProgressService).progress().mastered).toEqual([]);
  });
  it('explains unpublished chapters without launching them', async () => {
    const h = await RouterTestingHarness.create('/worlds/missing-number');
    const dialog = h.routeNativeElement!.querySelector('dialog')!;
    dialog.showModal = () => dialog.setAttribute('open', '');
    h.routeNativeElement!.querySelector<HTMLButtonElement>(
      '#missing-number-backwards button',
    )!.click();
    h.detectChanges();
    expect(dialog.textContent).toContain(TestBed.inject(LocaleService).t('backwardsDescription'));
    expect(dialog.querySelector('a')).toBeNull();
    await h.navigateByUrl('/worlds/missing-number/chapters/missing-number-backwards');
    expect(TestBed.inject(Router).url).toBe('/worlds');
  });
  it('keeps earned chapter awards when a new locked chapter is configured', async () => {
    const world = worlds[0];
    const level = world.chapters[0].levels[0];
    const newChapter = {
      id: 'new',
      title: 'backwards' as const,
      description: 'backwardsDescription' as const,
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
    const h = await RouterTestingHarness.create('/worlds/missing-number');
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
  });
});
