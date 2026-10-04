import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, copyFile, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { stripVTControlCharacters } from 'node:util';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = fileURLToPath(new URL('../..', import.meta.url));
const commandStub = String.raw`#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { browserTargets } from '../scripts/browser-targets.mjs';
const rawArgs = process.argv.slice(2);
const args = rawArgs[0] === '-C' ? rawArgs.slice(2) : rawArgs;
const scenario = process.env.TEST_REPORT_SCENARIO;
function save(path, report) {
  mkdirSync(path.slice(0, path.lastIndexOf('/')), { recursive: true });
  writeFileSync(path, typeof report === 'string' ? report : JSON.stringify(report));
}
if (args[1] === 'vitest') {
  if (scenario === 'focused-infra') process.exit(1);
  const path = args.find(arg => arg.startsWith('--outputFile=')).split('=')[1];
  const report = {
    success: true, numTotalTests: 1, numPassedTests: 1, numFailedTests: 0, numPendingTests: 0, numTodoTests: 0,
    numFailedTestSuites: 0, numPendingTestSuites: 0,
    snapshot: { failure: false, unmatched: 0 },
    testResults: [{ status: 'passed', assertionResults: [{ status: 'passed' }] }],
  };
  if (scenario === 'missing-unit') process.exit(0);
  if (scenario === 'malformed-unit') { save(path, '{'); process.exit(0); }
  if (scenario === 'empty-unit') Object.assign(report, { numTotalTests: 0, numPassedTests: 0, testResults: [] });
  if (scenario === 'skipped-unit') report.numPendingTests = 1;
  if (scenario === 'todo-unit') report.numTodoTests = 1;
  if (scenario === 'inconsistent-unit') report.testResults[0].assertionResults = [];
  save(path, report);
}
if (args[1] === 'e2e') {
  const result = target => ({
    kind: 'test', testId: 'tests/e2e/site.e2e.ts::page', targetId: target.name, selected: true, status: 'passed',
    attempts: [{ index: 0, status: 'passed', secondaryErrors: [], cleanup: 'complete', steps: [{ kind: 'app', api: 'app.open', status: 'passed' }] }],
  });
  const results = browserTargets.map(result);
  const count = results.length;
  const report = {
    schemaVersion: 'report-1',
    run: {
      specVersion: '0.1', status: 'passed', exitCode: 0, errors: [], results,
      targets: browserTargets.map(target => ({ id: target.name })),
      summary: { discovered: count, selected: count, executed: count, passed: count, failed: 0, flaky: 0, skipped: 0 },
      usage: { modelTokens: 0 },
    },
  };
  const { run } = report;
  if (['missing-browser', 'stale-browser'].includes(scenario)) process.exit(0);
  if (scenario === 'malformed-browser') { save('reports/browser/report.json', 'null'); process.exit(0); }
  if (scenario === 'empty-browser') { run.results = []; Object.assign(run.summary, { discovered: 0, selected: 0, executed: 0, passed: 0 }); }
  if (scenario === 'failed-browser') { run.results[0].status = 'failed'; run.results[0].attempts[0].status = 'failed'; }
  if (scenario === 'skipped-browser') { run.results[0].status = 'skipped'; run.summary.skipped = 1; run.summary.passed--; }
  if (scenario === 'flaky-browser') { run.results[0].status = 'flaky'; run.results[0].attempts.unshift({ ...run.results[0].attempts[0], status: 'failed' }); }
  if (scenario === 'focused-browser') run.summary.discovered++;
  if (scenario === 'engine-error') run.errors = [{ code: 'ENGINE_FAILURE', message: 'Browser launch failed' }];
  if (scenario === 'teardown-error') run.results[0].attempts[0].secondaryErrors = [{ code: 'ASSERTION_FAILED' }];
  // Each model marker is checked independently: the step kind and the agent API name.
  if (scenario === 'model-step') run.results[0].attempts[0].steps.push({ kind: 'agent', api: 'act', status: 'passed' });
  if (scenario === 'agent-api') run.results[0].attempts[0].steps.push({ kind: 'assertion', api: 'agent.assert', status: 'passed' });
  if (scenario === 'model-field') run.results[0].attempts[0].steps.push({ kind: 'assertion', api: 'app.assert', model: 'provider/model', status: 'passed' });
  if (scenario === 'model-metrics') run.results[0].attempts[0].steps[0].metrics = { modelCalls: 1 };
  if (scenario === 'failed-run') run.status = 'failed';
  if (scenario === 'cleanup-failed') run.results[0].attempts[0].cleanup = 'failed';
  if (scenario === 'attempt-error') run.results[0].attempts[0].error = { code: 'ASSERTION_FAILED' };
  if (scenario === 'retried-attempt') run.results[0].attempts[0].index = 1;
  if (scenario === 'focused-only') { run.results.push({ ...result(browserTargets[0]), testId: 'other', selected: false, status: 'skipped', attempts: [] }); run.summary.discovered++; run.summary.skipped++; }
  if (scenario === 'setup-result') run.results[0].kind = 'setup';
  if (scenario === 'extra-target') run.targets.push({ id: 'extra' });
  if (scenario === 'model-usage') run.usage.modelTokens = 1;
  if (scenario === 'explore-run') run.explore = {};
  if (scenario === 'missing-target') { run.results.pop(); run.targets.pop(); for (const key of ['discovered', 'selected', 'executed', 'passed']) run.summary[key]--; }
  if (scenario === 'duplicate-result') { run.results.push(result(browserTargets[0])); for (const key of ['discovered', 'selected', 'executed', 'passed']) run.summary[key]++; }
  save('reports/browser/report.json', report);
}
if (args[0] === 'build' && scenario === 'process-failure') process.exit(2);
if (args[1] === 'tsc' && scenario === 'process-failure') process.exit(2);
if (args[0] === 'build' && scenario === 'interrupted') {
  const descendant = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
  save('reports/descendant.json', { pid: descendant.pid });
  await new Promise(() => {});
}
if (args[0] === 'verify:reports' && scenario !== 'empty-report-tests') console.log('# tests 1\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0');
`;

