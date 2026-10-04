import { spawnSync } from 'node:child_process';
import { createServer, type Server } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { freePort, previewHost } from '../../scripts/preview.mjs';

const held: Server[] = [];
afterEach(async () => { await Promise.all(held.splice(0).map(server => new Promise(done => server.close(done)))); });

const hold = (port: number) => new Promise<void>((done, reject) => {
  const server = createServer();
  held.push(server);
  server.once('error', reject);
  server.listen(port, previewHost, done);
});

describe('freePort', () => {
  it('returns an unprivileged port that can be bound immediately', async () => {
    const port = await freePort();
    expect(Number.isInteger(port)).toBe(true);
    expect(port).toBeGreaterThanOrEqual(1024);
    expect(port).toBeLessThanOrEqual(65535);
    await expect(hold(port)).resolves.toBeUndefined();
  });

  it('returns a different port while the first is still held', async () => {
    const first = await freePort();
    await hold(first);
    expect(await freePort()).not.toBe(first);
  });
});

describe('freePort host', () => {
  it('binds on the requested host, so an unassigned address fails', async () => {
    await expect(freePort('203.0.113.1')).rejects.toThrow();
  });
});

describe('preview CLI', () => {
  it('fails with a usage error instead of defaulting a port when none is given', () => {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('../../scripts/preview.mjs', import.meta.url))], { encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Usage: node scripts/preview.mjs <port>');
  });
});
