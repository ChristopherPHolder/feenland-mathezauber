import { TestBed, DeferBlockBehavior, DeferBlockState } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { App } from '../../app';
import { routes } from '../../app.routes';
import { translations } from '../../core/messages';

describe('Route shells', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('feenland.locale', 'en');
    TestBed.configureTestingModule({
      providers: [provideRouter(routes)],
      deferBlockBehavior: DeferBlockBehavior.Manual,
    });
  });

  it('commits a game route at once with its loader, then hands over to the game', async () => {
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl('/adventure/crocodile-3');
    await fixture.whenStable();
    const page = fixture.nativeElement as HTMLElement;

    // The URL has changed and the shell is on screen before any game code has loaded.
    expect(TestBed.inject(Router).url).toBe('/adventure/crocodile-3');
    const shell = page.querySelector('app-crocodile-route')!;
    expect(shell).toBeTruthy();
    expect(page.querySelector('app-crocodile-game')).toBeNull();
    // A game fills the screen: the site header steps aside and focus lands on the page.
    expect(page.querySelector('.site-header')).toBeNull();
    expect(document.activeElement).toBe(page.querySelector('main'));

    // Manual defer mode steps through what the browser shows on its own: first a blank in the
    // game's colours, then the loader, then the game.
    const [block] = await fixture.getDeferBlocks();
    await block!.render(DeferBlockState.Placeholder);
    expect(shell.querySelector('app-route-blank')?.getAttribute('data-tone')).toBe('pond');
    await block!.render(DeferBlockState.Loading);
    await fixture.whenStable();
    const loader = shell.querySelector('app-route-loader')!;
    expect(loader.getAttribute('data-tone')).toBe('pond');
    expect(loader.querySelector('[role="status"]')).toBeTruthy();
    expect(loader.querySelector('.label')?.textContent?.trim()).toBe(translations.en.loading);

    await block!.render(DeferBlockState.Complete);
    await fixture.whenStable();
    expect(shell.querySelector('app-route-loader')).toBeNull();
    expect(shell.querySelector('app-crocodile-game')).toBeTruthy();
    expect(page.querySelectorAll('[role="status"]')).toHaveLength(
      shell.querySelectorAll('app-crocodile-game [role="status"]').length,
    );
  });

  it('keeps the header and the default colours for a page', async () => {
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl('/games');
    await fixture.whenStable();
    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector('.site-header')).toBeTruthy();
    expect(page.querySelector('app-games')).toBeNull();
    const [block] = await fixture.getDeferBlocks();
    await block!.render(DeferBlockState.Loading);
    expect(page.querySelector('app-games-route app-route-loader')?.getAttribute('data-tone')).toBe(
      'default',
    );
    expect(page.querySelector('app-route-loader canvas')).toBeNull();
    await block!.render(DeferBlockState.Complete);
    expect(page.querySelector('app-games-route app-games')).toBeTruthy();
  });
});
