import { Component, inject } from '@angular/core';
import { LocaleService } from '../../core/locale';
import { Locale } from '../../core/messages';
@Component({
  selector: 'app-settings',
  template: `<section class="page narrow">
    <h1>{{ i.t('settings') }}</h1>
    <section class="panel">
      <h2 id="language-title">{{ i.t('language') }}</h2>
      <p>{{ i.t('languageHelp') }}</p>
      <div class="languages" role="group" aria-labelledby="language-title">
        @for (language of languages; track language.id) {
          <button
            [attr.lang]="language.id"
            [attr.aria-pressed]="i.locale() === language.id"
            (click)="i.select(language.id)"
          >
            {{ language.name
            }}<span aria-hidden="true">{{ i.locale() === language.id ? '✓' : '›' }}</span>
          </button>
        }
      </div>
    </section>
    <section class="about">
      <h2>{{ i.t('about') }}</h2>
      <p>{{ i.t('aboutText') }}</p>
    </section>
  </section>`,
})
export class Settings {
  protected readonly i = inject(LocaleService);
  protected readonly languages: readonly { id: Locale; name: string }[] = [
    { id: 'de', name: 'Deutsch' },
    { id: 'en', name: 'English' },
    { id: 'es', name: 'Español' },
    { id: 'fr', name: 'Français' },
  ];
}