async function createFixture() {
  const fixture = await mkdtemp(resolve(tmpdir(), 'website-verification-'));
      await mkdir(resolve(fixture, 'scripts'));
      await mkdir(resolve(fixture, 'bin'));
      for (const file of ['verify.mjs', 'check-test-results.mjs', 'browser-targets.mjs']) await copyFile(resolve(repository, 'scripts', file), resolve(fixture, 'scripts', file));
      await writeFile(resolve(fixture, '.nvmrc'), '24');
      await writeFile(resolve(fixture, 'bin/pnpm'), commandStub, { mode: 0o755 });
  return fixture;
}

test('interrupting verification between stages rejects success', async () => {
  const fixture = await createFixture();
  try {
    const hook = resolve(fixture, 'interrupt.mjs');
    await writeFile(hook, `
      import fs from 'node:fs';
      import { syncBuiltinESMExports } from 'node:module';
      const original = fs.promises.readFile;
      fs.promises.readFile = async (path, ...args) => {
        const result = await original(path, ...args);
        if (String(path).endsWith('/unit.json')) {
          // Deliver the event at this exact boundary. An OS signal may arrive in a later stage;
          // actual process-group termination is covered by the separate active-child test.
          process.emit('SIGTERM');
        }
        return result;
      };
      syncBuiltinESMExports();
    `);
    const result = spawnSync(process.execPath, ['--import', hook, resolve(fixture, 'scripts/verify.mjs')], {
      env: { ...process.env, TEST_REPORT_SCENARIO: 'success', PATH: `${fixture}/bin:${process.env.PATH}` }, encoding: 'utf8', timeout: 15_000,
    });
    assert.equal(result.status, 1, result.stderr);
    const summary = JSON.parse(await readFile(resolve(fixture, 'reports/verification/summary.json'), 'utf8'));
    assert.equal(summary.status, 'failed');
    assert.equal(summary.signal, 'SIGTERM');
    assert.equal(summary.stages.at(-1).name, 'unit', 'interrupt must prevent later stages from starting');
  } finally { await rm(fixture, { recursive: true, force: true }); }
});

