import { Component } from '@angular/core';
import { RouteBlank } from '../../shared/loading/route-blank';
import { RouteLoader } from '../../shared/loading/route-loader';
import { routeShellStyles } from '../../shared/loading/route-shell';
import { WorldLoader } from '../../shared/three/three-stage';
import { DragonDuel } from './dragon-duel';
/** The duel's small loading scene: a baby fire dragon puffs fire balls at a pebble pixie. */
const loaderScene: WorldLoader<null> | undefined = () =>
  import('./duel-loader-world').then((m) => m.DuelLoaderWorld);

/**
 * A dragon duel.
 * The route commits on the tap and shows this shell at once; the page's own code downloads
 * inside the `@defer` block, so it stays out of the first bundle.
 */
@Component({
  selector: 'app-dragon-duel-route',
  imports: [DragonDuel, RouteBlank, RouteLoader],
  template: `@defer (on immediate) {
      <app-dragon-duel animate.enter="is-route-enter" />
    } @placeholder {
      <app-route-blank tone="duel" />
    } @loading (after 120ms; minimum 400ms) {
      <app-route-loader tone="duel" [scene]="loaderScene" animate.leave="is-route-leave" />
    }`,
  styles: routeShellStyles,
  host: { class: 'is-route-tone', 'data-tone': 'duel' },
})
export class DragonDuelRoute {
  protected readonly loaderScene = loaderScene;
}
