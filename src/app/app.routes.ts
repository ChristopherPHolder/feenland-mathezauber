import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';
import { CompletionService } from './core/completion';
/**
 * Every game and every level is reachable directly: nothing here checks progress.
 * The only guard protects the completion receipt from being faked through a URL.
 */
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./pages/welcome/welcome').then((m) => m.Welcome),
  },
  { path: 'games', loadComponent: () => import('./pages/games/games').then((m) => m.Games) },
  {
    path: 'settings',
    loadComponent: () => import('./pages/settings/settings').then((m) => m.Settings),
  },
  // Older bookmarks of the world map, a world or a chapter land on that game in the hub.
  { path: 'worlds', pathMatch: 'full', redirectTo: 'games' },
  {
    path: 'worlds/:id',
    pathMatch: 'full',
    redirectTo: ({ params }) =>
      inject(Router).createUrlTree(['/games'], { fragment: params['id'] }),
  },
  {
    path: 'worlds/:worldId/chapters/:chapterId',
    redirectTo: ({ params }) =>
      inject(Router).createUrlTree(['/games'], { fragment: params['chapterId'] }),
  },
  {
    path: 'adventure/defend-fairy-castle',
    data: { focusedGame: true },
    loadComponent: () =>
      import('./pages/fairy-defense/fairy-defense.component').then((m) => m.FairyDefenseComponent),
  },
  {
    matcher: (segments) =>
      segments.length === 2 &&
      segments[0].path === 'adventure' &&
      /^practice-30-([1-9]|1[01])$/.test(segments[1].path)
        ? { consumed: segments, posParams: { id: segments[1] } }
        : null,
    data: { focusedGame: true },
    loadComponent: () =>
      import('./pages/fairy-defense/practice-defense').then((m) => m.PracticeDefense),
  },
  {
    matcher: (segments) =>
      segments.length === 2 &&
      segments[0].path === 'adventure' &&
      /^crocodile-[1-7]$/.test(segments[1].path)
        ? { consumed: segments, posParams: { id: segments[1] } }
        : null,
    data: { focusedGame: true },
    loadComponent: () => import('./pages/crocodile/crocodile-game').then((m) => m.CrocodileGame),
  },
  {
    path: 'adventure/number-wall',
    data: { focusedGame: true },
    loadComponent: () =>
      import('./pages/number-wall/number-wall.component').then((m) => m.NumberWallComponent),
  },
  {
    path: 'complete/:id',
    canActivate: [
      (route) => {
        const result = inject(CompletionService).result();
        return result?.levelId === route.paramMap.get('id')
          ? true
          : inject(Router).createUrlTree(['/games']);
      },
    ],
    loadComponent: () => import('./pages/completion/completion').then((m) => m.Completion),
  },
  { path: '**', redirectTo: '' },
];
