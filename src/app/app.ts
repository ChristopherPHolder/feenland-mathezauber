import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, take } from 'rxjs';
import { DOCUMENT, NgOptimizedImage } from '@angular/common';
import {
  afterNextRender,
  afterRenderEffect,
  Component,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import {
  Event,
  NavigationCancel,
  NavigationCancellationCode,
  NavigationEnd,
  NavigationError,
  NavigationSkipped,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { BootSplash } from './core/boot-splash';
import { LocaleService } from './core/locale';
import { ProgressService } from './core/progress';
import { MotionPreference } from './core/motion';
import { Icon } from './shared/icon';
import { warmThree } from './shared/three/warm-three';
@Component({
  selector: 'app-root',
  imports: [NgOptimizedImage, RouterLink, RouterLinkActive, RouterOutlet, Icon],
  template: `@if (started()) {
    @if (!focusedGame()) {
      <header class="site-header">
        <a class="wordmark" routerLink="/">
          <img ngSrc="/logo.svg" width="48" height="48" alt="" priority />
          <span class="brand-name">Feenland <span>Mathezauber</span></span>
        </a>
        <nav [attr.aria-label]="i.t('home')">
          <a
            routerLink="/"
            routerLinkActive="active"
            ariaCurrentWhenActive="page"
            [routerLinkActiveOptions]="{ exact: true }"
            ><app-icon kind="home" /><span>{{ i.t('home') }}</span></a
          ><a routerLink="/games" routerLinkActive="active" ariaCurrentWhenActive="page"
            ><app-icon kind="grid" /><span>{{ i.t('games') }}</span></a
          ><a routerLink="/hatchery" routerLinkActive="active" ariaCurrentWhenActive="page"
            ><app-icon kind="egg" /><span>{{ i.t('dragons') }}</span></a
          ><a
            class="settings-link"
            routerLink="/settings"
            [queryParams]="{ returnTo: settingsReturnTarget() }"
            routerLinkActive="active"
            ariaCurrentWhenActive="page"
            ><app-icon kind="gear" /><span>{{ i.t('settings') }}</span></a
          >
        </nav>
      </header>
    }
    <main [class.focused-game]="focusedGame()" #main tabindex="-1">
      <router-outlet (activate)="focusMain()" />
      @if (p.saveFailed()) {
        <p class="save-warning" role="status">{{ i.t('saved') }}</p>
      }
    </main>
    @if (!focusedGame()) {
      <footer>
        Feenland Mathezauber<span>{{ i.t('subtitle') }}</span>
      </footer>
    }
  }`,
})
export class App {
  protected readonly i = inject(LocaleService);
  protected readonly p = inject(ProgressService);
  private readonly router = inject(Router);
  /** Created at start so a saved calm-motion choice applies before any game draws. */
  private readonly motion = inject(MotionPreference);
  private readonly splash = inject(BootSplash);
  /**
   * The shell waits behind the index.html splash for the first navigation, so a game never
   * flashes the header before it takes the whole screen. The splash itself stays up until the
   * page has loaded inside its route shell (core/boot-splash).
   */
  protected readonly started = toSignal(
    this.router.events.pipe(
      filter(settles),
      take(1),
      map(() => true),
    ),
    { initialValue: false },
  );
  /** Game routes declare `focusedGame` so the shell steps aside and the game fills the screen. */
  protected readonly focusedGame = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => {
        let route = this.router.routerState.snapshot.root;
        while (route.firstChild) route = route.firstChild;
        return route.data['focusedGame'] === true;
      }),
    ),
    { initialValue: false },
  );
  protected settingsReturnTarget() {
    return this.router.url.startsWith('/settings') ? '/' : this.router.url;
  }
  private readonly main = viewChild<ElementRef<HTMLElement>>('main');
  constructor() {
    afterRenderEffect(() => {
      const main = this.main()?.nativeElement;
      if (main) this.splash.dismissWhenPageShows(main);
    });
    // Whatever page opened first, fetch Three.js while the child looks at it, so a game's 3D
    // loading scene is ready to show the moment they tap.
    const document = inject(DOCUMENT);
    afterNextRender(() => warmThree(document));
  }
  protected focusMain() {
    this.main()?.nativeElement.focus({ preventScroll: true });
  }
}

/** A navigation is over: it showed a page, failed, changed nothing, or was stopped for good. */
function settles(event: Event) {
  return (
    event instanceof NavigationEnd ||
    event instanceof NavigationError ||
    event instanceof NavigationSkipped ||
    (event instanceof NavigationCancel &&
      event.code !== NavigationCancellationCode.Redirect &&
      event.code !== NavigationCancellationCode.SupersededByNewNavigation)
  );
}
