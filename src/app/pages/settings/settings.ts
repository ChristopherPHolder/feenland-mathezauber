import { Component, computed, inject } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { ActivatedRoute, PRIMARY_OUTLET, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { LocaleService } from '../../core/locale';
import { Locale } from '../../core/messages';
import { Icon } from '../../shared/icon';
@Component({
  selector: 'app-settings',
  imports: [NgOptimizedImage, RouterLink, Icon],
  templateUrl: './settings.html',
  styleUrl: './settings.css',
})
export class Settings {
  protected readonly i = inject(LocaleService);
  private readonly router = inject(Router);
  private readonly query = toSignal(inject(ActivatedRoute).queryParamMap);
  protected readonly backTarget = computed(() => {
    const value = this.query()?.get('returnTo');
    if (!value?.startsWith('/') || value.startsWith('//')) return this.router.parseUrl('/');
    try {
      const target = this.router.parseUrl(value);
      return target.root.children[PRIMARY_OUTLET]?.segments[0]?.path === 'settings'
        ? this.router.parseUrl('/')
        : target;
    } catch {
      return this.router.parseUrl('/');
    }
  });
  protected readonly languages: readonly { id: Locale; name: string }[] = [
    { id: 'de', name: 'Deutsch' },
    { id: 'en', name: 'English' },
    { id: 'es', name: 'Español' },
    { id: 'fr', name: 'Français' },
  ];
}
