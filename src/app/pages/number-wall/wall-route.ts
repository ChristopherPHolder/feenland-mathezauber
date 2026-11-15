import { Component } from '@angular/core';
import { RouteBlank } from '../../shared/loading/route-blank';
import { RouteLoader } from '../../shared/loading/route-loader';
import { routeShellStyles } from '../../shared/loading/route-shell';
import { WorldLoader } from '../../shared/three/three-stage';
import { NumberWallComponent } from './number-wall.component';
/** The number wall's small loading scene; `undefined` keeps the CSS loader. */
const loaderScene: WorldLoader<null> | undefined = undefined;

/**
 * The number wall.
 * The route commits on the tap and shows this shell at once; the page's own code downloads
 * inside the `@defer` block, so it stays out of the first bundle.
 */
@Component({
  selector: 'app-wall-route',
  imports: [NumberWallComponent, RouteBlank, RouteLoader],
  template: `@defer (on immediate) {
      <app-number-wall animate.enter="is-route-enter" />
    } @placeholder {
      <app-route-blank tone="wall" />
    } @loading (after 120ms; minimum 400ms) {
      <app-route-loader tone="wall" [scene]="loaderScene" animate.leave="is-route-leave" />
    }`,
  styles: routeShellStyles,
  host: { class: 'is-route-tone', 'data-tone': 'wall' },
})
export class WallRoute {
  protected readonly loaderScene = loaderScene;
}
