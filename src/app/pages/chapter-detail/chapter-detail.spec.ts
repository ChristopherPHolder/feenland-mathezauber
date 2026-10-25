import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { emptyProgress, WORLD_CATALOG, worlds } from '../../core/catalog';
import { LocaleService } from '../../core/locale';

const url = '/worlds/numbers/chapters/compare-crocodile';
const world = worlds.find((world) => world.id === 'numbers')!;
const chapter = world.chapters.find((chapter) => chapter.id === 'compare-crocodile')!;
describe('Chapter level selection', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
  });
  it('renders recommended and locked levels with different behavior', async () => {
    TestBed.overrideProvider(WORLD_CATALOG, {
      useValue: [
        {
          ...world,
          chapters: [
            {
              ...chapter,
              levels: chapter.levels.map((level, index) =>
                index === 1 ? { ...level, prerequisites: [chapter.levels[0].id] } : level,
              ),
            },
          ],
        },
      ],
    });
    const h = await RouterTestingHarness.create(url);
    expect(h.routeNativeElement?.querySelectorAll('.level-stop').length).toBe(
      chapter.levels.length,
    );
    expect(h.routeNativeElement?.querySelector('.recommended')?.id).toBe('crocodile-1');
    expect(h.routeNativeElement?.querySelector('a[href="/adventure/crocodile-1"]')).toBeTruthy();
    const dialog = h.routeNativeElement!.querySelector('dialog')!;
    dialog.showModal = () => dialog.setAttribute('open', '');
    h.routeNativeElement!.querySelector<HTMLButtonElement>('#crocodile-2 button')!.click();
    h.detectChanges();
    expect(dialog.textContent).toContain(TestBed.inject(LocaleService).t('prerequisiteHelp'));
    expect(dialog.textContent).toContain(TestBed.inject(LocaleService).t('crocodile1'));
    await h.navigateByUrl('/adventure/crocodile-2');
    expect(TestBed.inject(Router).url).toBe(url);
  });
  it('replays earned levels and recommends the next one', async () => {
    localStorage.setItem(
      'feenland.progress',
      JSON.stringify({
        ...emptyProgress,
        mastered: ['crocodile-1'],
        chapters: ['compare-crocodile'],
      }),
    );
    const h = await RouterTestingHarness.create(url);
    expect(h.routeNativeElement?.querySelector('.recommended')?.id).toBe('crocodile-2');
    expect(h.routeNativeElement?.textContent).toContain(
      TestBed.inject(LocaleService).t('chapterAward'),
    );
    expect(h.routeNativeElement?.querySelector('a[href="/adventure/crocodile-1"]')).toBeTruthy();
    await h.navigateByUrl('/adventure/crocodile-1');
    expect(TestBed.inject(Router).url).toBe('/adventure/crocodile-1');
  });
  it('renders additional levels through configuration without changing earned awards', async () => {
    TestBed.overrideProvider(WORLD_CATALOG, {
      useValue: [
        {
          ...world,
          chapters: [
            { ...chapter, levels: [...chapter.levels, { ...chapter.levels[0], id: 'new-level' }] },
          ],
        },
      ],
    });
    const h = await RouterTestingHarness.create(url);
    expect(h.routeNativeElement?.querySelectorAll('.level-stop').length).toBe(
      chapter.levels.length + 1,
    );
    expect(h.routeNativeElement?.querySelector('a[href="/adventure/new-level"]')).toBeTruthy();
  });
});
