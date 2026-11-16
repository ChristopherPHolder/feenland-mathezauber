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
  server: { port: 4200 },
  lint: {
    ignorePatterns: ['dist/**', '.agents/**', '.claude/**'],
    options: { typeAware: true, typeCheck: true },
    rules: {
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
    include: ['src/**/*.spec.ts'],
    setupFiles: ['src/test-setup.ts'],
  },
}));
