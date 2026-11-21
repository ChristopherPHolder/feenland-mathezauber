import { Component } from '@angular/core';
import { RouteBlank } from '../../shared/loading/route-blank';
import { RouteLoader } from '../../shared/loading/route-loader';
import { routeShellStyles } from '../../shared/loading/route-shell';
import { WorldLoader } from '../../shared/three/three-stage';
import { Scales } from './scales';
/** The kitchen's small loading scene: a brass balance rocking as weights drop onto it. */
const loaderScene: WorldLoader<null> | undefined = () =>
  import('./scales-loader-world').then((m) => m.ScalesLoaderWorld);

/**
 * A level of the Giant's Scales.
 * The route commits on the tap and shows this shell at once; the page's own code downloads
 * inside the `@defer` block, so it stays out of the first bundle.
 */
@Component({
  selector: 'app-scales-route',
  imports: [Scales, RouteBlank, RouteLoader],
  template: `@defer (on immediate) {
      <app-scales animate.enter="is-route-enter" />
    } @placeholder {
      <app-route-blank tone="scales" />
    } @loading (after 120ms; minimum 400ms) {
      <app-route-loader tone="scales" [scene]="loaderScene" animate.leave="is-route-leave" />
    }`,
  styles: routeShellStyles,
  host: { class: 'is-route-tone', 'data-tone': 'scales' },
})
export class ScalesRoute {
  protected readonly loaderScene = loaderScene;
}
