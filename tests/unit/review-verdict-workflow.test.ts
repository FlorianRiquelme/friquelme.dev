import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';

// review-verdict.yml is the gate's security boundary: it runs with a write token on events a PR
// author can trigger, so it must never execute PR code and must recompute on every relevant event.
const file = fileURLToPath(new URL('../../.github/workflows/review-verdict.yml', import.meta.url));
const workflow = parse(readFileSync(file, 'utf8'));

describe('review-verdict workflow', () => {
  it('recomputes on every push and every comment change, from the base branch', () => {
    expect(workflow.on).toEqual({
      pull_request_target: { types: ['opened', 'synchronize', 'reopened'] },
      issue_comment: { types: ['created', 'edited', 'deleted'] },
    });
  });

  it('holds only the permissions it needs', () => {
    expect(workflow.permissions).toEqual({ contents: 'read', 'pull-requests': 'read', statuses: 'write' });
  });

  it('runs only for PRs, checks out the base without credentials and passes the PR number through env', () => {
    expect(Object.keys(workflow.jobs)).toEqual(['verdict']);
    const job = workflow.jobs.verdict;
    expect(job.if).toBe("github.event_name == 'pull_request_target' || github.event.issue.pull_request");
    expect(job.permissions).toBeUndefined();
    expect(job.steps).toEqual([
      { uses: 'actions/checkout@v7', with: { 'persist-credentials': false } },
      { uses: 'actions/setup-node@v7', with: { 'node-version-file': '.nvmrc' } },
      {
        run: 'node scripts/review-verdict.mjs',
        env: {
          GITHUB_TOKEN: '${{ secrets.GITHUB_TOKEN }}',
          PR_NUMBER: '${{ github.event.pull_request.number || github.event.issue.number }}',
        },
      },
    ]);
  });
});
