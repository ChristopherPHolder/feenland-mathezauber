import { Component, inject, input } from '@angular/core';
import { LocaleService } from '../core/locale';
import { Icon } from './icon';
/** Three star slots with the earned ones filled, announced as one localized label. */
@Component({
  selector: 'app-star-rating',
  imports: [Icon],
  template: `<span class="stars" role="img" [attr.aria-label]="i.t('starsOf', { n: stars() })">
    @for (slot of slots; track slot) {
      <app-icon kind="star" [class.earned]="slot <= stars()" />
    }
  </span>`,
  styles: `
    :host {
      display: inline-flex;
    }
    .stars {
      display: inline-flex;
      gap: 3px;
      color: var(--star-empty);
    }
    app-icon {
      width: 22px;
      height: 22px;
    }
    app-icon.earned {
      color: var(--star-ink);
      fill: var(--star-fill);
    }
  `,
})
export class StarRating {
  readonly stars = input(0);
  protected readonly slots = [1, 2, 3];
  protected readonly i = inject(LocaleService);
}
