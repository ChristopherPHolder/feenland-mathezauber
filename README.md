# Feenland Mathezauber

[Play Feenland Mathezauber](https://fun-math.toholderandrews-4c2.workers.dev)

A responsive, multilingual fairyland math adventure built with Angular 22. The navigation includes Home, a world map, world/chapter paths, level selection, result-driven completion and language Settings. Every level on the map is a playable game.

## Development

Use Node.js 24 and npm.

```sh
npm ci
npm start
npm test -- --watch=false
npm run build
```

## Cloudflare deployment

GitHub Actions runs tests and deploys the production Worker whenever a commit is pushed to `main`, including merged pull requests. Deployments are serialized to prevent overlapping uploads. Wrangler builds the production app as part of deployment.

Before the first automated deployment, add a repository Actions secret named `CLOUDFLARE_API_TOKEN` under [Settings → Secrets and variables → Actions](https://github.com/ChristopherPHolder/feenland-mathezauber/settings/secrets/actions). Create a Cloudflare API token using the **Edit Cloudflare Workers** template, scoped to the account in `wrangler.jsonc`, following [Cloudflare's GitHub Actions setup](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/). Local Wrangler login credentials are not available to GitHub Actions.

For a manual deployment:

```sh
npx wrangler login
npm run deploy
```

Wrangler builds Angular before uploading the production assets. `wrangler.jsonc` configures the `fun-math` Worker and Cloudflare account. Angular navigation falls back to `index.html` through Cloudflare's single-page application handling.

To preview the production build with Cloudflare's local runtime:

```sh
npm run preview
```

Authentication stays in Wrangler's local credential store. Do not commit tokens or local environment files. There are no backend accounts or analytics. Progress and language preferences remain on the device.

## Architecture

See [expanding world](docs/architecture/expanding-world.md) for content IDs, durable achievements, locale preferences and catalog growth. The app ships a web manifest so it can be added to a phone's home screen, but no service worker: every launch loads the current deployment from the network, so a new deploy is visible on the next open. `public/ngsw-worker.js` is a tiny safety worker that unregisters the Angular service worker older installs still have and clears its caches.

English, German, Spanish and French are detected from browser preferences and selectable in Settings. Progress and preferences stay on the device; no accounts or analytics.

The Hungry Crocodile lives in the Numbers world under its own chapter. Each of its six levels is a ten-question comparison round with greater, less and equal choices drawn as a crocodile that eats the bigger side. Level results are real practice results: finishing records completion and stars, and two stars master the level and open the next one.

To inspect the full flow, choose Explore Worlds → Number Kingdom → a chapter → a game, then finish a round to reach the completion screen. Next Adventure follows the catalog order and eventually reaches the caught-up state. Settings returns to the screen you came from.

See [design rules](DESIGN.md) and [verification evidence](docs/verification.md) for shared states, accessibility, responsive coverage, storage recovery and offline navigation.
