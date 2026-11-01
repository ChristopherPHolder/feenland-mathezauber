# Design tokens

`tokens.json` is the single source for the app's colours, spacing, radii, shadows and type. The
Angular build does not read it directly: `npm run tokens` compiles it to `src/tokens.css`, which
`angular.json` loads before `styles.css`. Both files are committed, so a checkout builds without
running the script, and `src/design-tokens.spec.ts` fails when the generated file is stale, when a
stylesheet reads a custom property no token defines, or when a stylesheet repeats a token colour
as a literal.

## Changing a value

1. Edit `design/tokens.json`. Every token has a `usage` note saying where it appears; keep it true.
2. Run `npm run tokens`.
3. Run `npm test -- --watch=false` and commit both files.

## Adding a token

Add it to the right family (`color`, `spacing`, `radius`, `shadow`) with a `name`, `value` and
`usage`, regenerate, then read it in CSS as `var(--name)`. Names are lowercase with hyphens and must
be unique across families. Colours that belong to one scene (a pond gradient, the castle parchment)
are tokens too; one-off literals stay in their stylesheet only when they mean nothing outside it.

## The design system page

The same tokens, the brand book, the icon and illustration assets and live component previews are
published as a Design System artifact on claude.ai (Feenland Mathezauber Design System). This file
is the source: when a value changes here, update the artifact's `project/tokens.json` to match.
The type styles in `tokens.json` (`type.groups`) are documentation for that page and are not yet
compiled into classes.
