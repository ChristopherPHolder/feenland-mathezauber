import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { App } from '../../app';
import { routes } from '../../app.routes';
import { navigate, openRoute } from '../../testing/route-harness';
describe('Settings return navigation', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
  });
  it('links the shared Settings gear back to the current adventure', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const target = '/games';
    await TestBed.inject(Router).navigateByUrl(target);
    await fixture.whenStable();
    fixture.detectChanges();
    const href = fixture.nativeElement
      .querySelector('.settings-link')
      .getAttribute('href') as string;
    expect(new URL(href, 'http://localhost').searchParams.get('returnTo')).toBe(target);
  });
  it('preserves the originating games-hub level anchor', async () => {
    const target = '/games#crocodile-2';
    const h = await openRoute('/settings?returnTo=' + encodeURIComponent(target));
    expect(h.routeNativeElement?.querySelector('.back-link')?.getAttribute('href')).toBe(target);
  });
  it('uses Home for direct visits and external or recursive return targets', async () => {
    const h = await openRoute('/settings');
    for (const target of [
      '',
      '//example.com',
      'https://example.com',
      '/settings?returnTo=/settings',
      '/%73ettings',
      '/set%74ings',
      '/%zz',
    ]) {
      await navigate(h, '/settings?returnTo=' + encodeURIComponent(target));
      expect(h.routeNativeElement?.querySelector('.back-link')?.getAttribute('href')).toBe('/');
    }
  });
});

describe('Settings switches', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('calm-motion');
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
  });
  const switchFor = (page: HTMLElement, label: string) =>
    [...page.querySelectorAll<HTMLLabelElement>('.switch-row')]
      .find((row) => row.textContent?.includes(label))!
      .querySelector('input')!;
  it('turns music and sound effects off for every game', async () => {
    const h = await openRoute('/settings');
    const page = h.routeNativeElement!;
    expect(switchFor(page, 'Music').checked).toBe(true);
    switchFor(page, 'Music').click();
    switchFor(page, 'Sound effects').click();
    h.detectChanges();
    expect(JSON.parse(localStorage.getItem('feenland.playtest.audio')!)).toEqual({
      music: false,
      effects: false,
      speech: false,
    });
    expect(switchFor(page, 'Music').checked).toBe(false);
  });
  it('remembers calm motion and marks the whole page with it', async () => {
    const h = await openRoute('/settings');
    const page = h.routeNativeElement!;
    expect(switchFor(page, 'Calm motion').getAttribute('role')).toBe('switch');
    switchFor(page, 'Calm motion').click();
    h.detectChanges();
    await h.fixture.whenStable();
    expect(localStorage.getItem('feenland.calm-motion')).toBe('true');
    expect(document.documentElement.classList.contains('calm-motion')).toBe(true);
  });
});
