import { cloudflare } from '@cloudflare/vite-plugin';
import { ngp } from '@push-based/vite-plugin-ngp';
import { defineConfig } from 'vite-plus';

export default defineConfig(({ mode }) => ({
  plugins: [
    ngp({
      budgets: [
        { type: 'initial', maximumWarning: '500kB', maximumError: '1MB' },
        { type: 'anyComponentStyle', maximumWarning: '4kB', maximumError: '12kB' },
      ],
    }),
    // Vitest runs the specs in jsdom, not in the Workers runtime.
    mode !== 'test' && cloudflare(),
  ],
  // `@feenland/ui` and any other alias come from the paths in tsconfig.json.
  resolve: { tsconfigPaths: true },
  server: { port: 4200 },
  lint: {
    ignorePatterns: ['dist/**', '.agents/**', '.claude/**'],
    jsPlugins: [{ name: 'vite-plus', specifier: 'vite-plus/oxlint-plugin' }],
    options: { typeAware: true, typeCheck: true },
    rules: {
      'vite-plus/prefer-vite-plus-imports': 'error',
      // Interface methods such as a loader world's `setState(_: null)` take a parameter they ignore.
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      // The 3D worlds copy a collection before looping over it on purpose: the loop body removes
      // the item it is looking at, which would skip the next one in a live Set, Map or children list.
      'unicorn/no-useless-spread': 'off',
      // Labels and ids are spread into code points on purpose; none of them hold emoji.
      'typescript/no-misused-spread': 'off',
    },
    overrides: [
      {
        // The app reaches the design system only through its public entry point.
        files: ['src/**/*.ts'],
        rules: {
          'no-restricted-imports': [
            'error',
            {
              patterns: [
                {
                  regex: 'packages/',
                  message: "Import the design system from '@feenland/ui', not by path.",
                },
              ],
            },
          ],
        },
      },
      {
        // @feenland/ui holds dumb components only: no app code, services, routing, forms or 3D.
        files: ['packages/ui/**/*.ts'],
        rules: {
          'no-restricted-imports': [
            'error',
            {
              paths: [
                {
                  name: '@angular/core',
                  importNames: ['inject', 'Injectable', 'Service'],
                  message: 'Design-system components take data through inputs; the app injects.',
                },
                { name: '@angular/router', message: 'Project a link from the app instead.' },
                { name: '@angular/forms', message: 'Forms belong to the app.' },
                { name: 'three', message: '3D scenes belong to the app.' },
              ],
              patterns: [
                {
                  regex: '^\\.\\./\\.\\./|/src/app/|^@feenland/',
                  message: 'The design system must not import the app or itself by name.',
                },
              ],
            },
          ],
        },
      },
      {
        // Specs save, stub and restore methods such as Storage.prototype.setItem and pass spies
        // to expect(), which reads them unbound by design.
        files: ['src/**/*.spec.ts'],
        rules: { 'typescript/unbound-method': 'off' },
      },
    ],
  },
  fmt: {
    printWidth: 100,
    singleQuote: true,
    // Component templates use Angular's control flow (@if, @for), which plain HTML formatting flattens.
    associations: [{ files: ['src/app/**/*.html'], language: 'angular-html' }],
    ignorePatterns: [
      'dist/**',
      '.agents/**',
      '.claude/**',
      '.impeccable/**',
      'docs/screenshots/**',
      // Sprite-sheet frame data written by the image tooling.
      'public/images/**/*.json',
    ],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.spec.ts', 'packages/*/src/**/*.spec.ts'],
    setupFiles: ['src/test-setup.ts'],
  },
  // The pre-commit hook in .vite-hooks runs `vp staged`, which formats and lints the staged files.
  staged: {
    '*': 'vp check --fix',
  },
  // `vp run <task>`. Tasks are cached: a rerun with unchanged inputs replays the last result.
  run: {
    tasks: {
      // Compiles packages/ui/tokens.json into packages/ui/styles/tokens.css.
      tokens: 'node packages/ui/scripts/build-tokens.mjs',
      // Everything CI checks before a pull request can merge.
      ready: {
        command: ['vp check --deny-warnings', 'vp test run', 'vp build'],
        // The Cloudflare plugin writes .wrangler/ during the build; it is not an input of any step.
        cache: { input: [{ auto: true }, '!.wrangler/**'] },
      },
      // Production deployment. Wrangler reads CLOUDFLARE_API_TOKEN, which Vite Task passes through.
      deploy: {
        command: 'wrangler deploy',
        dependsOn: ['ready'],
        cache: false,
      },
    },
  },
}));
