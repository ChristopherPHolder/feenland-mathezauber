import { DOCUMENT } from '@angular/common';
import { inject, Service } from '@angular/core';
import { MotionPreference } from './motion';

/** Longest the splash waits for the first page before it gives way to the route's own loader. */
const MAX_WAIT_MS = 10_000;

/**
 * The loading splash written into index.html. It paints before any script runs and stays over
 * the screen until the first page itself is showing, so a cold start is one loader followed by
 * the whole page: no header and footer over an empty box, and no second loader after the splash.
 * It then fades away (at once under calm or reduced motion) and is removed.
 */
@Service()
export class BootSplash {
  private readonly document = inject(DOCUMENT);
  private readonly motion = inject(MotionPreference);
  private watching = false;

  /** Fades the splash out as soon as `main` shows a page rather than a route still loading. */
  dismissWhenPageShows(main: HTMLElement) {
    const splash = this.document.getElementById('boot-splash');
    if (this.watching || !splash) return;
    this.watching = true;
    const view = this.document.defaultView;
    const done = () => {
      observer.disconnect();
      view?.clearTimeout(timeout);
      this.fade(splash);
    };
    const observer = new MutationObserver(() => pageShown(main) && done());
    observer.observe(main, { childList: true, subtree: true });
    const timeout = view?.setTimeout(done, MAX_WAIT_MS);
    if (pageShown(main)) done();
  }

  private fade(splash: HTMLElement) {
    const reduced =
      this.document.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (this.motion.calm() || reduced || typeof splash.animate !== 'function') {
      splash.remove();
      return;
    }
    splash.inert = true;
    // `finished` rejects when the fade is cancelled; the splash goes either way.
    const remove = () => splash.remove();
    void splash
      .animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 240,
        easing: 'ease-out',
        fill: 'forwards',
      })
      .finished.then(remove, remove);
  }
}

/**
 * Whether the routed page is on screen. Route shells (`.is-route-tone`) start empty, then show
 * `<app-route-blank>` or `<app-route-loader>` until their deferred page arrives.
 */
function pageShown(main: HTMLElement) {
  const routed = [...main.children].find(
    (child) => child.localName !== 'router-outlet' && !child.classList.contains('save-warning'),
  );
  if (!routed) return false;
  if (!routed.classList.contains('is-route-tone')) return true;
  return [...routed.children].some((child) => !child.matches('app-route-blank, app-route-loader'));
}
