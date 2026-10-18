import { worlds } from '../../core/preview-catalog.fixture';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { emptyProgress, WORLD_CATALOG } from '../../core/catalog';
import { LocaleService } from '../../core/locale';

const url = '/worlds/missing-number/chapters/missing-number-first-steps';
describe('Chapter level selection', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), { provide: WORLD_CATALOG, useValue: worlds }],
    });
  });
  it('renders recommended, locked and forthcoming levels with different behavior', async () => {
    const h = await RouterTestingHarness.create(url);
    expect(h.routeNativeElement?.querySelectorAll('.level-stop').length).toBe(3);
    expect(h.routeNativeElement?.querySelector('.recommended')?.id).toBe(
      'missing-number-add-to-30',
    );
    const dialog = h.routeNativeElement!.querySelector('dialog')!;
    dialog.showModal = () => dialog.setAttribute('open', '');
    h.routeNativeElement!.querySelector<HTMLButtonElement>(
      '#missing-number-subtract-to-30 button',
    )!.click();
    h.detectChanges();
    expect(dialog.textContent).toContain(TestBed.inject(LocaleService).t('prerequisiteHelp'));
    expect(dialog.textContent).toContain(TestBed.inject(LocaleService).t('level'));
    h.routeNativeElement!.querySelector<HTMLButtonElement>(
      '#missing-number-make-ten button',
    )!.click();
    h.detectChanges();
    expect(dialog.textContent).toContain(TestBed.inject(LocaleService).t('makeTenDescription'));
    expect(dialog.textContent).not.toContain(TestBed.inject(LocaleService).t('prerequisiteHelp'));
    await h.navigateByUrl('/adventure/missing-number-subtract-to-30');
    expect(TestBed.inject(Router).url).toBe('/');
  });
  it('replays earned levels, recommends newly unlocked ones and returns to the same level', async () => {
    localStorage.setItem(
      'feenland.progress',
      JSON.stringify({
        ...emptyProgress,
        mastered: ['missing-number-add-to-30'],
        chapters: ['missing-number-first-steps'],
      }),
    );
    const h = await RouterTestingHarness.create(url);
    expect(h.routeNativeElement?.querySelector('.recommended')?.id).toBe(
      'missing-number-subtract-to-30',
    );
    expect(h.routeNativeElement?.textContent).toContain(
      TestBed.inject(LocaleService).t('chapterAward'),
    );
    await h.navigateByUrl('/adventure/missing-number-add-to-30');
    expect(
      h.routeNativeElement?.querySelector(`a[href="${url}#missing-number-add-to-30"]`),
    ).toBeTruthy();
  });
  it('renders additional levels through configuration without changing earned awards', async () => {
    const world = worlds.find((world) => world.id === 'missing-number')!;
    const chapter = world.chapters[0];
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
    expect(h.routeNativeElement?.querySelectorAll('.level-stop').length).toBe(4);
    expect(h.routeNativeElement?.querySelector('a[href="/adventure/new-level"]')).toBeTruthy();
  });
});
