import { spawnSync } from 'node:child_process';
import { generateKeyPairSync, sign } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { signedPayload } from '../../scripts/review-verdict.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const guard = join(root, 'scripts/merge-guard.mjs');
const HEAD = 'a'.repeat(40);
const OTHER = 'b'.repeat(40);
const SITE = 'reports/verification/summary.json';
const INFRA = 'reports/verification-infra/summary.json';

// The stub answers `gh pr view` and both `gh api` endpoints from state.json, logs every invocation as one JSON line,
// and exits with MERGE_EXIT for `gh pr merge`.
const stub = `#!/usr/bin/env node
const { appendFileSync, readFileSync } = require('node:fs');
const dir = process.env.STUB_DIR;
const args = process.argv.slice(2);
appendFileSync(dir + '/gh.log', JSON.stringify(args) + '\\n');
const state = JSON.parse(readFileSync(dir + '/state.json', 'utf8'));
if (args[0] === 'pr' && args[1] === 'view') process.stdout.write(JSON.stringify({ headRefOid: state.head, state: state.prState }));
else if (args[0] === 'api' && args.at(-1).endsWith('/pulls/' + state.pr + '/comments')) process.stdout.write(JSON.stringify(state.reviewPages));
else if (args[0] === 'api' && args[1] === '-H') {
  if (state.baseKey === undefined) { process.stderr.write('gh: Not Found (HTTP 404)'); process.exit(1); }
  if (state.keyError === 'ref') { process.stderr.write('gh: No commit found for the ref main (HTTP 404)'); process.exit(1); }
  if (state.keyError) { process.stderr.write('gh: Server Error (HTTP 500)'); process.exit(1); }
  process.stdout.write(state.baseKey);
}
else if (args[0] === 'api' && args[1].includes('/pulls/')) process.stdout.write(JSON.stringify({ user: { login: state.author }, base: { ref: state.baseRef ?? 'main', repo: { full_name: 'o/r' } } }));
else if (args[0] === 'api' && args.at(-1).endsWith('/issues/' + state.pr + '/comments')) process.stdout.write(JSON.stringify(state.pages));
else if (args[0] === 'pr' && args[1] === 'merge') process.exit(state.mergeExit);
else process.exit(99);
`;

const marker = (verdict: string, sha: string, id: number) => ({
  id,
  created_at: `2026-10-04T10:0${id}:00Z`,
  author_association: 'OWNER',
  user: { login: 'owner' },
  html_url: `https://example.test/c/${id}`,
  body: `<!-- review-verdict: ${verdict} sha=${sha} -->\nReview verdict: ${verdict}\nReviewed head: ${sha}\n`,
});

const CODEX = { login: 'chatgpt-codex-connector[bot]', type: 'Bot' };
const HUMAN = { login: 'owner', type: 'User' };
const inline = (id: number, user: { login: string; type: string }, options: { replyTo?: number; association?: string; path?: string; body?: string } = {}) => ({
  id,
  in_reply_to_id: options.replyTo ?? null,
  user,
  author_association: options.association ?? (user.type === 'Bot' ? 'NONE' : 'OWNER'),
  path: options.path ?? 'scripts/preview.mjs',
  html_url: `https://example.test/r/${id}`,
  body: options.body ?? 'finding',
});
const unanswered = (id: number, path = 'scripts/preview.mjs', login = CODEX.login) =>
  `merge-guard: refusing to merge #42: unanswered bot review comment from ${login} on ${path}: https://example.test/r/${id}`;
const keys = generateKeyPairSync('ed25519');
const publicPem = keys.publicKey.export({ type: 'spki', format: 'pem' }) as string;
const signedMarker = (verdict: string, sha: string, id: number, pr = '42') => {
  const base = marker(verdict, sha, id);
  const signature = sign(null, Buffer.from(signedPayload({ repo: 'o/r', pr, verdict, sha }), 'utf8'), keys.privateKey).toString('base64');
  const [first, second, third, ...rest] = base.body.split('\n');
  return { ...base, body: [first, second, third, `<!-- review-verdict-signature: ${signature} -->`, ...rest].join('\n') };
};

