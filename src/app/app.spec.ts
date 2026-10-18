import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';

describe('app routes', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter(routes)] }));

  it('offers every playable level on the landing page', async () => {
    const harness = await RouterTestingHarness.create('/');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain('What shall we');
    for (const path of ['/games/garden/little', '/games/garden/big', '/games/number-bridge']) {
      expect(harness.routeNativeElement?.querySelector(`a[href="${path}"]`)).toBeTruthy();
    }
  });

  it('opens each garden level with its selected difficulty and links back to the picker', async () => {
    const harness = await RouterTestingHarness.create('/games/garden/big');
    expect(harness.routeNativeElement?.querySelector('select')?.value).toBe('big');
    expect(harness.routeNativeElement?.querySelector('.equation')?.textContent).toContain('8');
    expect(harness.routeNativeElement?.querySelector('.all-games')?.getAttribute('href')).toBe('/');
    await harness.navigateByUrl('/games/garden/little');
    expect(harness.routeNativeElement?.querySelector('select')?.value).toBe('little');
    expect(harness.routeNativeElement?.querySelector('.equation')?.textContent).toContain('3');
  });

  it('preserves number bridge and recovers unknown URLs to the picker', async () => {
    const harness = await RouterTestingHarness.create('/games/number-bridge');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain(
      'Kleine Hüpfer.',
    );
    await harness.navigateByUrl('/unknown');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain('What shall we');
  });
});
