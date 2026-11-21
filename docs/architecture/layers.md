# Layers

The code is split into layers, and each layer may only import from the layers below it.

```
src/app/pages/<game>   one folder per screen or game: its route, components, rules, 3D world
        │
src/app/shared         app widgets several pages use: GameHeader, route loaders, the 3D stage
        │
src/app/core           domain and services: catalog, progress, results, locale, messages
        │
@feenland/ui           packages/ui: tokens, base styles, dumb presentational components
```

| Layer          | Holds                                                             | May import                       |
| -------------- | ----------------------------------------------------------------- | -------------------------------- |
| `@feenland/ui` | Tokens, base CSS, components with inputs/outputs only             | Angular core and common          |
| `core`         | Pure domain logic and root services. No components.               | Nothing in the app               |
| `shared`       | Smart widgets reused across pages; wires `@feenland/ui` to `core` | `core`, `@feenland/ui`           |
| `pages/<game>` | One feature. Everything only this game uses stays in its folder.  | `shared`, `core`, `@feenland/ui` |

`@feenland/ui` is the design system. [Its README](../../packages/ui/README.md) says what may go
in and how to add a component. Lint (`no-restricted-imports` in `vite.config.ts`) keeps it free
of app code, services, routing and 3D, and keeps the app from importing it by path.

## Smart and dumb

A dumb component renders what it is given: inputs in, outputs out, no injected services. The
design-system components are all dumb. A smart component injects services (locale, progress,
the router, a store) and hands plain values to dumb ones. `shared/game-header.ts` is the
pattern: it reads the locale, links to the games hub and shows the dragon egg, and leaves the
layout to `ui-game-bar` and `ui-sound-toggle`.

## Where things still cross the lines

These imports go against the arrows above. They work, but each one couples two features, so
new code should not add more, and the next refactors remove them:

- **Cross-game stores live in a game's folder.** Ten games import `pages/hatchery/hatchery-store`
  (the dragon egg every game warms), eleven import `pages/fairy-defense/playtest-store`, and
  `number-wall` uses `fairy-defense/game-audio`. They belong in `core` (stores) and `shared`
  (`EggChip`, game audio), which also lets `shared/game-header.ts` stop importing a page.
- **The catalog imports level lists from nine games** (`core/catalog.ts`), and the games hub
  imports every game's levels and scores. A small per-game manifest that the catalog and hub
  read would point the dependency the right way.
- **The hatchery imports the crocodile game** (`crocodile-game`, `coach-memory`) and Home
  imports hatchery and number-wall internals.

## Repeated per-game pieces

Each new game has copied the same building blocks from the last one. They are candidates for
`@feenland/ui` (presentation) and `core` (logic):

| Piece                                | Copies                                                                               | Destination                                                                  |
| ------------------------------------ | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `*-guide.ts` "tap here next" counter | bakery, drums, fireworks, gondola, potions, star-catcher (identical but for the key) | `core/guide-counter.ts` exists (market uses it); move the rest over          |
| `*-coach.ts` demo-film dialog        | bakery, crocodile, fireworks, potions                                                | `ui-coach-dialog` (market, dragon duels, gondola, clock); move the rest over |
| `*-reward.ts` / `.css` burst card    | bakery, fireworks, gondola, lock, potions, star-catcher (~160 lines of CSS each)     | `ui-reward-burst` exists (market uses it); move the rest over                |
| local `.sr-only` rules               | about 20 stylesheets                                                                 | the global `.sr-only` in `base.css`                                          |
