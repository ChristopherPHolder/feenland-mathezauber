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
  },
  fmt: {
    printWidth: 100,
    singleQuote: true,
    // Component templates use Angular's control flow (@if, @for), which plain HTML formatting flattens.
    associations: [{ files: ['src/app/**/*.html'], language: 'angular-html' }],
    ignorePatterns: ['dist/**', '.agents/**', '.claude/**', 'docs/screenshots/**'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.spec.ts'],
    setupFiles: ['src/test-setup.ts'],
  },
}));
