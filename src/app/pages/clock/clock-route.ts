import { Component } from '@angular/core';
import { RouteBlank } from '../../shared/loading/route-blank';
import { RouteLoader } from '../../shared/loading/route-loader';
import { routeShellStyles } from '../../shared/loading/route-shell';
import { WorldLoader } from '../../shared/three/three-stage';
import { Clock } from './clock';

/** The tower's small loading scene: a clock face whose hands sweep round while the bell swings. */
const loaderScene: WorldLoader<null> | undefined = () =>
  import('./clock-loader-world').then((m) => m.ClockLoaderWorld);

/**
 * A Clock Tower level.
 * The route commits on the tap and shows this shell at once; the page's own code downloads
 * inside the `@defer` block, so it stays out of the first bundle.
 */
@Component({
  selector: 'app-clock-route',
  imports: [Clock, RouteBlank, RouteLoader],
  template: `@defer (on immediate) {
      <app-clock animate.enter="is-route-enter" />
    } @placeholder {
      <app-route-blank tone="clock" />
    } @loading (after 120ms; minimum 400ms) {
      <app-route-loader tone="clock" [scene]="loaderScene" animate.leave="is-route-leave" />
    }`,
  styles: routeShellStyles,
  host: { class: 'is-route-tone', 'data-tone': 'clock' },
})
export class ClockRoute {
  protected readonly loaderScene = loaderScene;
}
