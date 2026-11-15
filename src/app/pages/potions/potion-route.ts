import { Component } from '@angular/core';
import { RouteBlank } from '../../shared/loading/route-blank';
import { RouteLoader } from '../../shared/loading/route-loader';
import { routeShellStyles } from '../../shared/loading/route-shell';
import { WorldLoader } from '../../shared/three/three-stage';
import { Potions } from './potions';
/** The potion cauldron's small loading scene: a bottle pouring drops into the cauldron. */
const loaderScene: WorldLoader<null> | undefined = () =>
  import('./potion-loader-world').then((m) => m.PotionLoaderWorld);

/**
 * A potion cauldron level.
 * The route commits on the tap and shows this shell at once; the page's own code downloads
 * inside the `@defer` block, so it stays out of the first bundle.
 */
@Component({
  selector: 'app-potion-route',
  imports: [Potions, RouteBlank, RouteLoader],
  template: `@defer (on immediate) {
      <app-potions animate.enter="is-route-enter" />
    } @placeholder {
      <app-route-blank tone="potion" />
    } @loading (after 120ms; minimum 400ms) {
      <app-route-loader tone="potion" [scene]="loaderScene" animate.leave="is-route-leave" />
    }`,
  styles: routeShellStyles,
  host: { class: 'is-route-tone', 'data-tone': 'potion' },
})
export class PotionRoute {
  protected readonly loaderScene = loaderScene;
}
