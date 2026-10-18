import { DOCUMENT } from '@angular/common';
import { computed, inject, Service, signal } from '@angular/core';
import { Locale, locales, MessageKey, translations } from './messages';
export function detectLocale(languages: readonly string[]): Locale {
  return (
    languages
      .map((language) => language.toLowerCase().split('-')[0])
      .find((language): language is Locale => locales.some((locale) => locale === language)) ?? 'en'
  );
}
@Service()
export class LocaleService {
  private readonly document = inject(DOCUMENT);
  private readonly selected = signal<Locale>(this.initial());
  readonly locale = this.selected.asReadonly();
  readonly messages = computed(() => translations[this.locale()]);
  constructor() {
    this.apply();
  }
  t(key: MessageKey): string {
    return this.messages()[key];
  }
  format(value: number): string {
    return new Intl.NumberFormat(this.locale()).format(value);
  }
  select(locale: Locale) {
    this.selected.set(locale);
    this.apply();
    try {
      this.document.defaultView?.localStorage.setItem('feenland.locale', locale);
    } catch {
      /* Preference remains usable in memory. */
    }
  }
  private initial(): Locale {
    try {
      const saved = this.document.defaultView?.localStorage.getItem('feenland.locale');
      if (locales.some((locale) => locale === saved)) return saved as Locale;
    } catch {
      /* Fall back to browser language. */
    }
    return detectLocale(this.document.defaultView?.navigator.languages ?? []);
  }
  private apply() {
    this.document.documentElement.lang = this.locale();
    this.document.title = 'Feenland Mathezauber';
  }
}
