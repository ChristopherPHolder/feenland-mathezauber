import { inject } from '@angular/core';
import { worlds, levelState } from './core/catalog';
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
  { path: 'worlds', loadComponent: () => import('./pages/worlds/worlds').then((m) => m.Worlds) },
  {
    path: 'adventure/:id',
    canActivate: [
      (route) => {
        const level = worlds
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
