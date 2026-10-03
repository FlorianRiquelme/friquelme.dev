import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';

const baseURL = process.env.TRIAL_BASE_URL ?? 'http://100.84.161.116:14375';
const output = process.env.TRIAL_OUTPUT ?? 'test-results';

export default defineConfig({
  testDir: './control',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 1,
  workers: 1,
  reporter: [['list'], ['json', { outputFile: resolve(output, 'report.json') }]],
  outputDir: resolve(output, 'artifacts'),
  use: {
    baseURL,
    browserName: 'chromium',
    trace: 'on',
    screenshot: 'on',
  },
});
