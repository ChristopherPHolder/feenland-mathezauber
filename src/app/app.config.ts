import { DOCUMENT } from '@angular/common';
import {
  ApplicationConfig,
  ErrorHandler,
  inject,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import {
  provideRouter,
  withInMemoryScrolling,
  withNavigationErrorHandler,
  withViewTransitions,
} from '@angular/router';
import { routes } from './app.routes';
import { pageTransition } from './core/page-transition';
import { isMissingChunk, reloadFresh, StaleBuildErrorHandler } from './core/stale-build';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // A tab left open across a deploy loads the next page afresh instead of showing nothing.
    { provide: ErrorHandler, useClass: StaleBuildErrorHandler },
    provideRouter(
      routes,
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
      withViewTransitions({ skipInitialTransition: true, onViewTransitionCreated: pageTransition }),
      withNavigationErrorHandler(({ error, url }) => {
        if (isMissingChunk(error)) reloadFresh(inject(DOCUMENT), Date.now(), url);
      }),
    ),
  ],
};
