import { Component } from '@angular/core';
import { RouteBlank } from '../../shared/loading/route-blank';
import { RouteLoader } from '../../shared/loading/route-loader';
import { routeShellStyles } from '../../shared/loading/route-shell';
import { WorldLoader } from '../../shared/three/three-stage';
import { Fireworks } from './fireworks';
/** The firework show's small loading scene: a rocket rises over the lake and blooms. */
const loaderScene: WorldLoader<null> | undefined = () =>
  import('./firework-loader-world').then((m) => m.FireworkLoaderWorld);

/**
 * A firework show level.
 * The route commits on the tap and shows this shell at once; the page's own code downloads
 * inside the `@defer` block, so it stays out of the first bundle.
 */
@Component({
  selector: 'app-firework-route',
  imports: [Fireworks, RouteBlank, RouteLoader],
  template: `@defer (on immediate) {
      <app-fireworks animate.enter="is-route-enter" />
    } @placeholder {
      <app-route-blank tone="fireworks" />
    } @loading (after 120ms; minimum 400ms) {
      <app-route-loader tone="fireworks" [scene]="loaderScene" animate.leave="is-route-leave" />
    }`,
  styles: routeShellStyles,
  host: { class: 'is-route-tone', 'data-tone': 'fireworks' },
})
export class FireworkRoute {
  protected readonly loaderScene = loaderScene;
}
