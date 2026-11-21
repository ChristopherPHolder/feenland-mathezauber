import { Component, inject, input, output } from '@angular/core';
import { CoachDialog } from '@feenland/ui';
import { LocaleService } from '../../core/locale';
import { GondolaDemo } from './gondola-demo';
import { gondolaText, GondolaMessageKey } from './gondola-messages';

/**
 * "How to play" over the station: the demo film in the shared coach dialog. The ? button opens
 * it any time; the snow cloud waits while it is open.
 */
@Component({
  selector: 'app-gondola-coach',
  imports: [CoachDialog, GondolaDemo],
  template: `<ui-coach-dialog
    [heading]="t('demoTitle')"
    [goLabel]="t('coachGo')"
    (done)="done.emit()"
  >
    <app-gondola-demo [alternate]="alternate()" />
  </ui-coach-dialog>`,
})
export class GondolaCoach {
  private readonly i = inject(LocaleService);
  /** The turn on screen uses the film's usual numbers: show the other ones. */
  readonly alternate = input(false);
  readonly done = output<void>();

  protected t(key: GondolaMessageKey) {
    return gondolaText(this.i.locale(), key);
  }
}
