import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));

// A pnpm stub that writes a passing Vitest report for the infra stage; TOUCH names a file it
// creates while the gate runs, to dirty the tree between start and end.
const pnpmStub = `#!/usr/bin/env node
const { writeFileSync } = require('node:fs');
const args = process.argv.slice(2);
const output = args.find(arg => arg.startsWith('--outputFile='));
if (output) writeFileSync(output.slice('--outputFile='.length), JSON.stringify({
  success: true, numTotalTests: 1, numPassedTests: 1, numFailedTests: 0, numPendingTests: 0, numTodoTests: 0,
  numFailedTestSuites: 0, numPendingTestSuites: 0, snapshot: { failure: false, unmatched: 0 },
  testResults: [{ status: 'passed', assertionResults: [{ status: 'passed' }] }],
}));
if (process.env.TOUCH) writeFileSync(process.env.TOUCH, 'dirty');
`;

let dir: string;
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function fixture({ git }: { git: boolean }) {
  dir = mkdtempSync(join(tmpdir(), 'verify-git-'));
  mkdirSync(join(dir, 'scripts'));
  mkdirSync(join(dir, 'bin'));
  for (const file of ['verify.mjs', 'check-test-results.mjs', 'browser-targets.mjs']) copyFileSync(join(root, 'scripts', file), join(dir, 'scripts', file));
  writeFileSync(join(dir, '.nvmrc'), process.versions.node.split('.')[0]);
  writeFileSync(join(dir, 'bin/pnpm'), pnpmStub);
  chmodSync(join(dir, 'bin/pnpm'), 0o755);
  writeFileSync(join(dir, '.gitignore'), 'reports/\n.verification-infra.lock\n');
  if (!git) return null;
  const run = (...args: string[]) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim();
  run('init', '-q');
  run('add', '.');
  run('-c', 'user.name=test', '-c', 'user.email=test@example.test', 'commit', '-qm', 'fixture');
  return run('rev-parse', 'HEAD');
}

function verifyInfra(env: Record<string, string> = {}) {
  const result = spawnSync(process.execPath, [join(dir, 'scripts/verify.mjs'), '--infra'], {
    encoding: 'utf8',
    // The ceiling keeps git from finding a repository above the fixture, so the non-git case stays non-git.
    env: { ...process.env, PATH: `${join(dir, 'bin')}:${process.env.PATH}`, GIT_CEILING_DIRECTORIES: dirname(dir), ...env },
  });
  expect(result.status, result.stderr).toBe(0);
  const summary = JSON.parse(readFileSync(join(dir, 'reports/verification-infra/summary.json'), 'utf8'));
  expect(summary.status).toBe('passed');
  return summary.git;
}

describe('verify.mjs git state in summary.json', () => {
  it('records the full head and a clean tree', () => {
    const head = fixture({ git: true });
    expect(head).toMatch(/^[0-9a-f]{40}$/);
    expect(verifyInfra()).toEqual({ headAtStart: head, headAtEnd: head, cleanAtStart: true, cleanAtEnd: true });
  });

  it('counts an untracked file as dirty', () => {
    const head = fixture({ git: true });
    writeFileSync(join(dir, 'untracked.txt'), 'x');
    expect(verifyInfra()).toEqual({ headAtStart: head, headAtEnd: head, cleanAtStart: false, cleanAtEnd: false });
  });

  it('records a tree dirtied during the run at the end only', () => {
    const head = fixture({ git: true });
    expect(verifyInfra({ TOUCH: join(dir, 'late.txt') })).toEqual({ headAtStart: head, headAtEnd: head, cleanAtStart: true, cleanAtEnd: false });
  });

  it('records a commit made during the run as a different end head', () => {
    const head = fixture({ git: true });
    // The stub commits on every stage, so the end head must be read after the stages ran.
    writeFileSync(join(dir, 'bin/pnpm'), `${pnpmStub}require('node:child_process').execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.test', 'commit', '-qm', 'later', '--allow-empty'], { cwd: ${JSON.stringify(dir)} });\n`);
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.test', 'commit', '-qam', 'stub'], { cwd: dir });
    const start = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim();
    expect(start).not.toBe(head);
    const git = verifyInfra();
    expect(git.headAtStart).toBe(start);
    expect(git.headAtEnd).toMatch(/^[0-9a-f]{40}$/);
    expect(git.headAtEnd).not.toBe(start);
    expect(git.cleanAtEnd).toBe(true);
  });

  it('records nulls outside a git repository', () => {
    fixture({ git: false });
    expect(verifyInfra()).toEqual({ headAtStart: null, headAtEnd: null, cleanAtStart: null, cleanAtEnd: null });
  });
});
