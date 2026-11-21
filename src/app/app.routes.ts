import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';
import { CompletionService } from './core/completion';
import { CompletionRoute } from './pages/completion/completion-route';
import { CrocodileRoute } from './pages/crocodile/crocodile-route';
import { CastleRoute, PracticeCastleRoute } from './pages/fairy-defense/castle-route';
import { GamesRoute } from './pages/games/games-route';
import { HatcheryRoute } from './pages/hatchery/hatchery-route';
import { WallRoute } from './pages/number-wall/wall-route';
import { SettingsRoute } from './pages/settings/settings-route';
import { LockRoute } from './pages/treasure-lock/lock-route';
import { PotionRoute } from './pages/potions/potion-route';
import { BakeryRoute } from './pages/bakery/bakery-route';
import { DrumRoute } from './pages/drums/drum-route';
import { StarRoute } from './pages/star-catcher/star-route';
import { FireworkRoute } from './pages/fireworks/firework-route';
import { GondolaRoute } from './pages/gondola/gondola-route';
import { MarketRoute } from './pages/market/market-route';
import { RaceRoute } from './pages/unicorn-race/race-route';
import { WelcomeRoute } from './pages/welcome/welcome-route';
/**
 * Every game and every level is reachable directly: nothing here checks progress.
 * The only guard protects the completion receipt from being faked through a URL.
 *
 * Each route is a tiny shell, bundled up front, so a tap commits the navigation at once and
 * shows a loader in the game's colours; the page itself still downloads lazily, inside the
 * shell's `@defer` block.
 */
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    component: WelcomeRoute,
  },
  { path: 'games', component: GamesRoute },
  { path: 'hatchery', component: HatcheryRoute },
  { path: 'settings', component: SettingsRoute },
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
    component: CastleRoute,
  },
  {
    matcher: (segments) =>
      segments.length === 2 &&
      segments[0].path === 'adventure' &&
      /^practice-30-(?:[1-9]|[12][0-9]|30)$/.test(segments[1].path)
        ? { consumed: segments, posParams: { id: segments[1] } }
        : null,
    data: { focusedGame: true },
    component: PracticeCastleRoute,
  },
  {
    matcher: (segments) =>
      segments.length === 2 &&
      segments[0].path === 'adventure' &&
      /^crocodile-(?:[1-9]|1[0-7])$/.test(segments[1].path)
        ? { consumed: segments, posParams: { id: segments[1] } }
        : null,
    data: { focusedGame: true },
    component: CrocodileRoute,
  },
  {
    matcher: (segments) =>
      segments.length === 2 &&
      segments[0].path === 'adventure' &&
      /^unicorn-race-(?:[1-9]|1[0-9]|2[0-2])$/.test(segments[1].path)
        ? { consumed: segments, posParams: { id: segments[1] } }
        : null,
    data: { focusedGame: true },
    component: RaceRoute,
  },
  {
    matcher: (segments) =>
      segments.length === 2 &&
      segments[0].path === 'adventure' &&
      /^treasure-lock-[1-9]$/.test(segments[1].path)
        ? { consumed: segments, posParams: { id: segments[1] } }
        : null,
    data: { focusedGame: true },
    component: LockRoute,
  },
  {
    matcher: (segments) =>
      segments.length === 2 &&
      segments[0].path === 'adventure' &&
      /^potion-[1-7]$/.test(segments[1].path)
        ? { consumed: segments, posParams: { id: segments[1] } }
        : null,
    data: { focusedGame: true },
    component: PotionRoute,
  },
  {
    matcher: (segments) =>
      segments.length === 2 &&
      segments[0].path === 'adventure' &&
      /^bakery-([1-9]|1[0-2])$/.test(segments[1].path)
        ? { consumed: segments, posParams: { id: segments[1] } }
        : null,
    data: { focusedGame: true },
    component: BakeryRoute,
  },
  {
    matcher: (segments) =>
      segments.length === 2 &&
      segments[0].path === 'adventure' &&
      /^drums-(?:[1-9]|1[0-2])$/.test(segments[1].path)
        ? { consumed: segments, posParams: { id: segments[1] } }
        : null,
    data: { focusedGame: true },
    component: DrumRoute,
  },
  {
    matcher: (segments) =>
      segments.length === 2 &&
      segments[0].path === 'adventure' &&
      /^star-catcher-([1-9]|1[0-2])$/.test(segments[1].path)
        ? { consumed: segments, posParams: { id: segments[1] } }
        : null,
    data: { focusedGame: true },
    component: StarRoute,
  },
  {
    matcher: (segments) =>
      segments.length === 2 &&
      segments[0].path === 'adventure' &&
      /^fireworks-(?:[1-9]|1[0-2])$/.test(segments[1].path)
        ? { consumed: segments, posParams: { id: segments[1] } }
        : null,
    data: { focusedGame: true },
    component: FireworkRoute,
  },
  {
    matcher: (segments) =>
      segments.length === 2 &&
      segments[0].path === 'adventure' &&
      /^gondola-(?:[1-9]|1[0-2])$/.test(segments[1].path)
        ? { consumed: segments, posParams: { id: segments[1] } }
        : null,
    data: { focusedGame: true },
    component: GondolaRoute,
  },
  {
    matcher: (segments) =>
      segments.length === 2 &&
      segments[0].path === 'adventure' &&
      /^market-[1-7]$/.test(segments[1].path)
        ? { consumed: segments, posParams: { id: segments[1] } }
        : null,
    data: { focusedGame: true },
    component: MarketRoute,
  },
  {
    path: 'adventure/number-wall',
    data: { focusedGame: true },
    component: WallRoute,
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
    component: CompletionRoute,
  },
  { path: '**', redirectTo: '' },
];
