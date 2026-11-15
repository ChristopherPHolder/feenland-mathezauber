import { Component } from '@angular/core';
import { RouteBlank } from '../../shared/loading/route-blank';
import { RouteLoader } from '../../shared/loading/route-loader';
import { routeShellStyles } from '../../shared/loading/route-shell';
import { WorldLoader } from '../../shared/three/three-stage';
import { Drums } from './drums';
/** The drums' small loading scene: Pom bouncing in rhythm across three drum-mushrooms. */
const loaderScene: WorldLoader<null> | undefined = () =>
  import('./drum-loader-world').then((m) => m.DrumLoaderWorld);

/**
 * A mushroom drums level.
 * The route commits on the tap and shows this shell at once; the page's own code downloads
 * inside the `@defer` block, so it stays out of the first bundle.
 */
@Component({
  selector: 'app-drum-route',
  imports: [Drums, RouteBlank, RouteLoader],
  template: `@defer (on immediate) {
      <app-drums animate.enter="is-route-enter" />
    } @placeholder {
      <app-route-blank tone="drums" />
    } @loading (after 120ms; minimum 400ms) {
      <app-route-loader tone="drums" [scene]="loaderScene" animate.leave="is-route-leave" />
    }`,
  styles: routeShellStyles,
  host: { class: 'is-route-tone', 'data-tone': 'drums' },
})
export class DrumRoute {
  protected readonly loaderScene = loaderScene;
}
