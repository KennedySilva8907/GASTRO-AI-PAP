import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    hookTimeout: 30000,
    setupFiles: ['./tests/helpers/browser-globals.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 55,
        statements: 60,
      },
      include: ['src/**/*.js', 'api/**/*.js'],
      // Excluded from coverage: page-level entry scripts and DOM glue that
      // need a full browser/Supabase environment to exercise. They are
      // covered by manual QA and the html-hints / design-contract
      // configuration tests rather than unit tests.
      exclude: [
        'src/chat/matter-setup.js',
        'src/recipes/carousel.js',
        'src/shared/animations.js',
        'src/chat/index.js',
        'src/challenges/index.js',
        'src/recipes/index.js',
        'src/main.js',
        'src/challenges/ui.js',
        'src/chat/handlers.js',
        'src/recipes/preloader.js',
        // V3 auth page bundles — each is a thin DOMContentLoaded handler
        // that wires Supabase OAuth/forms/redirects. Unit-mocking would
        // duplicate the implementation; behaviour is verified via the
        // auth-endpoints integration tests + manual sign-in QA.
        'src/auth/account.js',
        'src/auth/callback.js',
        'src/auth/client.js',
        'src/auth/forgot-password.js',
        'src/auth/login.js',
        'src/auth/register.js',
        'src/auth/reset-password.js',
        'src/auth/session.js',
        'src/auth/transitions.js',
      ],
    },
  },
});
