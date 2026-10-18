import { toSignal } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { NgOptimizedImage } from '@angular/common';
import { Component, computed, ElementRef, inject, viewChild } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { LocaleService } from './core/locale';
import { ProgressService } from './core/progress';
import { Icon } from './shared/icon';
@Component({
  selector: 'app-root',
  imports: [NgOptimizedImage, RouterLink, RouterLinkActive, RouterOutlet, Icon],
  template: ` @if (!focusedGame()) {
      <header class="site-header">
        <a class="wordmark" routerLink="/">
          <img ngSrc="/logo.svg" width="48" height="48" alt="" priority />
          <span class="brand-name">Feenland <span>Mathezauber</span></span>
        </a>
        <nav [attr.aria-label]="i.t('home')">
          <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">{{
            i.t('home')
          }}</a
          ><a routerLink="/worlds" routerLinkActive="active"
            ><app-icon kind="book" />{{ i.t('worlds') }}</a
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
  private readonly navigation = toSignal(
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)),
  );
  protected readonly focusedGame = computed(() => {
    this.navigation();
    return this.router.url.split('?')[0].split('#')[0] === '/adventure/defend-fairy-castle';
  });
  protected settingsReturnTarget() {
    return this.router.url.startsWith('/settings') ? '/' : this.router.url;
  }
  private readonly main = viewChild<ElementRef<HTMLElement>>('main');
  protected focusMain() {
    this.main()?.nativeElement.focus({ preventScroll: true });
  }
}
