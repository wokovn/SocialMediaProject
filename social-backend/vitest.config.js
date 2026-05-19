import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['modules/**/*.js', 'infra/**/*.js'],
      exclude: ['**/*.spec.js', '**/*.test.js', 'node_modules/']
    },
    include: ['**/*.{test,spec}.js'],
    setupFiles: ['./test/setup.js']
  }
});
