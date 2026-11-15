import { Component } from '@angular/core';
import { RouteBlank } from '../../shared/loading/route-blank';
import { RouteLoader } from '../../shared/loading/route-loader';
import { routeShellStyles } from '../../shared/loading/route-shell';
import { WorldLoader } from '../../shared/three/three-stage';
import { TreasureLock } from './treasure-lock';
/** The treasure lock's small loading scene; `undefined` keeps the CSS loader. */
const loaderScene: WorldLoader<null> | undefined = undefined;

/**
 * A treasure lock level.
 * The route commits on the tap and shows this shell at once; the page's own code downloads
 * inside the `@defer` block, so it stays out of the first bundle.
 */
@Component({
  selector: 'app-lock-route',
  imports: [TreasureLock, RouteBlank, RouteLoader],
  template: `@defer (on immediate) {
      <app-treasure-lock animate.enter="is-route-enter" />
    } @placeholder {
      <app-route-blank tone="lock" />
    } @loading (after 120ms; minimum 400ms) {
      <app-route-loader tone="lock" [scene]="loaderScene" animate.leave="is-route-leave" />
    }`,
  styles: routeShellStyles,
  host: { class: 'is-route-tone', 'data-tone': 'lock' },
})
export class LockRoute {
  protected readonly loaderScene = loaderScene;
}
