import { defineConfig } from 'vitest/config';

// Runs against a real deployment (DEPLOYED_BASE_URL); never part of `pnpm verify`.
export default defineConfig({
  test: {
    maxWorkers: 1,
    allowOnly: false,
    passWithNoTests: false,
    include: ['tests/deployed/**/*.test.ts'],
    environment: 'node',
    testTimeout: 90_000,
    hookTimeout: 60_000,
  },
});