const summary = (overrides: Record<string, unknown> = {}, git: Record<string, unknown> = {}) => ({
  status: 'passed',
  stages: [],
  git: { headAtStart: HEAD, headAtEnd: HEAD, cleanAtStart: true, cleanAtEnd: true, ...git },
  ...overrides,
});

let dir: string;
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function run(args: string[], options: {
  prState?: string;
  pages?: unknown[][];
  reviewPages?: unknown[][];
  site?: unknown;
  infra?: unknown;
  mergeExit?: number;
  key?: string;
  headKey?: string;
  keyError?: boolean | 'ref';
  baseRef?: string;
  author?: string;
} = {}) {
  dir = mkdtempSync(join(tmpdir(), 'merge-guard-'));
  mkdirSync(join(dir, 'bin'));
  writeFileSync(join(dir, 'bin/gh'), stub);
  chmodSync(join(dir, 'bin/gh'), 0o755);
  writeFileSync(join(dir, 'state.json'), JSON.stringify({
    head: HEAD,
    pr: args[0],
    prState: options.prState ?? 'OPEN',
    pages: options.pages ?? [[marker('FAIL', HEAD, 1)], [marker('PASS', HEAD, 2)]],
    reviewPages: options.reviewPages ?? [[]],
    mergeExit: options.mergeExit ?? 0,
    author: options.author ?? 'FlorianRiquelme',
    baseKey: options.key,
    keyError: options.keyError,
    baseRef: options.baseRef,
  }));
  if (options.headKey !== undefined) {
    mkdirSync(join(dir, '.github'));
    writeFileSync(join(dir, '.github/review-verdict-key.pub'), options.headKey);
  }
  for (const [file, content] of [[SITE, 'site' in options ? options.site : summary()], [INFRA, 'infra' in options ? options.infra : summary()]] as const) {
    if (content === undefined) continue;
    mkdirSync(join(dir, file, '..'), { recursive: true });
    writeFileSync(join(dir, file), typeof content === 'string' ? content : JSON.stringify(content));
  }
  const result = spawnSync(process.execPath, [guard, ...args], {
    cwd: dir,
    encoding: 'utf8',
    env: { ...process.env, PATH: `${join(dir, 'bin')}:${process.env.PATH}`, STUB_DIR: dir },
  });
  const log = existsSync(join(dir, 'gh.log')) ? readFileSync(join(dir, 'gh.log'), 'utf8').trimEnd().split('\n').map(line => JSON.parse(line)) : [];
  return { ...result, calls: log as string[][], merges: (log as string[][]).filter(call => call[0] === 'pr' && call[1] === 'merge') };
}

