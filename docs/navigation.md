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

## Topics inside a game

Each game's levels are grouped into topics (`Level.group` in the catalog, a message key such as `castleAdding` or `crocTimes`). The hub shows them as a row of tabs (`role="tablist"`) above the level cards:

- The selected topic is the one holding the recommended level, else the first topic with an unplayed level, else the first topic. Tapping a tab changes it; arrow keys, Home and End move along the row and select as they go.
- Every topic's cards are rendered. Unselected panels are `hidden="until-found"`, so find-in-page still finds them and opens their tab (`beforematch`).
- A link to a level (`/games#crocodile-7`) opens that level's topic first, so the card it lands on is visible.
- Levels are listed easiest first. Level ids never change: new levels got new ids (`crocodile-8`, `practice-30-12`, wall level 5 …) and were slotted into the order, so the number on a card is its position, not its id.

Magic walls keeps its own list (`levels` in `number-wall.ts`, each with a `group` in its rules); the hub turns it into cards the same way.

## Inside a game

Every game shows `GameHeader` (`src/app/shared/game-header.ts`) above its menu:

- **All games** on the left, a link to `/games` with the game's own anchor, so leaving a game puts the child back on the card they came from.
- The game title, with an optional detail line (the crocodile shows "Level 3 of 6 · Add first, then compare").
- An optional sound toggle on the right. Games whose sound lives in a pause menu (the castle) leave it out.

Switching levels never requires leaving the game:

- **The Hungry Crocodile** has a level strip 1–14 on its intro (two rows of seven on a phone); the current level is marked with `aria-current="page"`.
- **Magic walls** lists its eleven levels on the intro and also accepts `?level=n` (`/adventure/number-wall?level=3`) so the hub can open a level directly.
- **The Unicorn Rainbow Race** has five race routes (`/adventure/unicorn-race-1` … `-5`); its intro lists all five as cards with the current one marked `aria-current="page"`, and the finish offers the next race directly. The Stable (the horse creator) is a phase of the race page, not a route: it opens once on a child's first visit and again from their horse in the intro line-up (the ✏️ badge); Done goes back to the intro with focus on that horse.
- **The Treasure Lock** has nine level routes (`/adventure/treasure-lock-1` … `-9`); its intro has a level strip 1–9, numbered by position (level 8, halving back, shows as 7), with the current level marked `aria-current="page"`, and the finish offers the next level.
- **The Firework Show** has twelve level routes (`/adventure/fireworks-1` … `-12`); its intro has a level strip 1–12 with the current level marked `aria-current="page"`, and the finish offers the next level.
- **The Potion Cauldron** has seven level routes (`/adventure/potion-1` … `-7`); its intro has a level strip 1–7 with the current level marked `aria-current="page"`, and the finish offers the next level.
- **The Fairy Bakery** has twelve level routes (`/adventure/bakery-1` … `-12`); its intro has a level strip 1–12 with the current level marked `aria-current="page"`, and the finish offers the next level.
- **The Mushroom Drums** has twelve level routes (`/adventure/drums-1` … `-12`); its intro has a level strip 1–12 in two rows of six with the current level marked `aria-current="page"`, the pause dialog can go back to the intro, and the finish offers the next level.
- **The Star Catcher** has twelve level routes (`/adventure/star-catcher-1` … `-12`); its intro has a level strip 1–12 with the current level marked `aria-current="page"`, and the finish offers the next level.
- **The Mountain Gondola** has twelve level routes (`/adventure/gondola-1` … `-12`); its intro has a level strip 1–12 with the current level marked `aria-current="page"`, and the finish offers the next level.
- **The Fairy Market** has five level routes (`/adventure/market-1` … `-5`); its intro has a level strip 1–5 with the current level marked `aria-current="page"`, Lumi's shelf of bought treats, and the finish shows a receipt and offers the next level.
- **The Clock Tower** has twelve level routes (`/adventure/clock-1` … `-12`); its intro has a level strip 1–12 with the current level marked `aria-current="page"`, the tower balcony of woken friends, and the finish shows Pip's day planner and offers the next level.
- **Defend the Fairy Castle** keeps its wave path (all twenty waves open) and the picture cards for the thirty practice stages, grouped under a heading per topic. Those stages belong to the castle chapter, so Home shows one castle card and the hub lists them under the castle section.
- Finishing a round offers Next level, Play again and All games.

### After a deploy

A tab left open across a deploy still runs the old build, whose lazy chunks are gone from the server (Cloudflare answers every missing file with `index.html`). Without help, a tap on All games or any other page would change the URL and then show nothing. `core/stale-build.ts` catches that failure, both a route shell's `@defer` block (Angular's NG0750, through the app's `ErrorHandler`) and a lazy route (the router's navigation error handler), and loads the page afresh from the server. It does this once per URL within 30 seconds, never offline and never without session storage, so a page that truly cannot load does not reload forever.

Games handle keys on `document`. A handler that cancels Enter or Space must let a focused link or a button outside the game's own controls keep its action, or All games stops working from the keyboard (see `NumberWallComponent.onKey`).

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