for (const scenario of ['success', 'missing-unit', 'empty-unit', 'skipped-unit', 'inconsistent-unit', 'process-failure', 'focused-infra']) {
  test(`infrastructure gate ${scenario === 'success' ? 'accepts complete execution' : `rejects ${scenario}`}`, async () => {
    const fixture = await createFixture();
    try {
      const result = spawnSync(process.execPath, [resolve(fixture, 'scripts/verify.mjs'), '--infra'], {
        env: { ...process.env, TEST_REPORT_SCENARIO: scenario, PATH: `${fixture}/bin:${process.env.PATH}` }, encoding: 'utf8', timeout: 15_000,
      });
      assert.equal(result.error, undefined, result.stderr);
      assert.equal(result.status, scenario === 'success' ? 0 : 1, result.stderr);
      const summary = JSON.parse(await readFile(resolve(fixture, 'reports/verification-infra/summary.json'), 'utf8'));
      assert.equal(summary.status, scenario === 'success' ? 'passed' : 'failed');
      if (scenario === 'success') assert.equal(summary.stages.length, 2);
      else assert.equal(summary.stages.at(-1).name, scenario === 'process-failure' ? 'infra-types' : 'infra-tests');
    } finally { await rm(fixture, { recursive: true, force: true }); }
  });
}

for (const scenario of ['success', 'missing-unit', 'empty-unit', 'skipped-unit', 'inconsistent-unit', 'process-failure']) {
  test(`deployed gate ${scenario === 'success' ? 'accepts complete execution' : `rejects ${scenario}`}`, async () => {
    const fixture = await createFixture();
    try {
      const result = spawnSync(process.execPath, [resolve(fixture, 'scripts/verify.mjs'), '--deployed'], {
        env: { ...process.env, DEPLOYED_BASE_URL: 'https://example.invalid', TEST_REPORT_SCENARIO: scenario, PATH: `${fixture}/bin:${process.env.PATH}` }, encoding: 'utf8', timeout: 15_000,
      });
      assert.equal(result.error, undefined, result.stderr);
      assert.equal(result.status, scenario === 'success' ? 0 : 1, result.stderr);
      const summary = JSON.parse(await readFile(resolve(fixture, 'reports/verification-deployed/summary.json'), 'utf8'));
      assert.equal(summary.status, scenario === 'success' ? 'passed' : 'failed');
      if (scenario === 'success') assert.deepEqual(summary.stages.map(stage => stage.name), ['build', 'deployed']);
      else assert.equal(summary.stages.at(-1).name, scenario === 'process-failure' ? 'build' : 'deployed');
    } finally { await rm(fixture, { recursive: true, force: true }); }
  });
}

test('deployed gate fails before any stage when DEPLOYED_BASE_URL is unset', async () => {
  const fixture = await createFixture();
  try {
    const { DEPLOYED_BASE_URL: _removed, ...environment } = process.env;
    const result = spawnSync(process.execPath, [resolve(fixture, 'scripts/verify.mjs'), '--deployed'], {
      env: { ...environment, TEST_REPORT_SCENARIO: 'success', PATH: `${fixture}/bin:${process.env.PATH}` }, encoding: 'utf8', timeout: 15_000,
    });
    assert.equal(result.status, 1, result.stderr);
    const summary = JSON.parse(await readFile(resolve(fixture, 'reports/verification-deployed/summary.json'), 'utf8'));
    assert.equal(summary.status, 'failed');
    assert.match(summary.error, /DEPLOYED_BASE_URL is not set/);
    assert.deepEqual(summary.stages, []);
  } finally { await rm(fixture, { recursive: true, force: true }); }
});

test('deployed suite fails loudly, not silently, when DEPLOYED_BASE_URL is unset', () => {
  const { DEPLOYED_BASE_URL: _removed, ...environment } = process.env;
  const result = spawnSync('pnpm', ['exec', 'vitest', 'run', '--config', 'vitest.deployed.config.ts'], { cwd: repository, env: environment, encoding: 'utf8', timeout: 60_000 });
  assert.notEqual(result.status, 0, 'an unconfigured deployed suite must not pass');
  // Anchored on the error line: vitest also prints the source line that throws it. CI colours the output, so strip ANSI first.
  assert.match(stripVTControlCharacters(result.stdout + result.stderr), /^Error: DEPLOYED_BASE_URL is not set/m);
});

