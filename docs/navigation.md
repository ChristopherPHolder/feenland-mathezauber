# Navigation and the games hub

Feenland has one rule for getting around: **every game and every level is open, all the time**. Nothing is locked behind progress, no route guard checks mastery, and no screen asks a child to "unlock" anything. Progress only decorates what is already playable: stars, best scores and the "Your next step" badge.

## Screens

| Route                   | Screen     | What it does                                                                                                                                                                                                                                             |
| ----------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                     | Home       | Hero with Continue/Start (the catalog recommendation), an **All games** button, one card per game with its own Play button and an "All levels" link, and the cumulative journey counts.                                                                  |
| `/games`                | Games hub  | Every game as a section, every level as a card that links straight into play. Sections carry the chapter id (`#compare-crocodile`), cards carry the level id (`#crocodile-3`), so links from games, completion and old bookmarks land on the right spot. |
| `/adventure/<level-id>` | A game     | The game itself. Each game opens with the shared game header (see below).                                                                                                                                                                                |
| `/complete/<level-id>`  | Completion | Shown only after a game recorded a real result. Offers Next adventure, Play again, All games and Home.                                                                                                                                                   |
| `/settings`             | Settings   | Language and notes. Its back link returns to the screen it was opened from.                                                                                                                                                                              |

The shared site header (Home · Games · Settings gear) is shown on every screen except inside a game. Game routes declare `data: { focusedGame: true }` in `app.routes.ts`, and the shell reads that flag from the activated route instead of matching URLs.

### Old links

The earlier world map and its drill-down (`/worlds`, `/worlds/:id`, `/worlds/:worldId/chapters/:chapterId`) are gone. Those URLs redirect to the hub: a world link lands on that world's first game, a chapter link on that chapter's section. Bookmarks keep working and nothing has to be re-learned.

## Inside a game

Every game shows `GameHeader` (`src/app/shared/game-header.ts`) above its menu:

- **All games** on the left, a link to `/games` with the game's own anchor, so leaving a game puts the child back on the card they came from.
- The game title, with an optional detail line (the crocodile shows "Level 3 of 6 · Add first, then compare").
- An optional sound toggle on the right. Games whose sound lives in a pause menu (the castle) leave it out.

Switching levels never requires leaving the game:

- **The Hungry Crocodile** has a level strip 1–6 on its intro; the current level is marked with `aria-current="page"`.
- **Magic walls** lists its four levels on the intro and also accepts `?level=n` (`/adventure/number-wall?level=3`) so the hub can open a level directly.
- **Defend the Fairy Castle** keeps its wave path (all twenty waves open) and the picture cards for the nine practice stages.
- Finishing a round offers Next level, Play again and All games.

## Where the data comes from

`core/catalog.ts` is the single source: World → Chapter → Level. A chapter _is_ a game (it carries an emblem and a description), and its levels are the game's selectable levels. Home and the hub both render straight from `WORLD_CATALOG`, so adding a chapter adds a card on Home and a section in the hub with no template changes.

- `levelState(level, progress)` is `open` or `completed`; there is no locked state.
- `levelStars(level, progress)` is the best star count recorded, `0` until played.
- `nextLevel(catalog, progress)` is the Home recommendation: the first unplayed level, else the first played but unmastered one.
- `entryLevel(chapter, progress)` is where a game's Play button on Home goes: the first unmastered level, else the first level.
- `results.ts` records a result for any known, non-playtest level. Results still come only from the games themselves, never from a URL.

Game-specific extras on the hub cards come from the games' own stores: the castle's wave count (`CampaignStore`), the crocodile's best points (`CrocodileScores`) and the wall levels' star ratings (`NumberWallStore`).

## Adding a game

1. Add a chapter (id, title, description, emblem) with its levels to `core/catalog.ts`, and message keys for its titles in all four languages.
2. Add the game's route under `/adventure/...` with `data: { focusedGame: true }`.
3. Put `<app-game-header>` at the top of the game with its title and the chapter id (or level id) as `anchor`.
4. If the hub should show something beyond stars, add a `@case` for the level format in `pages/games/games.html`; the default card already shows the level number, title, example, description and stars.
5. Send the child back with links to `/games` and a fragment, never to a route that filters by progress.
