import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';
import { LocaleService } from './core/locale';
import { ProgressService } from './core/progress';
import { WORLD_CATALOG, worlds } from './core/catalog';
import { translations, Locale } from './core/messages';
import { navigate, openRoute } from './testing/route-harness';
describe('Feenland navigation', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
  });
  it('marks only the current page in the header, for screen readers too', async () => {
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl('/games');
    await fixture.whenStable();
    const current = [...fixture.nativeElement.querySelectorAll('nav a[aria-current="page"]')];
    expect(current.map((link: HTMLAnchorElement) => link.getAttribute('href'))).toEqual(['/games']);
    expect(current[0].classList).toContain('active');
  });
  it('keeps the loading splash up until the first page itself is showing', async () => {
    const splash = document.createElement('div');
    splash.id = 'boot-splash';
    document.body.append(splash);
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('header, main, footer')).toBeNull();
    await TestBed.inject(Router).navigateByUrl('/games');
    await fixture.whenStable();
    for (const part of ['header', 'main', 'footer']) {
      expect(fixture.nativeElement.querySelector(part)).toBeTruthy();
    }
    const page = () =>
      fixture.nativeElement.querySelector('main a[href="/adventure/defend-fairy-castle"]');
    if (!page()) expect(document.getElementById('boot-splash')).toBe(splash);
    await vi.waitFor(async () => {
      await fixture.whenStable();
      expect(page()).toBeTruthy();
    });
    expect(document.getElementById('boot-splash')).toBeNull();
  });
  it('opens a game straight from the splash, with no header or footer flashing first', async () => {
    const fixture = TestBed.createComponent(App);
    const seen: boolean[] = [];
    const observer = new MutationObserver(() =>
      seen.push(!!fixture.nativeElement.querySelector('header, footer')),
    );
    observer.observe(fixture.nativeElement, { childList: true, subtree: true });
    await TestBed.inject(Router).navigateByUrl('/adventure/crocodile-1');
    await fixture.whenStable();
    observer.disconnect();
    expect(fixture.nativeElement.querySelector('main.focused-game')).toBeTruthy();
    expect(seen).not.toContain(true);
  });
  it('starts with real zero counts and recommends the first open game', async () => {
    const h = await openRoute('/');
    expect(h.routeNativeElement?.textContent).toContain('Feenland');
    expect([...h.routeNativeElement!.querySelectorAll('dd')].map((e) => e.textContent)).toEqual([
      '0',
      '0',
      '0',
    ]);
    expect(
      h.routeNativeElement?.querySelector('a[href="/adventure/defend-fairy-castle"]'),
    ).toBeTruthy();
    expect(TestBed.inject(ProgressService).progress().mastered).toEqual([]);
  });
  it('switches all locales immediately and persists preference without changing progress', async () => {
    const h = await openRoute('/settings');
    const i = TestBed.inject(LocaleService);
    const p = TestBed.inject(ProgressService);
    p.explore('tens');
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
    const mastered = worlds
      .flatMap((world) => world.chapters)
      .flatMap((chapter) => chapter.levels)
      .map((level) => level.id);
    localStorage.setItem(
      'feenland.progress',
      JSON.stringify({
        version: 1,
        mastered,
        chapters: ['earned-chapter'],
        explored: ['tens'],
      }),
    );
    const h = await openRoute('/');
    expect(h.routeNativeElement?.textContent).toContain(TestBed.inject(LocaleService).t('caught'));
    expect([...h.routeNativeElement!.querySelectorAll('dd')].map((e) => e.textContent)).toEqual([
      String(mastered.length),
      '1',
      '1',
    ]);
  });
  it('loads saved locale and redirects removed game URLs home', async () => {
    localStorage.setItem('feenland.locale', 'fr');
    const h = await openRoute('/games/number-bridge');
    expect(h.routeNativeElement?.textContent).toContain(translations.fr.welcome);
    await navigate(h, '/adventure/missing-number-add-to-30');
    expect(h.routeNativeElement?.textContent).toContain(translations.fr.welcome);
  });
  it('keeps navigation usable with corrupt progress', async () => {
    localStorage.setItem('feenland.progress', 'broken');
    const h = await openRoute('/');
    expect(h.routeNativeElement?.querySelector('h1')).toBeTruthy();
  });
  it('derives the Home recommendation label from the configured world', async () => {
    TestBed.overrideProvider(WORLD_CATALOG, {
      useValue: [
        { ...worlds.find((world) => world.id === 'numbers')!, id: 'new-world', title: 'tens' },
      ],
    });
    const h = await openRoute('/');
    expect(h.routeNativeElement?.querySelector('.adventure-actions small')?.textContent).toBe(
      TestBed.inject(LocaleService).t('tens'),
    );
  });
  it('has identical message keys for every language', () => {
    for (const locale of Object.keys(translations) as Locale[])
      expect(Object.keys(translations[locale]).sort()).toEqual(Object.keys(translations.en).sort());
  });
});
