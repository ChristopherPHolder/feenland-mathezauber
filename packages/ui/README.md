# @feenland/ui

The Feenland design system: the tokens, the base styles and the dumb components every screen
is built from. The app imports it as `@feenland/ui` (a path in `tsconfig.json`, resolved by
Vite through `resolve.tsconfigPaths`); it is not published to npm.

```ts
import { GameBar, Icon, SoundToggle, StarRating } from '@feenland/ui';
```

## What belongs here

A component belongs in `@feenland/ui` when it only presents: it gets everything through
`input()`, `model()` and content projection, and reports through `output()`. It never decides
anything about the game, the player or the page.

| Allowed                                   | Not allowed (lint fails)                          |
| ----------------------------------------- | ------------------------------------------------- |
| `@angular/core` components and directives | `inject()`, `@Injectable`, `@Service`             |
| `@angular/common` pipes and directives    | `@angular/router`: project a link from the caller |
| Other files in `packages/ui`              | `@angular/forms`, `three`                         |
| Tokens through `var(--name)`              | Anything in `src/app`, or `@feenland/*` by name   |

So text arrives already translated (`StarRating`'s `label`, `SoundToggle`'s `onLabel`), links
arrive projected (`GameBar`'s `[uiGameBarBack]` slot), and state belongs to the caller
(`SoundToggle` emits `toggle`; the game flips its own flag). The rules are enforced by
`no-restricted-imports` overrides in `vite.config.ts`, and the app may only import the package
through `@feenland/ui`, never by a relative path.

Selectors use the `ui-` prefix, so a template shows at a glance which parts are the design
system's. Global classes the package defines carry the prefix too (`ui-pill`), apart from the
long-standing base classes listed below.

## Contents

| Path                  | What it is                                                                                                                                          |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tokens.json`         | The token source: colours, spacing, radii, shadows, type. See [TOKENS.md](TOKENS.md).                                                               |
| `styles/tokens.css`   | Generated from `tokens.json` by `vp run tokens`. Never edit by hand.                                                                                |
| `styles/base.css`     | Reset, type, focus ring, `.button` `.primary` `.secondary`, `.panel`, `.lead`, `dialog`, `.sr-only`, `.ui-pill`, and the reduced/calm motion rules. |
| `src/icon.ts`         | `ui-icon`: the line icons (`IconKind`).                                                                                                             |
| `src/dragon-face.ts`  | `ui-dragon-face`: a flat dragon face in given colours; bigger horns for each evolved `form`.                                                        |
| `src/emblem.ts`       | `ui-emblem`: a game's or world's illustrated emblem, by catalog id, with an emoji fallback.                                                         |
| `src/star-rating.ts`  | `ui-star-rating`: three star slots and one spoken label.                                                                                            |
| `src/game-bar.ts`     | `ui-game-bar`: the way out, title and actions above a game.                                                                                         |
| `src/sound-toggle.ts` | `ui-sound-toggle`: the round speaker button.                                                                                                        |
| `src/number-pad.ts`   | `ui-number-pad`: the number pad in rows of five, with Delete and OK (gondola, market).                                                              |
| `src/reward-burst.ts` | `ui-reward-burst`: the glow, sparkles and points card after a right answer, tinted with `--burst-*` (market).                                       |
| `src/index.ts`        | The public API. Export every new component here.                                                                                                    |

`index.html` loads `styles/tokens.css`, then `styles/base.css`, then the app's own
`src/styles.css`, so the app can build on the base and never the other way round.

## Calm motion

Components animate freely, and the base styles still them in two cases: the system asks for
reduced motion, or the app puts `calm-motion` on `<html>` (the Settings switch). Component
styles can opt out of a decoration with `:host-context(.calm-motion)`.

## Adding a component

1. Write it in `src/` with a `ui-` selector, inputs and outputs only. Inline styles are fine;
   read colours from tokens.
2. Export it from `src/index.ts`.
3. Give it a spec next to it when it has behaviour (a fallback, a label, an emitted event).
4. If an app component already does the same job, make that one a thin wrapper around the new
   component, the way `src/app/shared/game-header.ts` wraps `GameBar` and `SoundToggle`.
