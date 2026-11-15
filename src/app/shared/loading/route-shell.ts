import { emptyShellTones } from './route-tones';

/**
 * Styles every route shell shares. The page rises softly into place (`animate.enter`) while the
 * loader lies over it and fades away (`animate.leave`), so the hand-over never pops. Calm motion
 * shrinks both to an instant; reduced motion removes them, and Angular then swaps at once.
 * A shell also wears its game's colours (`data-tone`) while it is still empty.
 */
export const routeShellStyles = [
  emptyShellTones,
  `
  :host {
    display: block;
    position: relative;
  }
  .is-route-enter {
    animation: route-enter 320ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
  }
  .is-route-leave {
    position: absolute;
    inset: 0 0 auto;
    z-index: 1;
    pointer-events: none;
    animation: route-leave 260ms ease-in both;
  }
  @keyframes route-enter {
    from {
      opacity: 0;
      translate: 0 12px;
    }
  }
  @keyframes route-leave {
    to {
      opacity: 0;
    }
  }
`,
];
