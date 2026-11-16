import { Component, input } from '@angular/core';
import { Icon } from './icon';

/**
 * Three star slots with the earned ones filled, announced as one label. The caller words the
 * label in the reader's language, e.g. "2 of 3 stars".
 */
@Component({
  selector: 'ui-star-rating',
  imports: [Icon],
  template: `<span class="stars" role="img" [attr.aria-label]="label()">
    @for (slot of slots; track slot) {
      <ui-icon kind="star" [class.earned]="slot <= stars()" />
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
    ui-icon {
      width: 22px;
      height: 22px;
    }
    ui-icon.earned {
      color: var(--star-ink);
      fill: var(--star-fill);
    }
  `,
})
export class StarRating {
  /** Stars earned, 0 to 3. */
  readonly stars = input(0);
  /** What a screen reader hears for the whole row. */
  readonly label = input.required<string>();
  protected readonly slots = [1, 2, 3];
}