// The bootstrap script deploys the OIDC roles with admin credentials; its checkout guard runs before any AWS call.
// PATH shims stand in for git, gh and aws; the aws shim exits 42 to show the guard let the script through.
const shims = {
  git: 'case "$*" in *status*) printf "%s" "$SHIM_DIRTY";; *"rev-parse HEAD"*) echo "$SHIM_HEAD";; *"rev-parse origin/main"*) echo "$SHIM_MAIN";; esac',
  gh: 'echo "$SHIM_PR"',
  aws: 'exit 42',
};
const bootstrapCases = [
  ['accepts the latest origin/main', { SHIM_HEAD: 'aaa', SHIM_MAIN: 'aaa', SHIM_PR: 'MERGED bbb' }, 42],
  ['accepts the head of an open PR 86', { SHIM_HEAD: 'bbb', SHIM_MAIN: 'aaa', SHIM_PR: 'OPEN bbb' }, 42],
  ['rejects the head of a merged PR 86', { SHIM_HEAD: 'bbb', SHIM_MAIN: 'aaa', SHIM_PR: 'MERGED bbb' }, 1, /refusing to deploy/],
  ['rejects the head of a closed, unmerged PR 86', { SHIM_HEAD: 'bbb', SHIM_MAIN: 'aaa', SHIM_PR: 'CLOSED bbb' }, 1, /refusing to deploy/],
  ['rejects an unknown commit', { SHIM_HEAD: 'ccc', SHIM_MAIN: 'aaa', SHIM_PR: 'OPEN bbb' }, 1, /refusing to deploy/],
  ['rejects an unavailable PR when not on main', { SHIM_HEAD: 'ccc', SHIM_MAIN: 'aaa', SHIM_PR: '' }, 1, /refusing to deploy/],
  ['rejects a dirty working tree', { SHIM_HEAD: 'aaa', SHIM_MAIN: 'aaa', SHIM_PR: 'OPEN aaa', SHIM_DIRTY: ' M file' }, 1, /not clean/],
];
for (const [name, environment, status, message] of bootstrapCases) {
  test(`bootstrap script ${name}`, async () => {
    const bin = await mkdtemp(resolve(tmpdir(), 'bootstrap-shims-'));
    try {
      for (const [command, body] of Object.entries(shims)) await writeFile(resolve(bin, command), `#!/usr/bin/env bash\n${body}\n`, { mode: 0o755 });
      const result = spawnSync('bash', [resolve(repository, 'scripts/bootstrap-aws.sh')], {
        env: { ...process.env, SHIM_DIRTY: '', ...environment, PATH: `${bin}:${process.env.PATH}` }, encoding: 'utf8', timeout: 15_000,
      });
      assert.equal(result.status, status, result.stderr);
      if (message) assert.match(stripVTControlCharacters(result.stderr), message);
    } finally { await rm(bin, { recursive: true, force: true }); }
  });
}

// Each browser scenario must fail for its own reason, so overlapping checks cannot hide a removed one.
const browserReasons = {
  'missing-browser': /ENOENT/, 'stale-browser': /ENOENT/, 'malformed-browser': /not a TesterArmy report-1/,
  'empty-browser': /executed no tests/, 'failed-browser': /unretried successful verdict/, 'skipped-browser': /counts indicate/,
  'flaky-browser': /counts indicate|unretried successful verdict/, 'focused-browser': /counts indicate/, 'focused-only': /counts indicate/,
  'engine-error': /operational errors/, 'teardown-error': /clean successful verdict/, 'cleanup-failed': /clean successful verdict/,
  'attempt-error': /clean successful verdict/, 'retried-attempt': /clean successful verdict/, 'failed-run': /run did not pass/,
  'model-step': /used a model/, 'agent-api': /used a model/, 'model-field': /used a model/, 'model-usage': /used a model/, 'model-metrics': /used a model/, 'explore-run': /Exploration/,
  'setup-result': /unretried successful verdict/, 'missing-target': /targets differ/, 'extra-target': /targets differ/,
  'duplicate-result': /exactly once/,
};

