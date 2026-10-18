import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';
import { LocaleService } from './core/locale';
import { ProgressService } from './core/progress';
import { translations, Locale } from './core/messages';
describe('Feenland navigation', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
  });
  it('starts with real zero counts and routes to a labeled preview', async () => {
    const h = await RouterTestingHarness.create('/');
    expect(h.routeNativeElement?.textContent).toContain('Feenland');
    expect([...h.routeNativeElement!.querySelectorAll('dd')].map((e) => e.textContent)).toEqual([
      '0',
      '0',
      '0',
    ]);
    expect(
      h.routeNativeElement?.querySelector('a[href="/adventure/missing-number-add-to-30"]'),
    ).toBeTruthy();
    await h.navigateByUrl('/adventure/missing-number-add-to-30');
    expect(h.routeNativeElement?.textContent).toContain(
      TestBed.inject(LocaleService).t('placeholder'),
    );
    expect(TestBed.inject(ProgressService).progress().mastered).toEqual([]);
    expect(TestBed.inject(ProgressService).progress().explored).toEqual(['missing-number']);
  });
  it('switches all locales immediately and persists preference without changing progress', async () => {
    const h = await RouterTestingHarness.create('/settings');
    const i = TestBed.inject(LocaleService);
    const p = TestBed.inject(ProgressService);
    p.explore('missing-number');
    const before = JSON.stringify(p.progress());
    for (const locale of ['de', 'en', 'es', 'fr'] as const) {
      const button = h.routeNativeElement?.querySelector<HTMLButtonElement>(
        `button[lang="${locale}"]`,
      );
      button?.click();
      h.detectChanges();
      expect(h.routeNativeElement?.querySelector('h1')?.textContent).toBe(
        translations[locale].settings,
      );
      expect(document.documentElement.lang).toBe(locale);
      expect(localStorage.getItem('feenland.locale')).toBe(locale);
      expect(JSON.stringify(p.progress())).toBe(before);
    }
  });
  it('restores returning and caught-up players', async () => {
    localStorage.setItem(
      'feenland.progress',
      JSON.stringify({
        version: 1,
        mastered: ['missing-number-add-to-30', 'missing-number-subtract-to-30'],
        chapters: ['earned-chapter'],
        explored: ['missing-number'],
      }),
    );
    const h = await RouterTestingHarness.create('/');
    expect(h.routeNativeElement?.textContent).toContain(TestBed.inject(LocaleService).t('caught'));
    expect([...h.routeNativeElement!.querySelectorAll('dd')].map((e) => e.textContent)).toEqual([
      '2',
      '1',
      '1',
    ]);
  });
  it('loads saved locale and redirects removed game URLs home', async () => {
    localStorage.setItem('feenland.locale', 'fr');
    const h = await RouterTestingHarness.create('/games/number-bridge');
    expect(h.routeNativeElement?.textContent).toContain(translations.fr.welcome);
  });
  it('keeps navigation usable with corrupt progress', async () => {
    localStorage.setItem('feenland.progress', 'broken');
    const h = await RouterTestingHarness.create('/');
    expect(h.routeNativeElement?.querySelector('h1')).toBeTruthy();
  });
  it('has identical message keys for every language', () => {
    for (const locale of Object.keys(translations) as Locale[])
      expect(Object.keys(translations[locale]).sort()).toEqual(Object.keys(translations.en).sort());
  });
});
