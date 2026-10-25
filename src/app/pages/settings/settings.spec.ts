import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { App } from '../../app';
import { routes } from '../../app.routes';
describe('Settings return navigation', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
  });
  it('links the shared Settings gear back to the current adventure', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const target = '/worlds/numbers/chapters/compare-crocodile';
    await TestBed.inject(Router).navigateByUrl(target);
    await fixture.whenStable();
    fixture.detectChanges();
    const href = fixture.nativeElement
      .querySelector('.settings-link')
      .getAttribute('href') as string;
    expect(new URL(href, 'http://localhost').searchParams.get('returnTo')).toBe(target);
  });
  it('preserves the originating chapter and level anchor', async () => {
    const target = '/worlds/numbers/chapters/compare-crocodile#crocodile-2';
    const h = await RouterTestingHarness.create('/settings?returnTo=' + encodeURIComponent(target));
    expect(h.routeNativeElement?.querySelector('.back-link')?.getAttribute('href')).toBe(target);
  });
  it('uses Home for direct visits and external or recursive return targets', async () => {
    const h = await RouterTestingHarness.create('/settings');
    for (const target of [
      '',
      '//example.com',
      'https://example.com',
      '/settings?returnTo=/settings',
      '/%73ettings',
      '/set%74ings',
      '/%zz',
    ]) {
      await h.navigateByUrl('/settings?returnTo=' + encodeURIComponent(target));
      expect(h.routeNativeElement?.querySelector('.back-link')?.getAttribute('href')).toBe('/');
    }
  });
});
