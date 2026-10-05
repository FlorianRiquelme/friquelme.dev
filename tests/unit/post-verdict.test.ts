import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));
const script = join(root, 'scripts/post-verdict.mjs');
const fixture = join(root, 'tests/fixtures/subagent-transcript.jsonl');
const HEAD = 'a'.repeat(40);
const OTHER = 'b'.repeat(40);

// The stub answers `gh pr view` from $STUB_HEAD, copies the --body-file of `gh pr comment` and logs each call.
const stub = `#!/usr/bin/env node
const { appendFileSync, copyFileSync } = require('node:fs');
const dir = process.env.STUB_DIR;
const args = process.argv.slice(2);
appendFileSync(dir + '/gh.log', JSON.stringify(args) + '\\n');
if (args[0] === 'pr' && args[1] === 'view') process.stdout.write(JSON.stringify({ headRefOid: process.env.STUB_HEAD }));
else if (args[0] === 'pr' && args[1] === 'comment') { copyFileSync(args[args.indexOf('--body-file') + 1], dir + '/posted.md'); process.exit(Number(process.env.COMMENT_EXIT ?? 0)); }
else process.exit(99);
`;

const verdict = (sha = HEAD, v = 'PASS') => `<!-- review-verdict: ${v} sha=${sha} -->\nReview verdict: ${v}\nReviewed head: ${sha}\n\nFindings: none <b>&amp;</b>\n`;
const assistant = (...texts: string[]) => JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: texts.map(text => ({ type: 'text', text })) } });
const thinking = JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'thinking', thinking: '' }] } });

let dir: string;
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function run(lines: string[] | null, args?: string[], env: Record<string, string> = {}) {
  dir = mkdtempSync(join(tmpdir(), 'post-verdict-'));
  mkdirSync(join(dir, 'bin'));
  writeFileSync(join(dir, 'bin/gh'), stub);
  chmodSync(join(dir, 'bin/gh'), 0o755);
  const transcript = join(dir, 't.jsonl');
  if (lines) writeFileSync(transcript, lines.join('\n') + '\n');
  const result = spawnSync('node', [script, ...(args ?? ['7', transcript])], {
    encoding: 'utf8',
    env: { ...process.env, PATH: `${join(dir, 'bin')}:${process.env.PATH}`, STUB_DIR: dir, STUB_HEAD: HEAD, ...env },
  });
  const log = existsSync(join(dir, 'gh.log')) ? readFileSync(join(dir, 'gh.log'), 'utf8').trim().split('\n').map(l => JSON.parse(l)) : [];
  const posted = existsSync(join(dir, 'posted.md')) ? readFileSync(join(dir, 'posted.md'), 'utf8') : null;
  return { ...result, log, posted, comments: log.filter(a => a[1] === 'comment') };
}

describe('post-verdict.mjs', () => {
  it('posts the joined text blocks of the last assistant text message byte for byte', () => {
    const r = run([assistant(verdict(OTHER, 'FAIL')), assistant('ignored earlier'), assistant(verdict().slice(0, 30), verdict().slice(30)), thinking]);
    expect(r.status).toBe(0);
    expect(r.comments).toHaveLength(1);
    expect(r.comments[0].slice(0, 3)).toEqual(['pr', 'comment', '7']);
    expect(r.comments[0][3]).toBe('--body-file');
    expect(r.posted).toBe(verdict());
  });

  it('posts a trimmed real Claude Code subagent transcript', () => {
    const r = run(null, ['7', fixture]);
    expect(r.status).toBe(0);
    expect(r.posted).toBe(`<!-- review-verdict: PASS sha=${HEAD} -->\nReview verdict: PASS\nReviewed head: ${HEAD}\n\nNo blocking findings.`);
  });

  it('exits with the exit code of gh pr comment', () => {
    expect(run([assistant(verdict())], undefined, { COMMENT_EXIT: '3' }).status).toBe(3);
  });

  it('refuses a verdict for another head without posting', () => {
    const r = run([assistant(verdict(OTHER))]);
    expect(r.status).toBe(1);
    expect(r.comments).toHaveLength(0);
  });

  it.each([
    ['marker not on the first line', `intro\n${verdict()}`],
    ['verdict line mismatch', verdict().replace('Review verdict: PASS', 'Review verdict: FAIL')],
    ['head line mismatch', verdict().replace(`Reviewed head: ${HEAD}`, `Reviewed head: ${OTHER}`)],
    ['no marker', 'Looks fine.'],
  ])('refuses %s without posting', (_name, text) => {
    const r = run([assistant(text)]);
    expect(r.status).toBe(1);
    expect(r.comments).toHaveLength(0);
  });

  it('refuses escaped text, naming the escaping', () => {
    const r = run([assistant(verdict().replace('<!--', '&lt;!--'))]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('escaped');
    expect(r.comments).toHaveLength(0);
  });

  it('refuses escaped text even when it is otherwise a valid verdict', () => {
    const r = run([assistant(`${verdict()}\nquoted: &lt;!-- x`)]);
    expect(r.status).toBe(1);
    expect(r.comments).toHaveLength(0);
  });

  it('exits 2 on missing arguments, an unreadable file and no assistant text', () => {
    expect(run(null, []).status).toBe(2);
    expect(run(null, ['7']).status).toBe(2);
    expect(run(null, ['7', '/nonexistent/t.jsonl']).status).toBe(2);
    expect(run([thinking, JSON.stringify({ type: 'user', message: { content: 'hi' } })]).status).toBe(2);
  });

  it('reuses parseVerdict instead of reimplementing it', () => {
    const source = readFileSync(script, 'utf8');
    expect(source).toMatch(/import \{ parseVerdict \} from '\.\/review-verdict\.mjs'/);
    expect(source).not.toContain('review-verdict: (PASS');
  });

  it('is what AGENTS.md tells implementers to post verdicts with', () => {
    expect(readFileSync(join(root, 'AGENTS.md'), 'utf8')).toContain('node scripts/post-verdict.mjs <n> <transcript>');
  });
});