describe('merge-guard.mjs', () => {
  it('merges exactly once with the exact arguments when every check passes', () => {
    const result = run(['42']);
    expect(result.status, result.stderr).toBe(0);
    expect(result.calls).toEqual([
      ['pr', 'view', '42', '--json', 'headRefOid,state'],
      ['api', '--paginate', '--slurp', 'repos/{owner}/{repo}/issues/42/comments'],
      ['api', 'repos/{owner}/{repo}/pulls/42'],
      ['api', '-H', 'Accept: application/vnd.github.raw', 'repos/{owner}/{repo}/contents/.github/review-verdict-key.pub?ref=main'],
      ['api', '--paginate', '--slurp', 'repos/{owner}/{repo}/pulls/42/comments'],
      ['pr', 'merge', '42', '--squash', '--match-head-commit', HEAD],
    ]);
  });

  it("exits with gh pr merge's exit code", () => {
    const result = run(['42'], { mergeExit: 7 });
    expect(result.status).toBe(7);
    expect(result.merges).toHaveLength(1);
  });

  const refusals: [string, Parameters<typeof run>[1], RegExp][] = [
    ['infra summary missing', { infra: undefined }, /reports\/verification-infra\/summary\.json: cannot be read \(ENOENT\)/],
    ['site summary unparseable', { site: '{' }, /reports\/verification\/summary\.json: does not parse as JSON/],
    ['site summary failed', { site: summary({ status: 'failed' }) }, /reports\/verification\/summary\.json: status is "failed", not "passed"/],
    ['headAtStart differs from the PR head', { site: summary({}, { headAtStart: OTHER }) }, new RegExp(`reports/verification/summary\\.json: git\\.headAtStart is "${OTHER}", not the PR head ${HEAD}`)],
    ['headAtEnd differs from the PR head', { infra: summary({}, { headAtEnd: OTHER }) }, new RegExp(`reports/verification-infra/summary\\.json: git\\.headAtEnd is "${OTHER}", not the PR head ${HEAD}`)],
    ['summary without git state', { infra: summary({ git: undefined }) }, /reports\/verification-infra\/summary\.json: git\.headAtStart is undefined/],
    ['cleanAtStart false', { site: summary({}, { cleanAtStart: false }) }, /reports\/verification\/summary\.json: git\.cleanAtStart is false, not true/],
    ['cleanAtEnd false', { infra: summary({}, { cleanAtEnd: false }) }, /reports\/verification-infra\/summary\.json: git\.cleanAtEnd is false, not true/],
    ['cleanAtEnd null', { site: summary({}, { cleanAtEnd: null }) }, /reports\/verification\/summary\.json: git\.cleanAtEnd is null, not true/],
    ['latest marker FAIL', { pages: [[marker('PASS', HEAD, 1)], [marker('FAIL', HEAD, 2)]] }, /review verdict: Latest verdict for aaaaaaa is FAIL/],
    ['no marker for the head', { pages: [[marker('PASS', OTHER, 1)]] }, /review verdict: No PASS verdict for head aaaaaaa/],
    ['PR not OPEN', { prState: 'MERGED' }, /PR state is MERGED, not OPEN/],
  ];
  for (const [cause, options, message] of refusals) {
    it(`refuses without merging when ${cause}`, () => {
      const result = run(['42'], options);
      expect(result.status).toBe(1);
      expect(result.merges).toEqual([]);
      expect(result.stderr).toMatch(message);
      expect(result.stderr).toContain('merge-guard: refusing to merge #42');
    });
  }

  const stderrLines = (stderr: string) => stderr.trimEnd().split('\n');

  it('refuses with one exact line per unanswered bot-rooted inline thread', () => {
    const result = run(['42'], { reviewPages: [[
      inline(10, CODEX),
      inline(11, CODEX, { path: 'src/pages/index.astro' }),
      inline(12, { login: 'renovate[bot]', type: 'User' }, { path: 'package.json' }),
    ]] });
    expect(result.status).toBe(1);
    expect(result.merges).toEqual([]);
    expect(stderrLines(result.stderr)).toEqual([
      unanswered(10),
      unanswered(11, 'src/pages/index.astro'),
      unanswered(12, 'package.json', 'renovate[bot]'),
    ]);
  });

  const notAnswers: [string, ReturnType<typeof inline>][] = [
    ['another bot (type Bot)', inline(20, { login: 'github-actions', type: 'Bot' }, { replyTo: 10, association: 'OWNER' })],
    ['another bot (login ending in [bot])', inline(20, { login: 'helper[bot]', type: 'User' }, { replyTo: 10, association: 'OWNER' })],
    ['the same bot', inline(20, CODEX, { replyTo: 10, association: 'OWNER' })],
    ['an untrusted CONTRIBUTOR', inline(20, { login: 'someone', type: 'User' }, { replyTo: 10, association: 'CONTRIBUTOR' })],
    ['an untrusted NONE', inline(20, { login: 'someone', type: 'User' }, { replyTo: 10, association: 'NONE' })],
    ['a trusted owner in a different thread', inline(20, HUMAN, { replyTo: 99 })],
  ];
  for (const [who, reply] of notAnswers) {
    it(`still refuses when the only reply to a bot thread comes from ${who}`, () => {
      const result = run(['42'], { reviewPages: [[inline(10, CODEX), reply]] });
      expect(result.status).toBe(1);
      expect(result.merges).toEqual([]);
      expect(stderrLines(result.stderr)).toEqual([unanswered(10)]);
    });
  }

  for (const association of ['OWNER', 'MEMBER', 'COLLABORATOR']) {
    it(`merges when a bot thread has a reply from a non-bot ${association}, whatever the reply says`, () => {
      const result = run(['42'], { reviewPages: [[
        inline(10, CODEX),
        inline(20, { login: 'someone', type: 'User' }, { replyTo: 10, association, body: 'not applicable' }),
      ]] });
      expect(result.status, result.stderr).toBe(0);
      expect(result.merges).toEqual([['pr', 'merge', '42', '--squash', '--match-head-commit', HEAD]]);
    });
  }

  it('matches replies on later pages to bot roots on earlier pages', () => {
    const result = run(['42'], { reviewPages: [
      [inline(10, CODEX), inline(11, CODEX)],
      [inline(20, HUMAN, { replyTo: 11 })],
      [inline(21, HUMAN, { replyTo: 10 })],
    ] });
    expect(result.status, result.stderr).toBe(0);
    expect(result.merges).toHaveLength(1);
  });

  it('refuses for the unanswered bot thread only when another bot thread on a later page is answered', () => {
    const result = run(['42'], { reviewPages: [[inline(10, CODEX), inline(11, CODEX)], [inline(20, HUMAN, { replyTo: 11 })]] });
    expect(result.status).toBe(1);
    expect(stderrLines(result.stderr)).toEqual([unanswered(10)]);
  });

  it('does not block on inline comments from human users without replies', () => {
    const result = run(['42'], { reviewPages: [[inline(10, HUMAN), inline(11, { login: 'someone', type: 'User' }, { association: 'CONTRIBUTOR' })]] });
    expect(result.status, result.stderr).toBe(0);
    expect(result.merges).toHaveLength(1);
  });

  it('reports unanswered bot threads together with summary and verdict refusals', () => {
    const result = run(['42'], {
      site: summary({ status: 'failed' }),
      pages: [[marker('FAIL', HEAD, 1)]],
      reviewPages: [[inline(10, CODEX)]],
    });
    expect(result.status).toBe(1);
    expect(result.merges).toEqual([]);
    expect(stderrLines(result.stderr)).toEqual([
      'merge-guard: refusing to merge #42: reports/verification/summary.json: status is "failed", not "passed"',
      'merge-guard: refusing to merge #42: review verdict: Latest verdict for aaaaaaa is FAIL',
      unanswered(10),
    ]);
  });

  it('reads the summaries from the working directory, not the script location', () => {
    // The guard must judge the gates of the worktree it runs in.
    const result = run(['42'], { site: undefined, infra: undefined });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/reports\/verification\/summary\.json: cannot be read/);
    expect(result.merges).toEqual([]);
  });

  describe('with .github/review-verdict-key.pub on the base branch', () => {
    it('merges on a signed PASS', () => {
      const result = run(['42'], { key: publicPem, pages: [[signedMarker('PASS', HEAD, 1)]] });
      expect(result.status, result.stderr).toBe(0);
      expect(result.merges).toHaveLength(1);
    });

    it('refuses an unsigned PASS', () => {
      const result = run(['42'], { key: publicPem });
      expect(result.status).toBe(1);
      expect(result.merges).toEqual([]);
      expect(result.stderr).toMatch(/review verdict: No signed PASS verdict for head aaaaaaa/);
    });

    it('refuses a signature made for another PR number', () => {
      const result = run(['42'], { key: publicPem, pages: [[signedMarker('PASS', HEAD, 1, '43')]] });
      expect(result.status).toBe(1);
      expect(result.merges).toEqual([]);
    });

    it('accepts an unsigned PASS on a Dependabot PR', () => {
      const result = run(['42'], { key: publicPem, author: 'dependabot[bot]' });
      expect(result.status, result.stderr).toBe(0);
      expect(result.merges).toHaveLength(1);
    });

    it('refuses when the base key does not load', () => {
      const result = run(['42'], { key: 'not a key', author: 'dependabot[bot]' });
      expect(result.status).toBe(1);
      expect(result.merges).toEqual([]);
    });

    it('refuses when the key cannot be fetched for a reason other than 404', () => {
      const result = run(['42'], { key: publicPem, keyError: true, author: 'dependabot[bot]' });
      expect(result.status).toBe(1);
      expect(result.merges).toEqual([]);
      expect(result.stderr).toMatch(/HTTP 500/);
    });

    it('refuses when the base ref is missing, which answers 404 too', () => {
      const result = run(['42'], { key: publicPem, keyError: 'ref', author: 'dependabot[bot]' });
      expect(result.status).toBe(1);
      expect(result.merges).toEqual([]);
      expect(result.stderr).toMatch(/No commit found/);
    });

    it('fetches the key from the PR base ref', () => {
      const result = run(['42'], { baseRef: 'release' });
      expect(result.calls).toContainEqual(['api', '-H', 'Accept: application/vnd.github.raw', 'repos/{owner}/{repo}/contents/.github/review-verdict-key.pub?ref=release']);
    });

    it('still refuses an unsigned PASS when the head worktree has no key file', () => {
      const result = run(['42'], { key: publicPem });
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/No signed PASS verdict/);
    });

    it('refuses a verdict signed with a key the head worktree swapped in', () => {
      const other = generateKeyPairSync('ed25519');
      const headPem = other.publicKey.export({ type: 'spki', format: 'pem' }) as string;
      const body = signedMarker('PASS', HEAD, 1);
      const sig = sign(null, Buffer.from(signedPayload({ repo: 'o/r', pr: '42', verdict: 'PASS', sha: HEAD }), 'utf8'), other.privateKey).toString('base64');
      const forged = { ...body, body: body.body.replace(/signature: \S+ -->/, `signature: ${sig} -->`) };
      const result = run(['42'], { key: publicPem, headKey: headPem, pages: [[forged]] });
      expect(result.status).toBe(1);
      expect(result.merges).toEqual([]);
    });

    it('ignores a head worktree key when the base has none', () => {
      const result = run(['42'], { headKey: publicPem });
      expect(result.status, result.stderr).toBe(0);
    });
  });

  for (const args of [[], ['abc'], ['42abc'], ['0'], ['-1'], ['42', '43']]) {
    it(`exits 2 without calling gh for arguments ${JSON.stringify(args)}`, () => {
      const result = run(args);
      expect(result.status).toBe(2);
      expect(result.stderr).toContain('usage: node scripts/merge-guard.mjs <pr-number>');
      expect(result.calls).toEqual([]);
    });
  }

  it('imports evaluate and TRUSTED_ASSOCIATIONS from review-verdict.mjs instead of duplicating them', () => {
    const source = readFileSync(guard, 'utf8');
    expect(source).toContain("import { evaluate, publicKeyFromPem, TRUSTED_ASSOCIATIONS } from './review-verdict.mjs';");
    expect(source).not.toContain('review-verdict:');
  });
});

describe('AGENTS.md merge instruction', () => {
  it('tells agents to merge through the guard', () => {
    const agents = readFileSync(join(root, 'AGENTS.md'), 'utf8');
    const start = agents.indexOf('## Merge and deploy');
    const section = agents.slice(start, agents.indexOf('\n## ', start + 1));
    expect(section).toContain('Merge through `node scripts/merge-guard.mjs <n>`, run from the worktree that ran both gates.');
    expect(section).toContain('Do not call `gh pr merge` directly.');
    expect(section).toContain('It also refuses while any inline review thread started by a bot account has no reply from a non-bot owner, member or collaborator');
    expect(existsSync(join(root, 'scripts/merge-guard.mjs'))).toBe(true);
  });
});
