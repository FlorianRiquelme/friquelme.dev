import { spawn, execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile, open, unlink } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.argv[2] ?? 'control';
if (!['control', 'matrix', 'probe', 'explore'].includes(mode)) throw new Error('Choose control, matrix, probe, or explore');
if (['matrix', 'explore'].includes(mode) && (!process.env.TRIAL_PROVIDER || !process.env.TRIAL_MODEL)) {
  throw new Error('Choose an authorized TRIAL_PROVIDER and TRIAL_MODEL first; see README.md. No harness credentials are imported.');
}
const id = `${new Date().toISOString().replaceAll(':', '-')}-${mode}-${randomUUID().slice(0, 8)}`;
const output = resolve(root, 'results', id);
await mkdir(output, { recursive: true });
const lockPath = resolve(root, '.trial.lock');
const lock = await open(lockPath, 'wx');
await lock.writeFile(`${process.pid}\n${id}\n`);
const port = Number(process.env.TRIAL_PORT ?? 14375);
const baseURL = `http://100.84.161.116:${port}`;
const env = { ...process.env, E2E_TELEMETRY_DISABLED: '1', TRIAL_PORT: String(port), TRIAL_BASE_URL: baseURL };
let server;
let child;
const runs = [];
const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const sourceHash = async () => createHash('sha256').update(await readFile(resolve(root, '../../dist/blog/index.html'))).digest('hex');
let beforeHash;
try { beforeHash = await sourceHash(); } catch (error) {
  await lock.close(); await unlink(lockPath);
  throw new Error('Build the site with pnpm build before running the trial', { cause: error });
}
const metadata = {
  id, startedAt: new Date().toISOString(), mode, baseURL, runtime: process.version,
  provider: process.env.TRIAL_PROVIDER ?? null, model: process.env.TRIAL_MODEL ?? null,
  versions: pkg.devDependencies, retries: 1, transportRetries: 'upstream AI SDK: initial + up to 5 transient-provider retries; not test retries',
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  sourceHash: beforeHash, interventions: [],
};

