import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { networkInterfaces } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const tailnetHost = '100.84.161.116';
const hasTailnet = Object.values(networkInterfaces()).flat().some(address => address?.address === tailnetHost);
// agent-server's previews stay on its tailnet interface; other hosts (including CI) use loopback.
export const previewHost = hasTailnet ? tailnetHost : '127.0.0.1';

// Asks the OS for a free port. The close-to-bind race is left to `strictPort`, which fails loudly.
export function freePort(host = previewHost) {
  return new Promise((done, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, host, () => {
      const { port } = probe.address();
      probe.close(error => (error ? reject(error) : done(port)));
    });
  });
}

export function startPreview(port) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid preview port');
  return spawn(process.execPath, [fileURLToPath(import.meta.url), String(port)], {
    cwd: root, stdio: ['ignore', 'inherit', 'inherit', 'ipc'], env: { ...process.env, FORCE_COLOR: '0', ASTRO_TELEMETRY_DISABLED: '1' },
  });
}

export function waitForPreview(server, port, timeoutMs = 30_000) {
  return new Promise((done, reject) => {
    const finish = error => {
      clearTimeout(timer);
      server.off('message', onMessage);
      server.off('exit', onExit);
      server.off('error', onError);
      if (error) reject(error); else done();
    };
    const onMessage = message => {
      if (message?.kind === 'preview-ready' && message.host === previewHost && message.port === port) finish();
    };
    const onExit = (code, signal) => finish(new Error(`Preview exited before readiness (${signal ?? code})`));
    const onError = error => finish(error);
    const timer = setTimeout(() => {
      server.kill('SIGTERM');
      finish(new Error(`Preview did not become ready within ${timeoutMs}ms`));
    }, timeoutMs);
    server.on('message', onMessage);
    server.once('exit', onExit);
    server.once('error', onError);
    if (server.exitCode !== null || server.signalCode !== null) onExit(server.exitCode, server.signalCode);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  let server;
  let stopping = false;
  const stop = async () => {
    stopping = true;
    if (server) { await server.stop(); process.exit(0); }
  };
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, stop);
  try {
    if (process.argv[2] === undefined) throw new Error('Usage: node scripts/preview.mjs <port>');
    const port = Number(process.argv[2]);
    if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid preview port');
    const { preview } = await import('astro');
    server = await preview({ root, server: { host: previewHost, port }, vite: { preview: { strictPort: true } } });
    if (stopping) await stop();
    else if (process.send) process.send({ kind: 'preview-ready', host: previewHost, port: server.port }, () => process.disconnect());
  } catch (error) { console.error(error); process.exit(1); }
}
