# Feenland Mathezauber

A responsive, multilingual fairyland math adventure built with Angular 22. The first delivery includes Home, language Settings, a six-world preview and a challenge placeholder. All old games and unicorn content have been removed.

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

Authentication stays in Wrangler's local credential store. Do not commit tokens or local environment files. There is no backend, analytics, or user data storage in this starter.

## Architecture

See [expanding world](docs/architecture/expanding-world.md) for content IDs, durable achievements, locale preferences and catalog growth. Production assets are cached by the Angular service worker.

English, German, Spanish and French are detected from browser preferences and selectable in Settings. Progress and preferences stay on the device; no accounts or analytics. Current challenge content is an explicitly labeled preview and grants no mastery or rewards. World/chapter/level screens and gameplay remain follow-up work.
