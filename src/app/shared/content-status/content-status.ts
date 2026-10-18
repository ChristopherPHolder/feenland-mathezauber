import { Component, computed, inject, input } from '@angular/core';
import { ContentState } from '../../core/catalog';
import { LocaleService } from '../../core/locale';
import { Icon } from '../icon';
@Component({
  selector: 'app-content-status',
  imports: [Icon],
  template: `<span
    class="status"
    [class.available]="state() === 'available'"
    [class.completed]="state() === 'completed'"
    [class.locked]="state() === 'locked'"
    ><app-icon [kind]="icon()" />{{ i.t(state()) }}</span
  >`,
  styles: `
    :host {
      display: inline-flex;
    }
    .status {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: var(--ink);
      font-size: 14px;
      line-height: 1.4;
    }
    app-icon {
      width: 20px;
      height: 20px;
    }
  `,
})
export class ContentStatus {
  readonly state = input.required<ContentState>();
  protected readonly i = inject(LocaleService);
  protected readonly icon = computed(
    () =>
      (({ soon: 'star', locked: 'lock', available: 'book', completed: 'cup' }) as const)[
        this.state()
      ],
  );
}