async function stop(proc) {
  if (!proc || proc.exitCode !== null || proc.signalCode !== null) return;
  await new Promise(done => {
    proc.once('exit', done);
    proc.kill('SIGTERM');
    const timer = setTimeout(() => proc.kill('SIGKILL'), 3_000);
    timer.unref();
  });
}
async function serve(variant) {
  await stop(server);
  const log = await open(resolve(output, `server-${variant}-${runs.length}.log`), 'wx');
  server = spawn(process.execPath, ['scripts/server.mjs'], { cwd: root, env: { ...env, TRIAL_VARIANT: variant }, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.on('data', data => { log.write(data); });
  server.stderr.on('data', data => { log.write(data); });
  await new Promise((done, reject) => {
    const timer = setTimeout(() => reject(new Error('Fixture server startup timeout')), 10_000);
    server.once('error', reject);
    server.once('exit', code => { clearTimeout(timer); log.close(); reject(new Error(`Fixture server exited ${code}`)); });
    server.stdout.on('data', async data => {
      if (String(data).includes('http://')) {
        clearTimeout(timer);
        try { const response = await fetch(`${baseURL}/blog/`); if (!response.ok) throw new Error(`HTTP ${response.status}`); done(); } catch (error) { reject(error); }
      }
    });
  });
}

function steps(attempt) {
  return (attempt.steps ?? []).flatMap(s => [s, ...steps(s)]);
}
function summarizeE2E(report) {
  const run = report.run;
  return {
    status: run.status, errors: run.errors, summary: run.summary, usage: run.usage,
    engine: run.targets.map(t => t.engine), explore: run.explore,
    results: run.results.filter(r => r.selected).map(r => ({
      title: r.titlePath.join(' / '), status: r.status,
      firstAttempt: r.attempts[0]?.status ?? null,
      attempts: r.attempts.map(a => ({ index: a.index, status: a.status, durationMs: a.durationMs, error: a.error,
        steps: steps(a).map(s => ({ api: s.api, status: s.status, durationMs: s.durationMs, model: s.model, metrics: s.metrics, cache: s.cache, visionInput: s.visionInput, visionDegraded: s.visionDegraded, error: s.error })),
      })),
    })),
  };
}
async function run(label, variant, tool, args, expected) {
  await serve(variant);
  const dest = resolve(output, label);
  await mkdir(dest);
  const log = await open(resolve(dest, 'command.log'), 'wx');
  const started = Date.now();
  const command = tool === 'control' ? ['exec', 'playwright', 'test'] : ['exec', 'e2e', ...args];
  if (tool !== 'control') command.push('--output', dest, '--reporter', 'list,markdown', '--trace', 'on', '--ai-trace', '--debug');
  console.log(`${label}: ${variant}; pnpm ${command.join(' ')}`);
  const viewport = tool !== 'control' && args[0] === 'explore' ? 'mobile' : 'desktop';
  child = spawn('pnpm', command, { cwd: root, env: { ...env, TRIAL_VIEWPORT: viewport, TRIAL_OUTPUT: dest }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', data => { process.stdout.write(data); log.write(data); });
  child.stderr.on('data', data => { process.stderr.write(data); log.write(data); });
  const exitCode = await new Promise((done, reject) => { child.once('error', reject); child.once('close', done); });
  await log.close();
  const row = { label, variant, tool, viewport, args: command, exitCode, durationMs: Date.now() - started, expected };
  try {
    const report = JSON.parse(await readFile(resolve(dest, 'report.json'), 'utf8'));
    row.report = tool === 'control' ? report : summarizeE2E(report);
  } catch (error) { row.reportError = error.message; }
  if (expected === 'pass') row.expectationMet = exitCode === 0 && Boolean(row.report) && (tool === 'control'
    ? row.report.stats.expected === 2 && row.report.stats.skipped === 0
    : row.report.results.length === 2 && row.report.results.every(r => ['passed', 'flaky'].includes(r.status)) && row.report.errors.length === 0);
  else if (expected === 'blocked') row.expectationMet = [2, 3].includes(exitCode) && row.report?.errors?.some(e => e.code === 'MODEL_UNAVAILABLE');
  else if (expected === 'defect') {
    // A provider/engine failure is never credited as a detected product defect.
    if (tool === 'control') {
      const specs = row.report?.suites?.flatMap(s => s.specs ?? []) ?? [];
      const wanted = specs.find(s => s.title.startsWith(variant === 'wrong-link' ? 'desktop:' : 'mobile:'));
      const failedAttempts = wanted?.tests?.flatMap(t => t.results).filter(a => a.status === 'failed') ?? [];
      const check = variant === 'wrong-link' ? /toHaveURL[\s\S]*\/blog\/brownfield-ai\// : /title point.*should hit the pinned essay/;
      row.expectationMet = exitCode === 1 && failedAttempts.length === 2 && failedAttempts.every(a => check.test(a.error?.message ?? ''));
    } else {
      const failingSteps = row.report?.results?.flatMap(r => r.attempts.flatMap(a => a.steps.filter(s => s.status === 'failed'))) ?? [];
      row.expectationMet = exitCode === 1 && row.report.errors.length === 0 && failingSteps.length === 2 && failingSteps.every(s => variant === 'wrong-link'
        ? /toHaveAttribute/.test(s.api) && /href/.test(s.error?.message ?? '') && /brownfield-ai/.test(s.error?.message ?? '')
        : s.api === 'agent.assert' && s.error?.code === 'ASSERTION_FAILED' && s.visionInput === true && !s.visionDegraded);
    }
  } else row.expectationMet = null;
  runs.push(row);
  await writeFile(resolve(output, 'summary.json'), JSON.stringify({ ...metadata, runs }, null, 2));
  await stop(server);
  return row;
}

async function cleanup() { await stop(child); await stop(server); }
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await cleanup(); await lock.close(); await unlink(lockPath); process.exit(130); });
try {
  if (mode === 'control') {
    await run('healthy', 'healthy', 'control', [], 'pass');
    await run('wrong-link', 'wrong-link', 'control', [], 'defect');
    await run('mobile-overlay', 'mobile-overlay', 'control', [], 'defect');
    await run('restored', 'healthy', 'control', [], 'pass');
  } else if (mode === 'probe') {
    await run('no-model', 'healthy', 'e2e', ['run', 'tests/mobile.e2e.ts', '--no-cache', '--retries', '1'], 'blocked');
  } else if (mode === 'matrix') {
    for (let i = 1; i <= 3; i++) await run(`live-${i}`, 'healthy', 'e2e', ['run', '--no-cache', '--retries', '1'], 'pass');
    // A separate warm-up populates the action cache. It is not counted as a replay run.
    await run('cache-warmup', 'healthy', 'e2e', ['run', '--retries', '1'], 'pass');
    for (let i = 1; i <= 3; i++) await run(`cache-${i}`, 'healthy', 'e2e', ['run', '--retries', '1'], 'pass');
    await run('wrong-link', 'wrong-link', 'e2e', ['run', 'tests/journey.e2e.ts', '--no-cache', '--retries', '1'], 'defect');
    await run('mobile-overlay', 'mobile-overlay', 'e2e', ['run', 'tests/mobile.e2e.ts', '--no-cache', '--retries', '1'], 'defect');
    await run('restored', 'healthy', 'e2e', ['run', '--no-cache', '--retries', '1'], 'pass');
  }
  if (mode === 'matrix' || mode === 'explore') {
    await run('exploration', 'healthy', 'e2e', ['explore', 'Explore the homepage, blog listing and pinned operator essay as a first-time reader. Check navigation and mobile readability. Stay on this site; do not follow external links, submit forms or modify data.', '--max-steps', '3', '--timeout', '180000'], 'observe');
  }
} finally {
  await cleanup();
  metadata.finishedAt = new Date().toISOString();
  metadata.sourceUnchanged = beforeHash === await sourceHash();
  await writeFile(resolve(output, 'summary.json'), JSON.stringify({ ...metadata, runs }, null, 2));
  await lock.close();
  await unlink(lockPath);
  console.log(`Evidence: ${output}`);
}
if (runs.some(r => r.expected !== 'observe' && !r.expectationMet) || !metadata.sourceUnchanged) process.exitCode = 1;
