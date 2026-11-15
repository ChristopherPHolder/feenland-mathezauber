import { Component } from '@angular/core';
import { RouteBlank } from '../../shared/loading/route-blank';
import { RouteLoader } from '../../shared/loading/route-loader';
import { routeShellStyles } from '../../shared/loading/route-shell';
import { WorldLoader } from '../../shared/three/three-stage';
import { UnicornRace } from './unicorn-race';
/** The unicorn race's small loading scene; `undefined` keeps the CSS loader. */
const loaderScene: WorldLoader<null> | undefined = () =>
  import('./race-loader-world').then((m) => m.RaceLoaderWorld);

/**
 * A unicorn race level.
 * The route commits on the tap and shows this shell at once; the page's own code downloads
 * inside the `@defer` block, so it stays out of the first bundle.
 */
@Component({
  selector: 'app-race-route',
  imports: [UnicornRace, RouteBlank, RouteLoader],
  template: `@defer (on immediate) {
      <app-unicorn-race animate.enter="is-route-enter" />
    } @placeholder {
      <app-route-blank tone="race" />
    } @loading (after 120ms; minimum 400ms) {
      <app-route-loader tone="race" [scene]="loaderScene" animate.leave="is-route-leave" />
    }`,
  styles: routeShellStyles,
  host: { class: 'is-route-tone', 'data-tone': 'race' },
})
export class RaceRoute {
  protected readonly loaderScene = loaderScene;
}
