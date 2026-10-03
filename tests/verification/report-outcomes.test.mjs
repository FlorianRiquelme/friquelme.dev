import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, copyFile, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
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
    attempts: [{ index: 0, status: 'passed', secondaryErrors: [], cleanup: 'complete', steps: [{ api: 'app.open', status: 'passed', steps: [] }] }],
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
  if (scenario === 'model-step') run.results[0].attempts[0].steps[0].steps = [{ api: 'agent.act', status: 'passed', model: { id: 'model' }, steps: [] }];
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

for (const scenario of ['success', 'missing-unit', 'malformed-unit', 'empty-unit', 'skipped-unit', 'todo-unit', 'inconsistent-unit', 'missing-browser', 'malformed-browser', 'empty-browser', 'failed-browser', 'skipped-browser', 'flaky-browser', 'focused-browser', 'engine-error', 'teardown-error', 'model-step', 'model-usage', 'explore-run', 'process-failure', 'missing-target', 'duplicate-result', 'stale-browser', 'empty-report-tests']) {
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
