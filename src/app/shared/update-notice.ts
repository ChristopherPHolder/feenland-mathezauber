import { Component, computed, inject } from '@angular/core';
import { AppUpdate } from '../core/app-update';
import { LocaleService } from '../core/locale';

const labels = {
  en: ['A new version is ready.', 'Reload to update'],
  de: ['Eine neue Version ist bereit.', 'Neu laden und aktualisieren'],
  es: ['Hay una nueva versión disponible.', 'Recargar para actualizar'],
  fr: ['Une nouvelle version est disponible.', 'Recharger pour mettre à jour'],
} as const;

@Component({
  selector: 'app-update-notice',
  template: `
    @if (updates.available()) {
      <aside role="status">
        <span>{{ text()[0] }}</span>
        <button type="button" (click)="updates.reload()">{{ text()[1] }}</button>
      </aside>
    }
  `,
  styles: `
    aside {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      padding: 1rem;
      background: #fff;
      color: #241438;
      border-bottom: 2px solid #68428c;
    }
    button {
      background: #563178;
      color: #fff;
      border: 0;
      border-radius: 0.5rem;
      padding: 0.75rem 1rem;
      font: inherit;
      cursor: pointer;
    }
    button:focus-visible {
      outline: 3px solid #241438;
      outline-offset: 3px;
    }
  `,
})
export class UpdateNotice {
  protected readonly updates = inject(AppUpdate);
  private readonly locale = inject(LocaleService);
  protected readonly text = computed(() => labels[this.locale.locale()]);
}
