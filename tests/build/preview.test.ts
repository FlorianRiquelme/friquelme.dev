import { spawn, type ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const ROOT = resolve(fileURLToPath(import.meta.url), '../../..');
const PORT = 14321;
const BASE = `http://localhost:${PORT}`;

let server: ChildProcess | null = null;

async function waitForServer(timeoutMs = 30_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(BASE);
      if (res.status >= 200 && res.status < 500) return;
    } catch {
      // not yet ready
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`preview server did not start within ${timeoutMs}ms`);
}

describe('astro preview server', () => {
  beforeAll(async () => {
    server = spawn(
      'pnpm',
      [
        'exec',
        'astro',
        'preview',
        '--host',
        '127.0.0.1',
        '--port',
        String(PORT),
      ],
      {
        cwd: ROOT,
        stdio: 'inherit',
        env: { ...process.env, FORCE_COLOR: '0' },
      },
    );
    await waitForServer();
  });

  afterAll(() => {
    server?.kill('SIGTERM');
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

  it('serves /og/index.png with HTTP 200 and PNG content-type', async () => {
    const res = await fetch(`${BASE}/og/index.png`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
  });
});
