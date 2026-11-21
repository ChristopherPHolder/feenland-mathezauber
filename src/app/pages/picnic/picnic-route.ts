import { Component } from '@angular/core';
import { RouteBlank } from '../../shared/loading/route-blank';
import { RouteLoader } from '../../shared/loading/route-loader';
import { routeShellStyles } from '../../shared/loading/route-shell';
import { WorldLoader } from '../../shared/three/three-stage';
import { Picnic } from './picnic';

/** The picnic's small loading scene: a pie on a blanket whose slices pop in one by one. */
const loaderScene: WorldLoader<null> | undefined = () =>
  import('./picnic-loader-world').then((m) => m.PicnicLoaderWorld);

/**
 * A picnic level. The route commits on the tap and shows this shell at once; the page's own code
 * downloads inside the `@defer` block, so it stays out of the first bundle.
 */
@Component({
  selector: 'app-picnic-route',
  imports: [Picnic, RouteBlank, RouteLoader],
  template: `@defer (on immediate) {
      <app-picnic animate.enter="is-route-enter" />
    } @placeholder {
      <app-route-blank tone="picnic" />
    } @loading (after 120ms; minimum 400ms) {
      <app-route-loader tone="picnic" [scene]="loaderScene" animate.leave="is-route-leave" />
    }`,
  styles: routeShellStyles,
  host: { class: 'is-route-tone', 'data-tone': 'picnic' },
})
export class PicnicRoute {
  protected readonly loaderScene = loaderScene;
}
