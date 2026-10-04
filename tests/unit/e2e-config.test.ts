import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { previewHost } from '../../scripts/preview.mjs';

// TesterArmy loads e2e.config.ts per run; the preview port must be one value shared by the app url and command.
const saved = process.env.E2E_PREVIEW_PORT;
beforeEach(() => { vi.resetModules(); });
afterEach(() => { if (saved === undefined) delete process.env.E2E_PREVIEW_PORT; else process.env.E2E_PREVIEW_PORT = saved; });

const load = async () => (await import('../../e2e.config')).default;

describe('e2e.config.ts preview port', () => {
  it('uses E2E_PREVIEW_PORT exactly for the app url and the preview command', async () => {
    process.env.E2E_PREVIEW_PORT = '23456';
    const { targets } = await load();
    expect(targets.length).toBeGreaterThan(0);
    for (const { app } of targets) {
      expect(app.url).toBe(`http://${previewHost}:23456`);
      expect(app.command.args).toEqual(['scripts/preview.mjs', '23456']);
    }
  });

  it('allocates one port for url and command when the variable is unset', async () => {
    delete process.env.E2E_PREVIEW_PORT;
    const { targets } = await load();
    const port = Number(process.env.E2E_PREVIEW_PORT);
    expect(port).toBeGreaterThanOrEqual(1024);
    expect(targets[0].app.url).toBe(`http://${previewHost}:${port}`);
    expect(targets[0].app.command.args).toEqual(['scripts/preview.mjs', String(port)]);
  });

  it.each(['abc', '80', '1023', '65536', '12.5', '', '1e4'])('rejects the invalid value %j', async value => {
    process.env.E2E_PREVIEW_PORT = value;
    await expect(load()).rejects.toThrow(`Invalid E2E_PREVIEW_PORT: ${value}`);
  });
});
