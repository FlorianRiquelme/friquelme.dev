import { spawn } from 'node:child_process';
import { mkdir, open, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkTestResults } from './check-test-results.mjs';
import { browserTargets } from './browser-targets.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
process.chdir(root);
const infrastructure = process.argv.includes('--infra');
const reportDirectory = infrastructure ? 'reports/verification-infra' : 'reports/verification';
const directory = resolve(root, reportDirectory);
const lockPath = resolve(root, infrastructure ? '.verification-infra.lock' : '.verification.lock');
const lock = await open(lockPath, 'wx');
await lock.writeFile(String(process.pid));
const summary = { startedAt: new Date().toISOString(), runtime: process.version, status: 'failed', stages: [] };
let child;
let requestedSignal;
function rejectInterrupt() {
  if (requestedSignal) throw new Error(`Verification interrupted (${requestedSignal})`);
}
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => {
  requestedSignal = signal;
  summary.signal = signal;
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === 'win32') child.kill(signal);
  else process.kill(-child.pid, signal);
});
try {
  await rm(directory, { recursive: true, force: true });
  if (!infrastructure) await rm(resolve(root, 'reports/browser'), { recursive: true, force: true });
  await mkdir(directory, { recursive: true });
  const required = Number((await readFile(resolve(root, '.nvmrc'), 'utf8')).trim());
  if (Number(process.versions.node.split('.')[0]) !== required) throw new Error(`Use repository Node ${required}; the agent must select that runtime before verification`);
  const stages = infrastructure ? [
    ['infra-types', ['-C', 'infra', 'exec', 'tsc', '--noEmit']],
    ['infra-tests', ['-C', 'infra', 'exec', 'vitest', 'run', '--reporter=default', '--reporter=json', `--outputFile=${resolve(directory, 'infra.json')}`], 'vitest', `${reportDirectory}/infra.json`],
  ] : [
    ['types', ['exec', 'astro', 'check']],
    ['unit', ['exec', 'vitest', 'run', '--reporter=default', '--reporter=json', '--outputFile=reports/verification/unit.json'], 'vitest', 'reports/verification/unit.json'],
    ['build', ['build']],
    ['dist', ['exec', 'vitest', 'run', '--config', 'vitest.build.config.ts', '--reporter=default', '--reporter=json', '--outputFile=reports/verification/dist.json'], 'vitest', 'reports/verification/dist.json'],
    ['browser', ['exec', 'e2e', 'run'], 'testerarmy', 'reports/browser/report.json'],
    ['report-contracts', ['verify:reports']],
  ];
  for (const [name, args, format, reportPath] of stages) {
    rejectInterrupt();
    const stage = { name, command: ['pnpm', ...args], status: 'failed', startedAt: new Date().toISOString() };
    summary.stages.push(stage);
    const log = await open(resolve(directory, `${name}.log`), 'w');
    let stdout = '';
    try {
      rejectInterrupt();
      child = spawn('pnpm', args, { cwd: root, env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1', E2E_TELEMETRY_DISABLED: '1' }, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
      for (const [stream, output] of [[child.stdout, process.stdout], [child.stderr, process.stderr]]) {
        stream.on('data', data => { output.write(data); log.write(data); if (stream === child.stdout) stdout += data; });
      }
      const outcome = await new Promise((done, reject) => {
        child.once('error', reject);
        child.once('close', (exitCode, signal) => done({ exitCode, signal }));
      });
      Object.assign(stage, outcome);
      if (stage.exitCode !== 0) throw new Error(`${name} process failed (${stage.signal ?? stage.exitCode})`);
      if (format) {
        stage.report = reportPath;
        Object.assign(stage, await checkTestResults(format, resolve(root, reportPath), stage.exitCode, format === 'testerarmy' ? browserTargets.map(target => target.name) : []));
      }
      if (name === 'report-contracts') {
        const counts = Object.fromEntries([...stdout.matchAll(/^# (tests|pass|fail|cancelled|skipped|todo) (\d+)$/gm)].map(match => [match[1], Number(match[2])]));
        if (!(counts.tests > 0 && counts.pass === counts.tests && counts.fail === 0 && counts.cancelled === 0 && counts.skipped === 0 && counts.todo === 0)) throw new Error('Report-contract tests are empty, failed or skipped');
        stage.tests = counts.tests;
      }
      rejectInterrupt();
      stage.status = 'passed';
    } catch (error) { stage.error = error.message; throw error; }
    finally { stage.finishedAt = new Date().toISOString(); await log.close(); }
  }
  rejectInterrupt();
  summary.status = 'passed';
} catch (error) {
  summary.error = error.message;
  console.error(`Verification failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  summary.finishedAt = new Date().toISOString();
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
  await lock.close();
  await unlink(lockPath);
  console.log(`Verification ${summary.status}: ${reportDirectory}/summary.json`);
}
