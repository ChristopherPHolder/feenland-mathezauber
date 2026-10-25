import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { NgOptimizedImage } from '@angular/common';
import { Component, ElementRef, inject, viewChild } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { LocaleService } from './core/locale';
import { ProgressService } from './core/progress';
import { Icon } from './shared/icon';
@Component({
  selector: 'app-root',
  imports: [NgOptimizedImage, RouterLink, RouterLinkActive, RouterOutlet, Icon],
  template: `@if (!focusedGame()) {
      <header class="site-header">
        <a class="wordmark" routerLink="/">
          <img ngSrc="/logo.svg" width="48" height="48" alt="" priority />
          <span class="brand-name">Feenland <span>Mathezauber</span></span>
        </a>
        <nav [attr.aria-label]="i.t('home')">
          <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }"
            ><app-icon kind="home" /><span>{{ i.t('home') }}</span></a
          ><a routerLink="/games" routerLinkActive="active"
            ><app-icon kind="grid" /><span>{{ i.t('games') }}</span></a
          ><a
            class="settings-link"
            routerLink="/settings"
            [queryParams]="{ returnTo: settingsReturnTarget() }"
            routerLinkActive="active"
            [attr.aria-label]="i.t('settings')"
            ><app-icon kind="gear"
          /></a>
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
    }`,
})
export class App {
  protected readonly i = inject(LocaleService);
  protected readonly p = inject(ProgressService);
  private readonly router = inject(Router);
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
  protected focusMain() {
    this.main()?.nativeElement.focus({ preventScroll: true });
  }
}