for (const scenario of ['success', 'missing-unit', 'malformed-unit', 'empty-unit', 'skipped-unit', 'todo-unit', 'inconsistent-unit', 'missing-browser', 'malformed-browser', 'empty-browser', 'failed-browser', 'skipped-browser', 'flaky-browser', 'focused-browser', 'engine-error', 'teardown-error', 'model-step', 'model-usage', 'model-metrics', 'model-field', 'agent-api', 'failed-run', 'cleanup-failed', 'attempt-error', 'retried-attempt', 'focused-only', 'setup-result', 'extra-target', 'explore-run', 'process-failure', 'missing-target', 'duplicate-result', 'stale-browser', 'empty-report-tests']) {
  test(`verification wrapper ${scenario === 'success' ? 'accepts complete execution' : `rejects ${scenario}`}`, async () => {
    const fixture = await createFixture();
    try {
      if (scenario === 'stale-browser') {
        await mkdir(resolve(fixture, 'reports/browser'), { recursive: true });
        await writeFile(resolve(fixture, 'reports/browser/report.json'), '{"stale": true}');
      }
      const result = spawnSync(process.execPath, [resolve(fixture, 'scripts/verify.mjs')], {
        env: { ...process.env, TEST_REPORT_SCENARIO: scenario, PATH: `${fixture}/bin:${process.env.PATH}` }, encoding: 'utf8', timeout: 15_000,
      });
      assert.equal(result.error, undefined, result.stderr);
      assert.equal(result.status, scenario === 'success' ? 0 : 1, result.stderr);
      const summary = JSON.parse(await readFile(resolve(fixture, 'reports/verification/summary.json'), 'utf8'));
      assert.equal(summary.status, scenario === 'success' ? 'passed' : 'failed');
      if (scenario === 'success') assert.equal(summary.stages.length, 6);
      else {
        assert.ok(summary.error, 'failure reason must be retained');
        const expectedStage = scenario === 'process-failure' ? 'build' : scenario === 'empty-report-tests' ? 'report-contracts' : scenario.includes('unit') ? 'unit' : 'browser';
        assert.equal(summary.stages.at(-1).name, expectedStage, 'must fail at the intended boundary');
        assert.equal(summary.stages.at(-1).status, 'failed');
        if (browserReasons[scenario]) assert.match(summary.error, browserReasons[scenario]);
        assert.ok(summary.stages.slice(0, -1).every(stage => stage.status === 'passed'), 'earlier stages must execute successfully');
      }
    } finally { await rm(fixture, { recursive: true, force: true }); }
  });
}


test('interrupting verification stops its descendant processes', { timeout: 15_000 }, async () => {
  const fixture = await createFixture();
  let verifier;
  try {
    verifier = spawn(process.execPath, [resolve(fixture, 'scripts/verify.mjs')], {
      env: { ...process.env, TEST_REPORT_SCENARIO: 'interrupted', PATH: `${fixture}/bin:${process.env.PATH}` }, stdio: 'ignore',
    });
    const exited = new Promise(done => verifier.once('exit', code => done(code)));
    let descendant;
    for (let attempt = 0; attempt < 100; attempt++) {
      try { descendant = JSON.parse(await readFile(resolve(fixture, 'reports/descendant.json'), 'utf8')).pid; break; }
      catch { await new Promise(done => setTimeout(done, 50)); }
    }
    assert.ok(descendant, 'the child must reach the interruptible stage');
    verifier.kill('SIGTERM');
    assert.equal(await exited, 1);
    const summary = JSON.parse(await readFile(resolve(fixture, 'reports/verification/summary.json'), 'utf8'));
    assert.equal(summary.status, 'failed');
    assert.equal(summary.stages.at(-1).signal, 'SIGTERM');
    assert.match(summary.error, /SIGTERM/, 'the report must identify the terminating signal');
    let alive = true;
    for (let attempt = 0; attempt < 100 && alive; attempt++) {
      try {
        process.kill(descendant, 0);
        // A terminated zombie may remain until the host reaps it; it cannot execute or own a server.
        const status = await readFile(`/proc/${descendant}/status`, 'utf8').catch(() => '');
        if (/^State:\s+Z/m.test(status)) alive = false;
      } catch (error) { if (error.code === 'ESRCH') alive = false; else throw error; }
      if (alive) await new Promise(done => setTimeout(done, 50));
    }
    assert.equal(alive, false, 'interrupt must terminate the descendant, not leave an orphan');
  } finally {
    verifier?.kill('SIGTERM');
    await rm(fixture, { recursive: true, force: true });
  }
});
