import { Component } from '@angular/core';
import { RouteBlank } from '../../shared/loading/route-blank';
import { RouteLoader } from '../../shared/loading/route-loader';
import { routeShellStyles } from '../../shared/loading/route-shell';
import { Settings } from './settings';
/**
 * Settings.
 * The route commits on the tap and shows this shell at once; the page's own code downloads
 * inside the `@defer` block, so it stays out of the first bundle.
 */
@Component({
  selector: 'app-settings-route',
  imports: [Settings, RouteBlank, RouteLoader],
  template: `@defer (on immediate) {
      <app-settings animate.enter="is-route-enter" />
    } @placeholder {
      <app-route-blank />
    } @loading (after 120ms; minimum 400ms) {
      <app-route-loader animate.leave="is-route-leave" />
    }`,
  styles: routeShellStyles,
  host: { class: 'is-route-tone' },
})
export class SettingsRoute {}
