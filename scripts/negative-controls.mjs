// Negative controls: each deliberately broken input must fail for its expected reason, not merely non-zero.
// A config or startup error (exit 2/3 where a test failure is expected) fails the control script.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { previewHost } from './preview.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
process.chdir(root);
const dist = resolve(root, 'dist');
const controlsDirectory = 'reports/controls';
const target = 'desktop-chromium';
const port = 14322;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function run(command, args, options = {}) {
  return new Promise(done => {
    const child = spawn(command, args, { cwd: root, env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1', E2E_TELEMETRY_DISABLED: '1' }, stdio: ['ignore', 'pipe', 'pipe'], ...options });
    let output = '';
    child.stdout.on('data', data => { output += data; });
    child.stderr.on('data', data => { output += data; });
    child.on('close', status => done({ status, output }));
  });
}

const pnpm = args => run(process.execPath, ['scripts/pnpm.mjs', ...args]);

function files(directory, base = directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path, base) : [path.slice(base.length + 1)];
  }).sort();
}

function snapshot() {
  return Object.fromEntries(files(dist).map(file => [file, createHash('sha256').update(readFileSync(join(dist, file))).digest('hex')]));
}

function readReport(name) {
  return JSON.parse(readFileSync(resolve(root, controlsDirectory, name, 'report.json'), 'utf8')).run;
}

async function e2e(name, args = []) {
  const result = await pnpm(['exec', 'e2e', 'run', '--target', target, ...args, '--output', `${controlsDirectory}/${name}`]);
  assert(!/INVALID_CONFIG/.test(result.output) && result.status !== 2, `${name}: configuration error (exit ${result.status}), the control is invalid:\n${result.output}`);
  return result;
}

// The validator must reject the report; an unmet expectation is reported with the validator's own output.
async function expectValidatorRejects(name, reason, exitCode = 0) {
  const result = await run(process.execPath, ['scripts/check-test-results.mjs', 'testerarmy', `${controlsDirectory}/${name}/report.json`, String(exitCode)]);
  assert(result.status === 1 && reason.test(result.output), `${name}: validator did not reject for ${reason} (exit ${result.status}): ${result.output.trim()}`);
}

// A test fails: exit 1, tests actually executed, and the failing attempt carries the expected code and message.
async function expectTestFailure(name, grep, message, code = 'ASSERTION_FAILED') {
  const result = await e2e(name, ['--grep', grep]);
  assert(result.status === 1, `${name}: expected e2e exit 1, got ${result.status}`);
  const run = readReport(name);
  assert(run.summary.executed > 0, `${name}: no test executed`);
  const failed = run.results.filter(test => test.status === 'failed');
  assert(run.status === 'failed' && failed.length > 0 && run.summary.failed === failed.length, `${name}: no failed test in the report`);
  const error = failed[0].attempts[0]?.error;
  assert(error?.code === code, `${name}: expected ${code}, got ${error?.code}`);
  assert(message.test(error.message), `${name}: failure message ${JSON.stringify(error.message)} does not match ${message}`);
  await expectValidatorRejects(name, /did not pass/);
  return `${run.summary.executed} executed, ${failed.length} failed with ${code}`;
}

function pinnedHref() {
  const path = join(dist, 'blog/index.html');
  const html = readFileSync(path, 'utf8');
  assert(html.includes('href="/blog/designing-for-the-operator/"'), 'dist has no pinned essay link to mutate');
  writeFileSync(path, html.replace('href="/blog/designing-for-the-operator/"', 'href="/blog/designing-for-the-operator-mutated/"'));
}

function pageError() {
  const path = join(dist, 'index.html');
  const html = readFileSync(path, 'utf8');
  assert(html.includes('</body>'), 'dist homepage has no body end to inject into');
  writeFileSync(path, html.replace('</body>', '<script>throw new Error("negative control page error")</script></body>'));
}

function deleteAsset() {
  const asset = readFileSync(join(dist, 'index.html'), 'utf8').match(/\/_astro\/[^"']+\.css/)?.[0];
  assert(asset, 'dist homepage references no local stylesheet to delete');
  rmSync(join(dist, asset));
}

// TesterArmy only treats the port as occupied when something answers HTTP (200-499) before its own app starts.
async function occupiedPort() {
  const server = createServer((request, response) => response.end('occupied'));
  await new Promise((done, reject) => { server.once('error', reject); server.listen(port, previewHost, done); });
  try {
    const result = await e2e('occupied-port', ['--grep', '^/ renders']);
    assert(result.status === 3, `occupied-port: expected e2e exit 3, got ${result.status}`);
    assert(/APP_ALREADY_RUNNING/.test(result.output), `occupied-port: APP_ALREADY_RUNNING missing from output:\n${result.output}`);
    assert(!existsSync(resolve(root, controlsDirectory, 'occupied-port/report.json')), 'occupied-port: a report was written although no test could run');
    await expectValidatorRejects('occupied-port', /ENOENT/);
    return 'exit 3, APP_ALREADY_RUNNING, no report, validator rejects';
  } finally { await new Promise(done => server.close(done)); }
}

async function filteredRun() {
  const result = await e2e('filtered');
  assert(result.status === 0, `filtered: the single-target run must pass (exit ${result.status}):\n${result.output}`);
  const run = readReport('filtered');
  assert(run.summary.executed > 0 && run.summary.passed === run.summary.executed && run.summary.failed === 0, 'filtered: run did not execute and pass tests');
  await expectValidatorRejects('filtered', /Browser target did not execute: desktop-firefox/);
  return `exit 0, ${run.summary.passed} passed, validator rejects the unrun targets`;
}

async function missingReport() {
  rmSync(resolve(root, controlsDirectory, 'filtered/report.json'));
  await expectValidatorRejects('filtered', /ENOENT/);
  return 'validator rejects with ENOENT';
}

const failures = [];
rmSync(resolve(root, controlsDirectory), { recursive: true, force: true });
const build = await pnpm(['build']);
if (build.status !== 0) { console.error(build.output); process.exit(1); }
const original = snapshot();
const backup = mkdtempSync(join(tmpdir(), 'dist-backup-'));
cpSync(dist, backup, { recursive: true });

async function control(name, mutate, execute) {
  try {
    mutate?.();
    const evidence = await execute();
    console.log(`PASS ${name}: ${evidence}`);
  } catch (error) {
    failures.push(name);
    console.error(`FAIL ${name}: ${error.message}`);
  } finally {
    rmSync(dist, { recursive: true, force: true });
    cpSync(backup, dist, { recursive: true });
  }
}

try {
  await control('mutated pinned link', pinnedHref, () => expectTestFailure('mutated-href', 'exact pinned essay', /operator-mutated/));
  await control('injected page error', pageError, () => expectTestFailure('page-error', '^/ renders', /negative control page error/));
  await control('deleted local asset', deleteAsset, () => expectTestFailure('deleted-asset', '^/ renders', /404 .*\/_astro\/.+\.css/));
  await control('occupied port 14322', undefined, occupiedPort);
  await control('passing filtered run', undefined, filteredRun);
  await control('missing report', undefined, missingReport);
} finally {
  const restored = snapshot();
  const identical = JSON.stringify(restored) === JSON.stringify(original);
  rmSync(backup, { recursive: true, force: true });
  if (!identical) { failures.push('dist restore'); console.error('FAIL dist was not restored byte-identical'); }
  else console.log(`PASS dist restored byte-identical (${Object.keys(restored).length} files)`);
}

if (failures.length > 0) { console.error(`Negative controls failed: ${failures.join(', ')}`); process.exitCode = 1; }
else console.log('All negative controls failed for their expected reasons');
