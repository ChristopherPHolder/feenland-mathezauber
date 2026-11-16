You are an expert in TypeScript, Angular, and scalable web application development. You write functional, maintainable, performant, and accessible code following Angular and TypeScript best practices.

## TypeScript Best Practices

- Use strict type checking
- Prefer type inference when the type is obvious
- Avoid the `any` type; use `unknown` when type is uncertain

## Angular Best Practices

- Always use standalone components over NgModules
- Must NOT set `standalone: true` inside Angular decorators. It's the default in Angular v20+.
- Do NOT set `changeDetection: ChangeDetectionStrategy.OnPush` explicitly. `OnPush` is the default in Angular v22+.
- Use signals for state management
- Implement lazy loading for feature routes
- Do NOT use the `@HostBinding` and `@HostListener` decorators. Put host bindings inside the `host` object of the `@Component` or `@Directive` decorator instead
- Use `NgOptimizedImage` for all static images.
  - `NgOptimizedImage` does not work for inline base64 images.

## Accessibility Requirements

- It MUST pass all AXE checks.
- It MUST follow all WCAG AA minimums, including focus management, color contrast, and ARIA attributes.

## Components

- Keep components small and focused on a single responsibility
- Use `input()` and `output()` functions instead of decorators
- Use `model()` for two-way bound properties with `[(prop)]` syntax instead of pairing `input()` with `output()`
- Use `computed()` for derived state
- Use `linkedSignal()` for state derived from multiple reactive sources that must stay synchronized
- Prefer inline templates for small components
- Prefer Signal Forms (`@angular/forms/signals`) for new forms. They are stable in Angular v22+ and provide signal-based state, type-safe field access, and schema-based validation
- When not using Signal Forms, prefer Reactive forms instead of Template-driven ones
- Do NOT use `ngClass`, use `class` bindings instead
- Do NOT use `ngStyle`, use `style` bindings instead
- Do NOT import `CommonModule`, import only the directives and pipes the template uses, such as `AsyncPipe` or `DatePipe`
- When using external templates/styles, use paths relative to the component TS file.

## State Management

- Use signals for local component state
- Use `computed()` for derived state
- Keep state transformations pure and predictable
- Do NOT use `mutate` on signals, use `update` or `set` instead

## Templates

- Keep templates simple and avoid complex logic
- Use native control flow (`@if`, `@for`, `@switch`) instead of `*ngIf`, `*ngFor`, `*ngSwitch`
- Use the async pipe to handle observables
- Do not assume globals like (`new Date()`) are available.

## Services

- Design services around a single responsibility
- Use the `providedIn: 'root'` option for singleton services
- Prefer the `@Service` decorator over `@Injectable({providedIn: 'root'})` for new singleton services (Angular v22+)
- Use the `inject()` function instead of constructor injection

## Modern Web Guidance

Google Chrome's `modern-web-guidance` skill lives in `.agents/skills/modern-web-guidance` (symlinked into `.claude/skills`, pinned in `skills-lock.json`). Before writing or changing HTML, CSS or client-side browser code, search it for the pattern at hand and follow the guide:

```sh
npx -y modern-web-guidance@latest search "<2-5 word query>"
npx -y modern-web-guidance@latest retrieve "<id>"
```

Update it with `npx -y modern-web-guidance@latest update`.

## Architecture

- Layers, from the bottom: `@feenland/ui` (`packages/ui`, the design system) → `src/app/core` → `src/app/shared` → `src/app/pages/<game>`. Import only downwards. See `docs/architecture/layers.md`.
- `@feenland/ui` holds dumb components only: inputs, `model()`, outputs and content projection; no `inject()`, router, forms, storage, translation or Three.js. Lint enforces it. Selectors use the `ui-` prefix. Read `packages/ui/README.md` before adding to it.
- Import the design system as `@feenland/ui`, never by a relative path.
- When a game needs a presentational piece another game already has (a reward burst, a coach dialog, a pill button), put it in `@feenland/ui` and use it from both instead of copying the folder of the last game.
- Keep everything only one game uses inside that game's folder. Something two games share goes to `shared` (widgets) or `core` (logic, stores), not into one game's folder for the other to import.

## Tooling

- The toolchain is Vite+ (`vp`); there is no Angular CLI and no `angular.json`. `vite.config.ts` holds the whole setup: the ngp and Cloudflare plugins, `lint`, `fmt`, `test`, `staged` and the `run.tasks`.
- Use the `vp` commands: `vp dev`, `vp test`, `vp check` (format, lint and type errors), `vp check --fix`, `vp build`. Without the global `vp`, use the matching `npm run` script (`dev`, `test`, `check`, `build`) or `npx vp <command>`.
- Run project tasks with `vp run <task>`: `tokens` compiles `packages/ui/tokens.json`, `ready` runs everything CI runs (`vp check --deny-warnings`, the tests and the build), and `deploy` runs `ready` and then deploys. Tasks are cached, so an unchanged rerun replays.
- `@push-based/vite-plugin-ngp` compiles Angular. Every `@angular/*` package must stay exactly at the version the plugin was built against (see `README.md`). Never bump Angular on its own.
- Use Node.js 26 (`devEngines` in `package.json`, `.nvmrc`).
- Import test APIs from `vite-plus/test`, not `vitest`, and Vite APIs from `vite-plus`. The `vite-plus/prefer-vite-plus-imports` lint rule enforces it.
- The pre-commit hook (`.vite-hooks/pre-commit`, installed by `npm install` through `vp config`) runs `vp staged`, which runs `vp check --fix` on the staged files. Run `vp run ready` before pushing. CI fails on formatting differences and lint warnings.

<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Built-in Commands vs Scripts

`vp <name>` runs a built-in command. `vp run <name>` runs a `package.json` script or a `vite.config.ts` task. Scripts cannot overwrite built-ins, so `vp dev` and `vp run dev` may do different things. Check `package.json` and `vite.config.ts` first, and run `vp run <name>` when the project defines a script or task with that name.

## Running Scripts

Run TypeScript and JavaScript files with `vpx <file>`, for example `vpx ./scripts/seed.ts --dry-run`. It handles enums, decorators, JSX, and tsconfig `paths`, so do not add `tsx` or `ts-node` to run scripts. `vpx --watch <file>` reruns the file when a file it uses changes, in place of `tsx watch`. `vp node <file>` runs plain Node.js.

## Tool Versions

Run `vp toolchain` to show versions and relationships in the active Vite+
release. Add a tool name to select part of the graph. For example, run
`vp toolchain vite`. Use `--global` to ignore the local `vite-plus` package. Use
`vp why <package>` to show the package-manager dependency graph.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->
