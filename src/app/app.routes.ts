import { inject } from '@angular/core';
import { WORLD_CATALOG, worldState, levelState, chapterState, findChapter } from './core/catalog';
import { CompletionService } from './core/completion';
import { ProgressService } from './core/progress';
import { Router, Routes } from '@angular/router';
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./pages/welcome/welcome').then((m) => m.Welcome),
  },
  {
    path: 'settings',
    loadComponent: () => import('./pages/settings/settings').then((m) => m.Settings),
  },
  {
    path: 'worlds/:worldId/chapters/:chapterId',
    canActivate: [
      (route) => {
        const context = findChapter(
          inject(WORLD_CATALOG),
          route.paramMap.get('worldId'),
          route.paramMap.get('chapterId'),
        );
        return context &&
          ['available', 'completed'].includes(
            chapterState(context.chapter, inject(ProgressService).progress()),
          )
          ? true
          : inject(Router).createUrlTree(['/worlds']);
      },
    ],
    loadComponent: () =>
      import('./pages/chapter-detail/chapter-detail').then((m) => m.ChapterDetail),
  },
  {
    path: 'worlds/:id',
    canActivate: [
      (route) => {
        const world = inject(WORLD_CATALOG).find((world) => world.id === route.paramMap.get('id'));
        return world &&
          ['available', 'completed'].includes(worldState(world, inject(ProgressService).progress()))
          ? true
          : inject(Router).createUrlTree(['/worlds']);
      },
    ],
    loadComponent: () => import('./pages/world-detail/world-detail').then((m) => m.WorldDetail),
  },
  { path: 'worlds', loadComponent: () => import('./pages/worlds/worlds').then((m) => m.Worlds) },
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
      /^practice-30-[1-9]$/.test(segments[1].path)
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
      /^crocodile-[1-6]$/.test(segments[1].path)
        ? { consumed: segments, posParams: { id: segments[1] } }
        : null,
    data: { focusedGame: true },
    canActivate: [
      (route) => {
        const level = inject(WORLD_CATALOG)
          .flatMap((world) => world.chapters)
          .flatMap((chapter) => chapter.levels)
          .find((level) => level.id === route.paramMap.get('id'));
        return level &&
          ['available', 'completed'].includes(levelState(level, inject(ProgressService).progress()))
          ? true
          : inject(Router).createUrlTree(['/worlds', 'numbers', 'chapters', 'compare-crocodile']);
      },
    ],
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
          : inject(Router).createUrlTree(['/worlds']);
      },
    ],
    loadComponent: () => import('./pages/completion/completion').then((m) => m.Completion),
  },
  { path: '**', redirectTo: '' },
];
