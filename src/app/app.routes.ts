import { inject } from '@angular/core';
import { WORLD_CATALOG, worldState, levelState, chapterState, findChapter } from './core/catalog';
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
    path: 'adventure/:id',
    canActivate: [
      (route) => {
        const level = inject(WORLD_CATALOG)
          .flatMap((world) => world.chapters)
          .flatMap((chapter) => chapter.levels)
          .find((level) => level.id === route.paramMap.get('id'));
        const progress = inject(ProgressService).progress();
        return level && ['available', 'completed'].includes(levelState(level, progress))
          ? true
          : inject(Router).createUrlTree(['/']);
      },
    ],
    loadComponent: () => import('./pages/challenge/challenge').then((m) => m.Challenge),
  },
  { path: '**', redirectTo: '' },
];
