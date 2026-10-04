import type { E2EConfig } from 'e2e';
import { freePort, previewHost } from './scripts/preview.mjs';
import { targets } from './tests/e2e/targets';

// One port per run: use E2E_PREVIEW_PORT when set, else let the OS pick. The choice is written back to the
// environment so a reload of this config (e.g. in a worker process) agrees with the process that started the app.
const requested = process.env.E2E_PREVIEW_PORT;
if (requested !== undefined && !(/^\d+$/.test(requested) && Number(requested) >= 1024 && Number(requested) <= 65535)) {
  throw new Error(`Invalid E2E_PREVIEW_PORT: ${requested}`);
}
const port = requested === undefined ? await freePort() : Number(requested);
process.env.E2E_PREVIEW_PORT = String(port);
const app = {
  url: `http://${previewHost}:${port}`,
  environment: 'test' as const,
  // TesterArmy passes the app only PATH, HOME, temp directories and `env`.
  command: { executable: process.execPath, args: ['scripts/preview.mjs', String(port)], env: { ASTRO_TELEMETRY_DISABLED: '1' }, startupTimeout: 30_000 },
};

// Deterministic browser suite: no agents are configured, so no test can call a model.
export default {
  projectId: 'friquelme-dev',
  targets: targets.map(({ name, engine }) => ({ name, engine, app })),
  tests: ['tests/e2e/**/*.e2e.ts'],
  workers: 1,
  retries: 0,
  timeout: 30_000,
  assertionTimeout: 5_000,
  trace: 'retain-on-failure',
  cache: 'off',
  output: 'reports/browser',
  reporters: ['list', 'markdown'],
} satisfies E2EConfig;
