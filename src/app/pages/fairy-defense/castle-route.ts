import { Component } from '@angular/core';
import { RouteBlank } from '../../shared/loading/route-blank';
import { RouteLoader } from '../../shared/loading/route-loader';
import { routeShellStyles } from '../../shared/loading/route-shell';
import { WorldLoader } from '../../shared/three/three-stage';
import { FairyDefenseComponent } from './fairy-defense.component';
import { PracticeDefense } from './practice-defense';
/** The fairy castle's small loading scene: a fairy circling the gate. */
const loaderScene: WorldLoader<null> | undefined = () =>
  import('./castle-loader-world').then((m) => m.CastleLoaderWorld);

/**
 * Defend the fairy castle.
 * The route commits on the tap and shows this shell at once; the page's own code downloads
 * inside the `@defer` block, so it stays out of the first bundle.
 */
@Component({
  selector: 'app-castle-route',
  imports: [FairyDefenseComponent, RouteBlank, RouteLoader],
  template: `@defer (on immediate) {
      <app-fairy-defense animate.enter="is-route-enter" />
    } @placeholder {
      <app-route-blank tone="castle" />
    } @loading (after 120ms; minimum 400ms) {
      <app-route-loader tone="castle" [scene]="loaderScene" animate.leave="is-route-leave" />
    }`,
  styles: routeShellStyles,
  host: { class: 'is-route-tone', 'data-tone': 'castle' },
})
export class CastleRoute {
  protected readonly loaderScene = loaderScene;
}

/**
 * A practice stage on the path to 30, played at the fairy castle.
 * The route commits on the tap and shows this shell at once; the page's own code downloads
 * inside the `@defer` block, so it stays out of the first bundle.
 */
@Component({
  selector: 'app-practice-castle-route',
  imports: [PracticeDefense, RouteBlank, RouteLoader],
  template: `@defer (on immediate) {
      <app-practice-defense animate.enter="is-route-enter" />
    } @placeholder {
      <app-route-blank tone="castle" />
    } @loading (after 120ms; minimum 400ms) {
      <app-route-loader tone="castle" [scene]="loaderScene" animate.leave="is-route-leave" />
    }`,
  styles: routeShellStyles,
  host: { class: 'is-route-tone', 'data-tone': 'castle' },
})
export class PracticeCastleRoute {
  protected readonly loaderScene = loaderScene;
}
