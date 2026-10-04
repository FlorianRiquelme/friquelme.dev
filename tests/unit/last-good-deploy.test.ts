import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { pickLastGood } from '../../scripts/last-good-deploy.mjs';

const run = (databaseId: number, headSha: string, createdAt: string, over: Record<string, unknown> = {}) =>
  ({ databaseId, headSha, createdAt, status: 'completed', conclusion: 'success', headBranch: 'main', ...over });
const exclude = { excludeRunId: '99', excludeSha: 'bad' };

describe('pickLastGood', () => {
  it('picks the newest success', () => {
    const runs = [run(1, 'a', '2026-01-01T00:00:00Z'), run(2, 'b', '2026-01-02T00:00:00Z'), run(3, 'c', '2026-01-03T00:00:00Z')];
    expect(pickLastGood(runs, exclude)?.headSha).toBe('c');
  });
  it('is independent of input order', () => {
    const runs = [run(2, 'b', '2026-01-02T00:00:00Z'), run(3, 'c', '2026-01-03T00:00:00Z'), run(1, 'a', '2026-01-01T00:00:00Z')];
    expect(pickLastGood(runs, exclude)?.headSha).toBe('c');
  });
  it('skips failed, cancelled and in-progress runs', () => {
    const runs = [
      run(4, 'f', '2026-01-06T00:00:00Z', { conclusion: 'failure' }),
      run(5, 'x', '2026-01-05T00:00:00Z', { conclusion: 'cancelled' }),
      run(6, 'p', '2026-01-04T00:00:00Z', { status: 'in_progress', conclusion: '' }),
      run(8, 'q', '2026-01-03T00:00:00Z', { status: 'queued' }),
      run(1, 'a', '2026-01-01T00:00:00Z'),
    ];
    expect(pickLastGood(runs, exclude)?.headSha).toBe('a');
  });
  it('skips other branches', () => {
    const runs = [run(2, 'o', '2026-01-02T00:00:00Z', { headBranch: 'feature' }), run(1, 'a', '2026-01-01T00:00:00Z')];
    expect(pickLastGood(runs, exclude)?.headSha).toBe('a');
  });
  it('skips the current run id', () => {
    const runs = [run(99, 'n', '2026-01-02T00:00:00Z'), run(1, 'a', '2026-01-01T00:00:00Z')];
    expect(pickLastGood(runs, exclude)?.headSha).toBe('a');
  });
  it('skips a re-run of the broken sha', () => {
    const runs = [run(7, 'bad', '2026-01-02T00:00:00Z'), run(1, 'a', '2026-01-01T00:00:00Z')];
    expect(pickLastGood(runs, exclude)?.headSha).toBe('a');
  });
  it('returns null for no candidates', () => {
    expect(pickLastGood([], exclude)).toBeNull();
    expect(pickLastGood([run(7, 'bad', '2026-01-02T00:00:00Z')], exclude)).toBeNull();
  });
});

describe('last-good-deploy CLI', () => {
  const cli = (input: unknown) => spawnSync(process.execPath, ['scripts/last-good-deploy.mjs', '--exclude-run', '99', '--exclude-sha', 'bad'], { input: JSON.stringify(input), encoding: 'utf8' });
  it('prints the sha and exits 0', () => {
    const result = cli([run(1, 'a', '2026-01-01T00:00:00Z'), run(99, 'n', '2026-01-02T00:00:00Z')]);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('a\n');
  });
  it('exits 1 with a message when none', () => {
    const result = cli([]);
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('no known-good deploy');
  });
});
