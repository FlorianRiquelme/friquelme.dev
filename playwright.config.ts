import { defineConfig } from '@playwright/test';
import { previewHost } from './scripts/preview.mjs';
import { browserProjects } from './scripts/browser-projects.mjs';
import type { Project } from '@playwright/test';

const port = 14322;
const baseURL = `http://${previewHost}:${port}`;

export default defineConfig({
  testDir: './tests/e2e',
  forbidOnly: true,
  fullyParallel: true,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [['list'], ['json', { outputFile: 'reports/browser/results.json' }], ['html', { outputFolder: 'reports/browser/html', open: 'never' }]],
  outputDir: 'reports/browser/artifacts',
  use: { baseURL, reducedMotion: 'reduce', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: browserProjects as Project[],
  webServer: { command: `node scripts/preview.mjs ${port}`, url: baseURL, reuseExistingServer: false, timeout: 30_000 },
});
