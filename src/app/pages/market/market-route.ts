import { Component } from '@angular/core';
import { RouteBlank } from '../../shared/loading/route-blank';
import { RouteLoader } from '../../shared/loading/route-loader';
import { routeShellStyles } from '../../shared/loading/route-shell';
import { WorldLoader } from '../../shared/three/three-stage';
import { Market } from './market';
/** The market's small loading scene: a coin flips into Lumi's basket. */
const loaderScene: WorldLoader<null> | undefined = () =>
  import('./market-loader-world').then((m) => m.MarketLoaderWorld);

/**
 * A fairy market level.
 * The route commits on the tap and shows this shell at once; the page's own code downloads
 * inside the `@defer` block, so it stays out of the first bundle.
 */
@Component({
  selector: 'app-market-route',
  imports: [Market, RouteBlank, RouteLoader],
  template: `@defer (on immediate) {
      <app-market animate.enter="is-route-enter" />
    } @placeholder {
      <app-route-blank tone="market" />
    } @loading (after 120ms; minimum 400ms) {
      <app-route-loader tone="market" [scene]="loaderScene" animate.leave="is-route-leave" />
    }`,
  styles: routeShellStyles,
  host: { class: 'is-route-tone', 'data-tone': 'market' },
})
export class MarketRoute {
  protected readonly loaderScene = loaderScene;
}
