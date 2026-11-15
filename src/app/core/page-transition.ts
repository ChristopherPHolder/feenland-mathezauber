import { DOCUMENT } from '@angular/common';
import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, ViewTransitionInfo } from '@angular/router';
import { MotionPreference } from './motion';

/**
 * Decides, for each router view transition, whether the page change animates. It skips the
 * animation when calm motion is on, when the device asks for reduced motion, and when the
 * navigation stays on the same page (a game's next level, a jump to a game in the hub), so the
 * cross-fade only plays when the child really goes somewhere else. Runs in the root injector.
 */
export function pageTransition({ transition, from, to }: ViewTransitionInfo) {
  const reduced =
    inject(DOCUMENT).defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ??
    false;
  if (inject(MotionPreference).calm() || reduced || leaf(from) === leaf(to)) {
    transition.skipTransition();
  }
}

function leaf(route: ActivatedRouteSnapshot) {
  while (route.firstChild) route = route.firstChild;
  return route.routeConfig;
}
