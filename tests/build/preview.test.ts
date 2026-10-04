import type { ChildProcess } from 'node:child_process';
import { freePort, previewHost, startPreview, waitForPreview } from '../../scripts/preview.mjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let PORT = 0;
let BASE = '';

let server: ChildProcess | null = null;

describe('astro preview server', () => {
  beforeAll(async () => {
    PORT = await freePort();
    BASE = `http://${previewHost}:${PORT}`;
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

  it('serves the homepage with HTTP 200 and HTML content-type', async () => {
    const res = await fetch(BASE);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type') ?? '').toContain('text/html');
  });

  it('serves /blog/ with HTTP 200', async () => {
    const res = await fetch(`${BASE}/blog/`);
    expect(res.status).toBe(200);
  });

  it('refuses an occupied preview port instead of falling back to another server', async () => {
    const collision = startPreview(PORT);
    try {
      await expect(waitForPreview(collision, PORT, 8_000)).rejects.toThrow('Preview exited before readiness');
      expect(collision.exitCode).toBe(1);
    } finally {
      if (collision.exitCode === null && collision.signalCode === null) {
        await new Promise<void>(done => { collision.once('exit', () => done()); collision.kill('SIGTERM'); });
      }
    }
  });

  it.each([
    ['/rss.xml', 'xml'],
    ['/sitemap-index.xml', 'xml'],
    ['/sitemap-0.xml', 'xml'],
    ['/llms.txt', 'text/plain'],
    ['/llms-full.txt', 'text/plain'],
  ])('serves %s with its expected media type', async (path, type) => {
    const res = await fetch(`${BASE}${path}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain(type);
    expect((await res.text()).trim()).not.toBe('');
  });

  it('serves /og/index.png with HTTP 200 and PNG content-type', async () => {
    const res = await fetch(`${BASE}/og/index.png`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
  });
});
