import { Component, input } from '@angular/core';
import { routeTones } from './route-tones';

/**
 * The first moments of a page load: an empty box in the game's colours. A quick load swaps it
 * for the page before a loader would flash; a slow one turns it into `<app-route-loader>`.
 */
@Component({
  selector: 'app-route-blank',
  template: '',
  styles: routeTones,
  host: { class: 'is-route-tone', '[attr.data-tone]': 'tone()' },
})
export class RouteBlank {
  readonly tone = input<string>('default');
}
