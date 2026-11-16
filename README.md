# Feenland Mathezauber

[Play Feenland Mathezauber](https://fun-math.chris-holder.workers.dev)

A responsive, multilingual fairyland math adventure built with Angular 22. The navigation is Home, a games hub that lists every game and every level, the games themselves, result-driven completion and language Settings. Every game and every level is open from the first visit; nothing is locked behind progress. See [navigation](docs/navigation.md).

## Development

Use Node.js 26 and npm. The toolchain is [Vite+](https://viteplus.dev) (`vp`): `vp dev`, `vp build`, `vp test`, `vp lint` and `vp fmt` replace the Angular CLI. Angular is compiled by [`@push-based/vite-plugin-ngp`](https://push-based.github.io/vite-plugin-ngp/), which carries its own build of Angular's ngp compiler and therefore needs every `@angular/*` package pinned to exactly `22.3.0-next.4`. Upgrade Angular only together with that plugin.

```sh
npm ci
npm start               # vp dev on http://localhost:4200
npm test                # vp test (Vitest in jsdom)
npm run typecheck       # type-checks the specs; vp build type-checks the app and its templates
npm run build           # vp build into dist/
```

`vite.config.ts` holds the whole setup: the ngp plugin with the size budgets that used to live in `angular.json`, the Cloudflare plugin, and the `test`, `lint` and `fmt` settings. `index.html` sits at the project root and loads `src/main.ts`, `src/tokens.css` and `src/styles.css`. Files in `public/` are copied to the build as they are.

## Cloudflare deployment

GitHub Actions lints, type-checks, tests and builds every pull request, and deploys the production Worker whenever a commit is pushed to `main`, including merged pull requests. Deployments are serialized to prevent overlapping uploads.

Before the first automated deployment, add a repository Actions secret named `CLOUDFLARE_API_TOKEN` under [Settings → Secrets and variables → Actions](https://github.com/ChristopherPHolder/feenland-mathezauber/settings/secrets/actions). Create a Cloudflare API token using the **Edit Cloudflare Workers** template, scoped to the account in `wrangler.jsonc`, following [Cloudflare's GitHub Actions setup](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/). Local Wrangler login credentials are not available to GitHub Actions.

For a manual deployment:

```sh
npx wrangler login
npm run deploy
```

`npm run deploy` runs `vp build`, then `wrangler deploy`. The [Cloudflare Vite plugin](https://developers.cloudflare.com/workers/vite-plugin/) reads `wrangler.jsonc` (the `fun-math` Worker and Cloudflare account) and writes `dist/wrangler.json` next to the built assets, and Wrangler deploys from that file. Angular navigation falls back to `index.html` through Cloudflare's single-page application handling.

The dev server also runs through the Cloudflare plugin. To preview the production build in Cloudflare's local runtime:

```sh
npm run preview
```

Authentication stays in Wrangler's local credential store. Do not commit tokens or local environment files. There are no backend accounts or analytics. Progress and language preferences remain on the device.

## Architecture

See [navigation](docs/navigation.md) for the screens, the games hub and how a game links back, and [expanding world](docs/architecture/expanding-world.md) for content IDs, durable achievements, locale preferences and catalog growth. The app ships a web manifest so it can be added to a phone's home screen, but no service worker: every launch loads the current deployment from the network, so a new deploy is visible on the next open. `public/ngsw-worker.js` is a tiny safety worker that unregisters the Angular service worker older installs still have and clears its caches.

English, German, Spanish and French are detected from browser preferences and selectable in Settings. Progress and preferences stay on the device; no accounts or analytics.

The Hungry Crocodile lives in the Numbers world under its own chapter. Each of its seven levels is a ten-question comparison round with greater, less and equal choices drawn as a crocodile that eats the bigger side. Level results are real practice results: finishing records completion and stars, and two stars master the level. Every level is open from the start and can be switched from the level strip on the game's intro.

To inspect the full flow, choose All games → any level card → play, then finish a round to reach the completion screen. Next adventure follows the catalog order and eventually reaches the caught-up state. All games inside a game returns to that game's section of the hub, and Settings returns to the screen you came from. Older `/worlds/...` links redirect into the hub.

See [design rules](DESIGN.md) and [verification evidence](docs/verification.md) for shared states, accessibility, responsive coverage, storage recovery and offline navigation.
