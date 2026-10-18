# Fun Math

An Angular app for children's math games, hosted on Cloudflare Workers with static assets. The home page is a level picker for three math adventures, with a fairy-tale unicorn garden designed for a seven-year-old.

The [Feenland issue review](docs/issue-review.md) compares this baseline with the planned navigation, localization and durable progress work, including recommended delivery order and specification gaps.

## Local development

Use Node.js 24 LTS (or a compatible newer release) and npm.

```sh
npm ci
npm start
```

Open http://localhost:4200. Angular reloads when source files change.

## Check and build

```sh
npm test -- --watch=false
npm run build
```

Production files are generated in `dist/fun-math/browser`.

## Cloudflare deployment

```sh
npx wrangler login
npm run deploy
```

Wrangler builds Angular before uploading the production assets. `wrangler.jsonc` configures the `fun-math` Worker and Cloudflare account. Angular navigation falls back to `index.html` through Cloudflare's single-page application handling.

To preview the production build with Cloudflare's local runtime:

```sh
npm run preview
```

Authentication stays in Wrangler's local credential store. Do not commit tokens or local environment files. There is no backend, analytics, or user data storage in this starter.

## Structure

- `src/app/`: app shell, unicorn garden game, and number bridge practice
- `src/app/app.routes.ts`: lazy-loaded game routes
- `public/`: static assets
- `wrangler.jsonc`: Cloudflare hosting and build settings

Cloudflare reference: https://developers.cloudflare.com/workers/framework-guides/web-apps/more-web-frameworks/angular/

## Impeccable design tools

[Impeccable](https://impeccable.style/) is installed for this project in `.agents/skills/impeccable`, with Codex hooks in `.codex/hooks.json`. Start a new chat to load the skill, then use `$impeccable audit` or `$impeccable polish` for design work. `$impeccable init` captures the product brief after confirmation.

Automatic design checks are enabled in `.impeccable/config.json`. In Codex Settings → Hooks, review and trust the Impeccable `PostToolUse` and `Stop` hooks before expecting automatic checks to run. Each checkout needs its own hook trust.

Update the installation from this directory with `npx impeccable update`. The launcher downloads its pinned engine if the local platform binary is absent.

## Progressive web app

Fun Math is installable through supported browsers and uses Angular's service worker to cache the production app and icons. Open it online once and let the initial cache finish; it can then reopen offline. Fonts are cached when first loaded, with system fonts as a fallback.

On iPhone/iPad, open the site in Safari and use Share → Add to Home Screen. On supported desktop/Android browsers, use the browser's install option.

Service workers are disabled in development. Use `npm run preview` to test the production PWA locally. To verify offline behavior, open the preview, wait for the service worker to activate, reload once, enable Offline in browser developer tools, and reload again. The welcome page should still render. New deployments are downloaded in the background and take effect on a later app launch once ready.

- `public/manifest.webmanifest`: installation name, colors, and icons
- `ngsw-config.json`: app, icon, and font caching
- `public/_headers`: revalidation for the service worker and manifests

## First game: Die Zehnerbrücke

Choose Level 3 on the home page or open `/games/number-bridge`. The game is in German to match the worksheet and covers missing addends, missing subtrahends, and missing starting numbers up to 30.

A worked example introduces hopping via the next ten. Eight-question sessions start with four guided problems, then four independent problems with optional help. A missing starting number in subtraction is taught by adding back and finding the landing number; the other patterns find the sum of the hops. Problems within the same ten use one hop. There is no timer or penalty for retries. Another round samples eight distinct problems from the 21 worksheet exercises. Progress lasts for the current session; no child data is sent or stored.

The game route is loaded lazily and its production assets are prefetched by the PWA for offline use after the initial cache completes.

## Luna’s enchanted garden

Choose Level 1 at `/games/garden/little` (up to 10) or Level 2 at `/games/garden/big` (up to 20) from the landing page at `/`. All levels are available immediately, and each game links back to the picker. Help Luna the unicorn make five berry treats. Count pictured berries, select an answer, and serve the treat to earn a friendship sticker. Wrong answers reveal numbered counting help without losing progress. Little bites practice addition and subtraction up to 10; Big bites go up to 20. Changing recipe size starts a new visit. Completing a visit unlocks a celebration and a replay with a different starting puzzle. Progress is temporary.

Read to me uses the browser’s speech synthesis when available; voice availability depends on the device. Fredoka fonts and unicorn art are local assets cached by the existing production service worker. The generated illustration’s prompt and provenance are in `.impeccable/assets/` and the image sidecars.
