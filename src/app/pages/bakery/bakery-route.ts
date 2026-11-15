import { Component } from '@angular/core';
import { RouteBlank } from '../../shared/loading/route-blank';
import { RouteLoader } from '../../shared/loading/route-loader';
import { routeShellStyles } from '../../shared/loading/route-shell';
import { WorldLoader } from '../../shared/three/three-stage';
import { Bakery } from './bakery';
/** The bakery's small loading scene: cookies pop onto a tray and slide into a glowing oven. */
const loaderScene: WorldLoader<null> | undefined = () =>
  import('./bakery-loader-world').then((m) => m.BakeryLoaderWorld);

/**
 * A bakery level.
 * The route commits on the tap and shows this shell at once; the page's own code downloads
 * inside the `@defer` block, so it stays out of the first bundle.
 */
@Component({
  selector: 'app-bakery-route',
  imports: [Bakery, RouteBlank, RouteLoader],
  template: `@defer (on immediate) {
      <app-bakery animate.enter="is-route-enter" />
    } @placeholder {
      <app-route-blank tone="bakery" />
    } @loading (after 120ms; minimum 400ms) {
      <app-route-loader tone="bakery" [scene]="loaderScene" animate.leave="is-route-leave" />
    }`,
  styles: routeShellStyles,
  host: { class: 'is-route-tone', 'data-tone': 'bakery' },
})
export class BakeryRoute {
  protected readonly loaderScene = loaderScene;
}
