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
      ],
    },
  },
});
