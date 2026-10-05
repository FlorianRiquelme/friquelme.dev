import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));
const script = join(root, 'scripts/wait-checks.mjs');

// The stub replays scripted responses in order (the last one repeats) and logs each call.
const stub = `#!/usr/bin/env node
const { appendFileSync, readFileSync, writeFileSync, existsSync } = require('node:fs');
const dir = process.env.STUB_DIR;
appendFileSync(dir + '/gh.log', JSON.stringify(process.argv.slice(2)) + '\\n');
const counter = dir + '/count';
const n = existsSync(counter) ? Number(readFileSync(counter, 'utf8')) : 0;
writeFileSync(counter, String(n + 1));
const responses = JSON.parse(readFileSync(dir + '/responses.json', 'utf8'));
const r = responses[Math.min(n, responses.length - 1)];
if (r.stdout) process.stdout.write(r.stdout);
if (r.stderr) process.stderr.write(r.stderr);
process.exit(r.status ?? 0);
`;

const EMPTY = { status: 1, stderr: "no checks reported on the 'feature' branch\n" };
const checks = (...entries: [string, string][]) => ({
  stdout: JSON.stringify(entries.map(([name, bucket]) => ({ name, bucket, state: bucket.toUpperCase() }))),
});

let dir: string;
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function run(responses: object[], args: string[] = []) {
  dir = mkdtempSync(join(tmpdir(), 'wait-checks-'));
  writeFileSync(join(dir, 'gh'), stub);
  chmodSync(join(dir, 'gh'), 0o755);
  writeFileSync(join(dir, 'responses.json'), JSON.stringify(responses));
  const result = spawnSync('node', [script, ...args], {
    encoding: 'utf8',
    env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, STUB_DIR: dir },
  });
  const log = readFileSync(join(dir, 'gh.log'), 'utf8').trim().split('\n').map(line => JSON.parse(line));
  return { code: result.status, out: result.stdout + result.stderr, log };
}

const fast = ['--interval-seconds', '0.01', '--timeout-seconds', '5'];

describe('wait-checks', () => {
  it('tolerates "no checks reported" and pending, then exits 0 when site and infra pass', () => {
    const r = run([EMPTY, checks(['site', 'pending']), checks(['site', 'pass'], ['infra', 'pass'])], ['7', ...fast]);
    expect(r.code).toBe(0);
    expect(r.log).toHaveLength(3);
    expect(r.log[0]).toEqual(['pr', 'checks', '7', '--json', 'name,state,bucket']);
  });

  it('exits 1 and names a required check that failed', () => {
    const r = run([checks(['site', 'pass'], ['infra', 'fail'])], ['7', ...fast]);
    expect(r.code).toBe(1);
    expect(r.out).toContain('infra (FAIL)');
  });

  it('treats a cancelled required check as failure', () => {
    const r = run([checks(['site', 'cancel'], ['infra', 'pass'])], ['7', ...fast]);
    expect(r.code).toBe(1);
    expect(r.out).toContain('site');
  });

  it('exits 3 naming infra when it never appears before the timeout', () => {
    const r = run([checks(['site', 'pass'])], ['7', '--interval-seconds', '0.01', '--timeout-seconds', '0.2']);
    expect(r.code).toBe(3);
    expect(r.out).toContain('still pending: infra');
    expect(r.out).not.toContain('site');
  });

  it('exits 3 on a timeout while only the empty state is reported', () => {
    const r = run([EMPTY], ['7', '--interval-seconds', '0.01', '--timeout-seconds', '0.2']);
    expect(r.code).toBe(3);
    expect(r.out).toContain('still pending: site, infra');
  });

  it('ignores a failing check that is not required', () => {
    const r = run([checks(['site', 'pass'], ['infra', 'pass'], ['review-verdict', 'fail'], ['CodeRabbit', 'fail'])], ['7', ...fast]);
    expect(r.code).toBe(0);
  });

  it('waits for review-verdict when requested', () => {
    const base: [string, string][] = [['site', 'pass'], ['infra', 'pass']];
    const r = run([checks(...base, ['review-verdict', 'pending']), checks(...base, ['review-verdict', 'pass'])], ['7', '--checks', 'site,infra,review-verdict', ...fast]);
    expect(r.code).toBe(0);
    expect(r.log).toHaveLength(2);
  });

  it('fails on review-verdict when requested and red', () => {
    const r = run([checks(['site', 'pass'], ['infra', 'pass'], ['review-verdict', 'fail'])], ['7', '--checks', 'site,infra,review-verdict', ...fast]);
    expect(r.code).toBe(1);
    expect(r.out).toContain('review-verdict');
  });

  it('exits 2 on a gh error other than the empty state', () => {
    const r = run([{ status: 1, stderr: 'GraphQL: Could not resolve to a PullRequest\n' }], ['7', ...fast]);
    expect(r.code).toBe(2);
    expect(r.out).toContain('Could not resolve');
  });

  it('exits 2 on invalid JSON from gh', () => {
    const r = run([{ stdout: 'not json' }], ['7', ...fast]);
    expect(r.code).toBe(2);
  });

  it.each([[[]], [['abc']], [['7', '--checks']], [['7', '--timeout-seconds', 'x']], [['7', '--bogus']]])('exits 2 on usage error %j', args => {
    dir = mkdtempSync(join(tmpdir(), 'wait-checks-'));
    const result = spawnSync('node', [script, ...(args as string[])], { encoding: 'utf8' });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('usage:');
  });
});

describe('AGENTS.md', () => {
  it('tells agents to wait for CI with wait-checks rather than gh pr checks --watch', () => {
    const text = readFileSync(join(root, 'AGENTS.md'), 'utf8');
    expect(text).toContain('node scripts/wait-checks.mjs <n>');
    expect(text).toMatch(/rather than `gh pr checks --watch`/);
  });
});
