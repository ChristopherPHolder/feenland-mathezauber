import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Choose your adventure · Fun Math',
    loadComponent: () => import('./pages/playground/playground').then((m) => m.Playground),
  },
  {
    path: 'games/garden/little',
    title: 'Level 1 · Little berry bites · Fun Math',
    data: { level: 'little' },
    loadComponent: () => import('./pages/home/home').then((m) => m.Home),
  },
  {
    path: 'games/garden/big',
    title: 'Level 2 · Big berry bites · Fun Math',
    data: { level: 'big' },
    loadComponent: () => import('./pages/home/home').then((m) => m.Home),
  },
  {
    path: 'games/number-bridge',
    title: 'Die Zehnerbrücke · Fun Math',
    loadComponent: () => import('./games/number-bridge/number-bridge').then((m) => m.NumberBridge),
  },
  { path: '**', redirectTo: '' },
];
