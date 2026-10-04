import { getViteConfig } from 'astro/config';

export default getViteConfig({
  test: {
    maxWorkers: 2,
    allowOnly: false,
    passWithNoTests: false,
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    exclude: ['tests/build/**', 'tests/deployed/**', 'tests/e2e/**', 'node_modules/**'],
  },
});
