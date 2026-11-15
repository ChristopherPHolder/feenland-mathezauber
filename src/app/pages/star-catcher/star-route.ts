import { Component } from '@angular/core';
import { RouteBlank } from '../../shared/loading/route-blank';
import { RouteLoader } from '../../shared/loading/route-loader';
import { routeShellStyles } from '../../shared/loading/route-shell';
import { WorldLoader } from '../../shared/three/three-stage';
import { StarCatcher } from './star-catcher';
/** The star catcher’s small loading scene: Nova catches a falling star in her lantern net. */
const loaderScene: WorldLoader<null> | undefined = () =>
  import('./star-loader-world').then((m) => m.StarLoaderWorld);

/**
 * A star catcher level.
 * The route commits on the tap and shows this shell at once; the page's own code downloads
 * inside the `@defer` block, so it stays out of the first bundle.
 */
@Component({
  selector: 'app-star-route',
  imports: [StarCatcher, RouteBlank, RouteLoader],
  template: `@defer (on immediate) {
      <app-star-catcher animate.enter="is-route-enter" />
    } @placeholder {
      <app-route-blank tone="star" />
    } @loading (after 120ms; minimum 400ms) {
      <app-route-loader tone="star" [scene]="loaderScene" animate.leave="is-route-leave" />
    }`,
  styles: routeShellStyles,
  host: { class: 'is-route-tone', 'data-tone': 'star' },
})
export class StarRoute {
  protected readonly loaderScene = loaderScene;
}
