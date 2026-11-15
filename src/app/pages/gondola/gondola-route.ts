import { Component } from '@angular/core';
import { RouteBlank } from '../../shared/loading/route-blank';
import { RouteLoader } from '../../shared/loading/route-loader';
import { routeShellStyles } from '../../shared/loading/route-shell';
import { WorldLoader } from '../../shared/three/three-stage';
import { Gondola } from './gondola';
/** The gondola's small loading scene: a cabin glides up its cable with a bunny waving. */
const loaderScene: WorldLoader<null> | undefined = () =>
  import('./gondola-loader-world').then((m) => m.GondolaLoaderWorld);

/**
 * A mountain gondola level.
 * The route commits on the tap and shows this shell at once; the page's own code downloads
 * inside the `@defer` block, so it stays out of the first bundle.
 */
@Component({
  selector: 'app-gondola-route',
  imports: [Gondola, RouteBlank, RouteLoader],
  template: `@defer (on immediate) {
      <app-gondola animate.enter="is-route-enter" />
    } @placeholder {
      <app-route-blank tone="gondola" />
    } @loading (after 120ms; minimum 400ms) {
      <app-route-loader tone="gondola" [scene]="loaderScene" animate.leave="is-route-leave" />
    }`,
  styles: routeShellStyles,
  host: { class: 'is-route-tone', 'data-tone': 'gondola' },
})
export class GondolaRoute {
  protected readonly loaderScene = loaderScene;
}
