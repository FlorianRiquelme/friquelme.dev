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

describe('REVIEW.md verification checklist', () => {
  it('no longer reruns the full gate unconditionally', () => {
    expect(honesty).not.toContain('Rerun `node scripts/pnpm.mjs verify` on the head');
  });

  it('requires green site and infra check runs for the exact head SHA', () => {
    expect(honesty).toContain('gh api repos/FlorianRiquelme/friquelme.dev/commits/<sha>/check-runs');
    expect(honesty).toContain(
      `--jq '.check_runs[] | select(.name == "site" or .name == "infra") | [.id, .name, .status, .conclusion, .head_sha] | @tsv'`,
    );
    expect(honesty).toContain('`head_sha` equal to the 40-character head SHA');
    expect(honesty).toContain('Both required checks `site` and `infra`');
    expect(honesty).toContain('conclusion `success`');
    expect(honesty).toContain('highest `id`');
  });

  it('names the fallback triggers and the full-gate commands', () => {
    expect(honesty).toContain('Fall back to the full gate, `node scripts/pnpm.mjs verify`');
    expect(honesty).toContain('`node scripts/pnpm.mjs verify:infra`');
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
    expect(testing).toContain('`timeout 300 node scripts/pnpm.mjs exec vitest run <file>`');
    expect(testing).toContain('Exit 124 is recorded as `timeout` in the table, not as red.');
  });
});
