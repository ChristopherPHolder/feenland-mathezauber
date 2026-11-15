import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { LocaleService } from '../../core/locale';
describe('Home game cards', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('feenland.locale', 'en');
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
  });
  it('counts the magic walls levels and stars the way the games hub shows them', async () => {
    localStorage.setItem(
      'feenland.number-wall.v1',
      JSON.stringify({
        version: 1,
        ratings: { 1: 3, 2: 1 },
        bestStreak: 0,
        gems: 0,
        pace: 'steady',
      }),
    );
    const h = await RouterTestingHarness.create('/');
    const card = h.routeNativeElement?.querySelector('[data-game="number-walls"]');
    const i = TestBed.inject(LocaleService);
    expect(card?.textContent).toContain(i.t('chapterStars', { n: 4, total: 33 }));
    expect(card?.textContent).toContain(i.t('allLevelsCount', { n: 11 }));
  });
  it('counts catalog levels for the other games', async () => {
    const h = await RouterTestingHarness.create('/');
    const card = h.routeNativeElement?.querySelector('[data-game="compare-crocodile"]');
    expect(card?.textContent).toContain(
      TestBed.inject(LocaleService).t('chapterStars', { n: 0, total: 42 }),
    );
  });
  it('offers one "All games" button, not a second link beside the games heading', async () => {
    const h = await RouterTestingHarness.create('/');
    const toHub = [...(h.routeNativeElement?.querySelectorAll('a') ?? [])].filter(
      (link) => link.getAttribute('href') === '/games',
    );
    expect(toHub.length).toBe(1);
  });
});
