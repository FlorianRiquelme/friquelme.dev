import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));
const review = readFileSync(`${root}REVIEW.md`, 'utf8');
const section = (heading: string) => {
  const start = review.indexOf(heading);
  expect(start, heading).toBeGreaterThanOrEqual(0);
  return review.slice(start, review.indexOf('\n## ', start + 1));
};
const testing = section('## 2. Test quality');
const honesty = section('## 3. Verification honesty');

// Whole sentences, so an inverted or negated rewording ("unless", "must not") cannot keep the fragment checks below green.
const sentences = {
  mutations:
    'Do it for every "Done when" item of the task, and also test the cases you think are missing and the worker did not list; report each uncovered one as a finding.',
  timeout:
    'Wrap every mutation run in `timeout` with an explicit limit, for example `timeout 300 node scripts/pnpm.mjs exec vitest run <file>`. Exit 124 is recorded as `timeout` in the table, not as red. A timed-out mutation proves nothing: rerun it or name the test as unproven.',
  ci: 'Rely on green CI for the exact head instead of rerunning the full gate. Both required checks `site` and `infra` (jobs in `.github/workflows/ci.yml`) must have completed with conclusion `success` and a `head_sha` equal to the 40-character head SHA you were given. Query the commit\'s check runs, not `gh pr checks` (that shows whatever the PR\'s head is now):',
  rerun:
    'When a name has several runs for that SHA (re-runs), the newest one (highest `id`) decides. While a check is `queued` or `in_progress`, wait for it (poll) for up to 30 minutes. List the query and its result under `Commands run`, so the verdict shows which SHA CI proved.',
  fallback:
    'Fall back to the full gate, `node scripts/pnpm.mjs verify` (and `node scripts/pnpm.mjs verify:infra` when `infra` is the affected check, after the root and `-C infra install --frozen-lockfile`), when a required check is missing, red or cancelled, has a different `head_sha`, or is not complete after 30 minutes. Report exit codes; a run whose failure is hidden behind `| tail` or `echo $?` does not count.',
  red: 'A red required check is a blocking finding ("failing gate") even when a local rerun passes.',
  targeted:
    'Run the test files that cover the "Done when" items (`node scripts/pnpm.mjs exec vitest run <files>`, or the relevant browser or build suite) and the §2 mutations.',
};

describe('REVIEW.md verification checklist', () => {
  it('states each added requirement as a complete sentence', () => {
    expect(testing).toContain(sentences.mutations);
    expect(testing).toContain(sentences.timeout);
    for (const key of ['ci', 'rerun', 'fallback', 'red', 'targeted'] as const) {
      expect(honesty, key).toContain(sentences[key]);
    }
  });

  it('no longer reruns the full gate unconditionally', () => {
    expect(honesty).not.toContain('Rerun `node scripts/pnpm.mjs verify` on the head');
  });

  it('requires green site and infra check runs for the exact head SHA', () => {
    expect(honesty).toContain('gh api repos/FlorianRiquelme/friquelme.dev/commits/<sha>/check-runs');
    expect(honesty).toContain(
      `--jq '.check_runs[] | select(.name == "site" or .name == "infra") | [.id, .name, .status, .conclusion, .head_sha] | @tsv'`,
    );
    expect(honesty).toContain('`head_sha` equal to the 40-character head SHA');
    expect(honesty).toContain(
      'Both required checks `site` and `infra` (jobs in `.github/workflows/ci.yml`) must have completed with conclusion `success` and a `head_sha` equal to the 40-character head SHA you were given.',
    );
    expect(honesty).toContain('conclusion `success`');
    expect(honesty).toContain('highest `id`');
    expect(honesty).toContain('not `gh pr checks`');
    expect(honesty).toContain('While a check is `queued` or `in_progress`, wait for it (poll) for up to 30 minutes.');
    expect(honesty).toContain('List the query and its result under `Commands run`, so the verdict shows which SHA CI proved.');
  });

  it('names the fallback triggers and the full-gate commands', () => {
    expect(honesty).toContain('Fall back to the full gate, `node scripts/pnpm.mjs verify`');
    expect(honesty).toContain('`node scripts/pnpm.mjs verify:infra` when `infra` is the affected check');
    expect(honesty).toContain('Report exit codes; a run whose failure is hidden behind `| tail` or `echo $?` does not count.');
    for (const trigger of ['missing, red or cancelled', 'different `head_sha`', 'not complete after 30 minutes']) {
      expect(honesty, trigger).toContain(trigger);
    }
  });

  it('keeps a red required check blocking even when a local rerun passes', () => {
    expect(honesty).toContain('A red required check is a blocking finding ("failing gate") even when a local rerun passes.');
  });

  it('requires targeted tests and mutations for every Done-when item plus the reviewer\'s own cases', () => {
    expect(testing).toContain('for every "Done when" item');
    expect(testing).toContain('cases you think are missing and the worker did not list');
    expect(honesty).toContain('Run the test files that cover the "Done when" items (`node scripts/pnpm.mjs exec vitest run <files>`');
  });

  it('wraps mutation runs in timeout and records exit 124 as timeout', () => {
    expect(testing).toContain('A timed-out mutation proves nothing: rerun it or name the test as unproven.');
    expect(testing).toContain('`timeout 300 node scripts/pnpm.mjs exec vitest run <file>`');
    expect(testing).toContain('Exit 124 is recorded as `timeout` in the table, not as red.');
  });
});
