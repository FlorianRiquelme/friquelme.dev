import { spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const major = Number(readFileSync(resolve(root, '.nvmrc'), 'utf8').trim());
const executable = process.platform === 'win32' ? 'node.exe' : 'node';
let runtime = Number(process.versions.node.split('.')[0]) === major ? process.execPath : undefined;
if (!runtime) {
  const stores = [
    [resolve(process.env.FNM_DIR ?? resolve(homedir(), '.local/share/fnm'), 'node-versions'), 'installation/bin'],
    [resolve(process.env.NVM_DIR ?? resolve(homedir(), '.nvm'), 'versions/node'), 'bin'],
  ];
  for (const [store, binaryDirectory] of stores) {
    if (!existsSync(store)) continue;
    const versions = readdirSync(store).filter(version => new RegExp(`^v${major}\\.\\d+\\.\\d+$`).test(version)).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    runtime = versions.map(version => resolve(store, version, binaryDirectory, executable)).find(path => existsSync(path));
    if (runtime) break;
  }
}
if (!runtime) {
  console.error(`Repository Node ${major} is not installed in the current runtime or supported fnm/nvm store. The agent must install/select it before continuing.`);
  process.exitCode = 1;
} else {
  const child = spawn('pnpm', process.argv.slice(2), {
    cwd: root, stdio: 'inherit', env: { ...process.env, PATH: `${dirname(runtime)}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH ?? ''}` },
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => child.kill(signal));
  child.once('error', error => { console.error(error.message); process.exitCode = 1; });
  child.once('exit', (code, signal) => { process.exitCode = code ?? (signal === 'SIGTERM' ? 143 : 1); });
}
