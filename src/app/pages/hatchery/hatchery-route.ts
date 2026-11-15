import { Component } from '@angular/core';
import { RouteBlank } from '../../shared/loading/route-blank';
import { RouteLoader } from '../../shared/loading/route-loader';
import { routeShellStyles } from '../../shared/loading/route-shell';
import { WorldLoader } from '../../shared/three/three-stage';
import { Hatchery } from './hatchery';
/** The dragon hatchery's small loading scene: an egg wobbling in its nest. */
const loaderScene: WorldLoader<null> | undefined = () =>
  import('./hatchery-loader-world').then((m) => m.HatcheryLoaderWorld);

/**
 * The dragon hatchery.
 * The route commits on the tap and shows this shell at once; the page's own code downloads
 * inside the `@defer` block, so it stays out of the first bundle.
 */
@Component({
  selector: 'app-hatchery-route',
  imports: [Hatchery, RouteBlank, RouteLoader],
  template: `@defer (on immediate) {
      <app-hatchery animate.enter="is-route-enter" />
    } @placeholder {
      <app-route-blank tone="hatchery" />
    } @loading (after 120ms; minimum 400ms) {
      <app-route-loader tone="hatchery" [scene]="loaderScene" animate.leave="is-route-leave" />
    }`,
  styles: routeShellStyles,
  host: { class: 'is-route-tone', 'data-tone': 'hatchery' },
})
export class HatcheryRoute {
  protected readonly loaderScene = loaderScene;
}
