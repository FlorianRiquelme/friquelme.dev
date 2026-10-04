import type { ChildProcess } from 'node:child_process';
import { freePort, previewHost, startPreview, waitForPreview } from '../../scripts/preview.mjs';
import { runSmoke } from '../../scripts/smoke-production.mjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { routes, siteOrigin } from '../support/site';

let PORT = 0;

let server: ChildProcess | null = null;

// A good build must pass the production smoke contracts, or the deploy would roll itself back.
describe('production smoke contracts against the built site', () => {
  beforeAll(async () => {
    PORT = await freePort();
    server = startPreview(PORT);
    await waitForPreview(server, PORT);
  });

  afterAll(async () => {
    if (!server || server.exitCode !== null || server.signalCode !== null) return;
    await new Promise<void>(done => {
      server!.once('exit', () => { clearTimeout(timer); done(); });
      const timer = setTimeout(() => server!.kill('SIGKILL'), 3_000);
      server!.kill('SIGTERM');
    });
  });

  it('passes with the sitemap routes and an identical homepage', async () => {
    const result = await runSmoke({
      baseUrl: `http://${previewHost}:${PORT}`, site: 'https://friquelme.dev', distDir: 'dist', checkCacheHeaders: false, identityTimeoutMs: 10_000,
    });
    expect(result).toMatchObject({ ok: true, failures: [] });
    expect(result.routes).toEqual(routes.map(route => `${siteOrigin}${route}`));
  });
});
