import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Route, ViewTransitionInfo } from '@angular/router';
import { MotionPreference } from './motion';
import { pageTransition } from './page-transition';

const home: Route = { path: '' };
const games: Route = { path: 'games' };

function snapshot(routeConfig: Route) {
  const leaf = { routeConfig, firstChild: null } as unknown as ActivatedRouteSnapshot;
  return { routeConfig: null, firstChild: leaf } as unknown as ActivatedRouteSnapshot;
}

function run(from: Route, to: Route) {
  const skipTransition = vi.fn();
  const info = {
    transition: { skipTransition },
    from: snapshot(from),
    to: snapshot(to),
  } as unknown as ViewTransitionInfo;
  TestBed.runInInjectionContext(() => pageTransition(info));
  return skipTransition;
}

describe('page transitions', () => {
  beforeEach(() => localStorage.clear());

  it('animates a move to another page', () => {
    expect(run(home, games)).not.toHaveBeenCalled();
  });

  it('stays still within the same page, such as a jump to a game in the hub', () => {
    expect(run(games, games)).toHaveBeenCalled();
  });

  it('stays still when calm motion is on', () => {
    TestBed.inject(MotionPreference).set(true);
    expect(run(home, games)).toHaveBeenCalled();
  });
});
