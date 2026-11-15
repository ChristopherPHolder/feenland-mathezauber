import { Component } from '@angular/core';
import { RouteBlank } from '../../shared/loading/route-blank';
import { RouteLoader } from '../../shared/loading/route-loader';
import { routeShellStyles } from '../../shared/loading/route-shell';
import { WorldLoader } from '../../shared/three/three-stage';
import { CrocodileGame } from './crocodile-game';
/** The crocodile pond's small loading scene; `undefined` keeps the CSS loader. */
const loaderScene: WorldLoader<null> | undefined = () =>
  import('./crocodile-loader-world').then((m) => m.CrocodileLoaderWorld);

/**
 * A crocodile level.
 * The route commits on the tap and shows this shell at once; the page's own code downloads
 * inside the `@defer` block, so it stays out of the first bundle.
 */
@Component({
  selector: 'app-crocodile-route',
  imports: [CrocodileGame, RouteBlank, RouteLoader],
  template: `@defer (on immediate) {
      <app-crocodile-game animate.enter="is-route-enter" />
    } @placeholder {
      <app-route-blank tone="pond" />
    } @loading (after 120ms; minimum 400ms) {
      <app-route-loader tone="pond" [scene]="loaderScene" animate.leave="is-route-leave" />
    }`,
  styles: routeShellStyles,
  host: { class: 'is-route-tone', 'data-tone': 'pond' },
})
export class CrocodileRoute {
  protected readonly loaderScene = loaderScene;
}
