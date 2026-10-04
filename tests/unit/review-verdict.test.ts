import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { evaluate, parseVerdict, STATUS_CONTEXT } from '../../scripts/review-verdict.mjs';

const HEAD = 'a'.repeat(20) + 'b'.repeat(20);
const OLD = 'c'.repeat(40);
const script = fileURLToPath(new URL('../../scripts/review-verdict.mjs', import.meta.url));
const root = fileURLToPath(new URL('../..', import.meta.url));

function body(verdict: string, sha: string) {
  return [
    `<!-- review-verdict: ${verdict} sha=${sha} -->`,
    `Review verdict: ${verdict}`,
    `Reviewed head: ${sha}`,
    'Reviewer: test',
  ].join('\n');
}

let nextId = 1;
function comment(over: Record<string, unknown> = {}) {
  const id = nextId++;
  return {
    id,
    body: body('PASS', HEAD),
    author_association: 'OWNER',
    created_at: `2026-01-01T00:00:${String(id % 60).padStart(2, '0')}Z`,
    html_url: `https://github.com/o/r/pull/1#issuecomment-${id}`,
    user: { login: 'rev' },
    ...over,
  };
}

describe('parseVerdict', () => {
  it('parses a well-formed verdict', () => {
    expect(parseVerdict(body('PASS', HEAD))).toEqual({ verdict: 'PASS', sha: HEAD });
    expect(parseVerdict(body('FAIL', HEAD).replace(/\n/g, '\r\n'))).toEqual({ verdict: 'FAIL', sha: HEAD });
  });

  it.each([
    ['indented marker', `  <!-- review-verdict: PASS sha=${HEAD} -->`],
    ['marker inside text', `see <!-- review-verdict: PASS sha=${HEAD} --> here`],
    ['uppercase sha', `<!-- review-verdict: PASS sha=${HEAD.toUpperCase()} -->`],
    ['39-char sha', `<!-- review-verdict: PASS sha=${HEAD.slice(1)} -->`],
    ['text after the marker', `<!-- review-verdict: PASS sha=${HEAD} --> ignore`],
  ])('rejects %s', (_name, marker) => {
    const text = [marker, 'Review verdict: PASS', `Reviewed head: ${HEAD}`].join('\n');
    expect(parseVerdict(text)).toBeNull();
  });

  it('rejects two marker lines', () => {
    expect(parseVerdict(`${body('PASS', HEAD)}\n${body('PASS', HEAD)}`)).toBeNull();
  });

  it('rejects a marker without the visible lines', () => {
    expect(parseVerdict(`<!-- review-verdict: PASS sha=${HEAD} -->`)).toBeNull();
    expect(parseVerdict(`<!-- review-verdict: PASS sha=${HEAD} -->\nReview verdict: PASS`)).toBeNull();
  });

  it('rejects a Reviewed head naming another sha', () => {
    expect(parseVerdict(body('PASS', HEAD).replace(`Reviewed head: ${HEAD}`, `Reviewed head: ${OLD}`))).toBeNull();
  });

  it('rejects a verdict quoted below the first line, as in a code fence', () => {
    const quoted = `Example of what the reviewer returns:\n\`\`\`\n${body('PASS', HEAD)}\n\`\`\``;
    expect(parseVerdict(quoted)).toBeNull();
    expect(evaluate({ headSha: HEAD, comments: [comment({ body: quoted })] }).state).toBe('failure');
    expect(parseVerdict(`\n${body('PASS', HEAD)}`)).toBeNull();
  });

  it('rejects visible lines that do not directly follow the marker', () => {
    const [marker, ...rest] = body('PASS', HEAD).split('\n');
    expect(parseVerdict([marker, '', ...rest].join('\n'))).toBeNull();
  });

  it('rejects a marker below otherwise well-placed visible lines', () => {
    const text = ['Note', 'Review verdict: PASS', `Reviewed head: ${HEAD}`, `<!-- review-verdict: PASS sha=${HEAD} -->`].join('\n');
    expect(parseVerdict(text)).toBeNull();
  });

  it('rejects a Review verdict line that is not the second line', () => {
    const text = [`<!-- review-verdict: PASS sha=${HEAD} -->`, 'Note', `Reviewed head: ${HEAD}`, 'Review verdict: PASS'].join('\n');
    expect(parseVerdict(text)).toBeNull();
  });

  it('rejects a Reviewed head line that is not the third line', () => {
    const text = [`<!-- review-verdict: PASS sha=${HEAD} -->`, 'Review verdict: PASS', 'Note', `Reviewed head: ${HEAD}`].join('\n');
    expect(parseVerdict(text)).toBeNull();
  });

  it('tolerates trailing whitespace on the visible lines', () => {
    const padded = body('PASS', HEAD).replace('Review verdict: PASS', 'Review verdict: PASS  ').replace(`Reviewed head: ${HEAD}`, `Reviewed head: ${HEAD}\t`);
    expect(parseVerdict(padded)).toEqual({ verdict: 'PASS', sha: HEAD });
  });

  it('rejects a visible verdict that disagrees with the marker', () => {
    expect(parseVerdict(body('PASS', HEAD).replace('Review verdict: PASS', 'Review verdict: FAIL'))).toBeNull();
  });
});

describe('evaluate', () => {
  it('fails with no comments', () => {
    expect(evaluate({ headSha: HEAD, comments: [] })).toEqual({
      state: 'failure',
      description: `No PASS verdict for head ${HEAD.slice(0, 7)}`,
      targetUrl: null,
    });
  });

  it.each(['OWNER', 'MEMBER', 'COLLABORATOR'])('accepts PASS by %s', association => {
    const c = comment({ author_association: association });
    expect(evaluate({ headSha: HEAD, comments: [c] })).toEqual({
      state: 'success',
      description: `PASS for ${HEAD.slice(0, 7)} by rev`,
      targetUrl: c.html_url,
    });
  });

  it('fails on a stale PASS for an older sha', () => {
    const result = evaluate({ headSha: HEAD, comments: [comment({ body: body('PASS', OLD) })] });
    expect(result.state).toBe('failure');
    expect(result.description).toBe(`No PASS verdict for head ${HEAD.slice(0, 7)}`);
  });

  it.each(['CONTRIBUTOR', 'NONE', 'FIRST_TIME_CONTRIBUTOR'])('ignores PASS by %s', association => {
    const result = evaluate({ headSha: HEAD, comments: [comment({ author_association: association })] });
    expect(result.state).toBe('failure');
    expect(result.targetUrl).toBeNull();
  });

  it('lets a later FAIL override an earlier PASS', () => {
    const pass = comment({ created_at: '2026-01-01T00:00:01Z' });
    const fail = comment({ body: body('FAIL', HEAD), created_at: '2026-01-01T00:00:02Z' });
    expect(evaluate({ headSha: HEAD, comments: [pass, fail] })).toEqual({
      state: 'failure',
      description: `Latest verdict for ${HEAD.slice(0, 7)} is FAIL`,
      targetUrl: fail.html_url,
    });
  });

  it('lets a later PASS override an earlier FAIL', () => {
    const fail = comment({ body: body('FAIL', HEAD), created_at: '2026-01-01T00:00:01Z' });
    const pass = comment({ created_at: '2026-01-01T00:00:02Z' });
    const result = evaluate({ headSha: HEAD, comments: [fail, pass] });
    expect(result.state).toBe('success');
    expect(result.targetUrl).toBe(pass.html_url);
  });

  it('orders by created_at, not array order', () => {
    const fail = comment({ body: body('FAIL', HEAD), created_at: '2026-01-01T00:00:02Z' });
    const pass = comment({ created_at: '2026-01-01T00:00:01Z' });
    expect(evaluate({ headSha: HEAD, comments: [fail, pass] }).state).toBe('failure');
    expect(evaluate({ headSha: HEAD, comments: [pass, fail] }).state).toBe('failure');
  });

  it('breaks created_at ties by id', () => {
    const pass = comment({ id: 20, created_at: '2026-01-01T00:00:01Z' });
    const fail = comment({ id: 10, body: body('FAIL', HEAD), created_at: '2026-01-01T00:00:01Z' });
    expect(evaluate({ headSha: HEAD, comments: [pass, fail] }).state).toBe('success');
  });

  it('keeps the description within 140 characters', () => {
    const result = evaluate({ headSha: HEAD, comments: [comment({ user: { login: 'x'.repeat(300) } })] });
    expect(result.state).toBe('success');
    expect(result.description.length).toBeLessThanOrEqual(140);
  });
});

describe('CLI', () => {
  let server: Server | undefined;
  afterEach(() => new Promise<void>(done => (server ? server.close(() => done()) : done())));

  type Recorded = { method: string; url: string; auth: string | undefined; body: string };

  async function stub(handler: (req: IncomingMessage, url: string) => { status: number; json: unknown }) {
    const requests: Recorded[] = [];
    server = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', () => {
        const url = req.url ?? '';
        requests.push({ method: req.method ?? '', url, auth: req.headers.authorization, body: Buffer.concat(chunks).toString() });
        const { status, json } = handler(req, url);
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(JSON.stringify(json));
      });
    });
    await new Promise<void>(done => server!.listen(0, '127.0.0.1', done));
    return { requests, api: `http://127.0.0.1:${(server.address() as AddressInfo).port}` };
  }

  function run(env: Record<string, string>) {
    return new Promise<{ code: number | null; stdout: string; stderr: string }>(done => {
      const child = spawn(process.execPath, [script], {
        cwd: root,
        env: { PATH: process.env.PATH ?? '', ...env },
      });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', d => (stdout += d));
      child.stderr.on('data', d => (stderr += d));
      child.on('close', code => done({ code, stdout, stderr }));
    });
  }

  const pull = { head: { sha: HEAD }, html_url: 'https://github.com/o/r/pull/1' };

  it('finds a PASS on page 2 and posts one success status', async () => {
    const pass = comment({ id: 9999, created_at: '2026-02-01T00:00:00Z' });
    const filler = Array.from({ length: 100 }, (_, i) => comment({ id: 1000 + i, body: 'noise', author_association: 'NONE' }));
    const page2 = [pass, ...Array.from({ length: 49 }, (_, i) => comment({ id: 2000 + i, body: 'noise', author_association: 'NONE' }))];
    const { requests, api } = await stub((_req, url) => {
      if (url === '/repos/o/r/pulls/1') return { status: 200, json: pull };
      if (url === '/repos/o/r/issues/1/comments?per_page=100&page=1') return { status: 200, json: filler };
      if (url === '/repos/o/r/issues/1/comments?per_page=100&page=2') return { status: 200, json: page2 };
      if (url === `/repos/o/r/statuses/${HEAD}`) return { status: 201, json: {} };
      return { status: 404, json: {} };
    });
    const result = await run({ GITHUB_TOKEN: 'tok', GITHUB_REPOSITORY: 'o/r', PR_NUMBER: '1', GITHUB_API_URL: api });
    expect(result.code).toBe(0);
    expect(result.stdout).toBe(`review-verdict: success on ${HEAD} (PASS for ${HEAD.slice(0, 7)} by rev)\n`);
    const posts = requests.filter(r => r.method === 'POST');
    expect(posts.map(r => r.url)).toEqual([`/repos/o/r/statuses/${HEAD}`]);
    expect(JSON.parse(posts[0].body)).toEqual({
      state: 'success',
      context: STATUS_CONTEXT,
      description: `PASS for ${HEAD.slice(0, 7)} by rev`,
      target_url: pass.html_url,
    });
    expect(requests.map(r => r.url)).toEqual([
      '/repos/o/r/pulls/1',
      '/repos/o/r/issues/1/comments?per_page=100&page=1',
      '/repos/o/r/issues/1/comments?per_page=100&page=2',
      `/repos/o/r/statuses/${HEAD}`,
    ]);
    expect(requests.map(r => r.auth)).toEqual(Array(4).fill('Bearer tok'));
  });

  it('posts a failure status with the PR url when no PASS exists', async () => {
    const { requests, api } = await stub((_req, url) => {
      if (url === '/repos/o/r/pulls/1') return { status: 200, json: pull };
      if (url.startsWith('/repos/o/r/issues/1/comments')) return { status: 200, json: [] };
      return { status: 201, json: {} };
    });
    const result = await run({ GITHUB_TOKEN: 'tok', GITHUB_REPOSITORY: 'o/r', PR_NUMBER: '1', GITHUB_API_URL: api });
    expect(result.code).toBe(0);
    const posts = requests.filter(r => r.method === 'POST');
    expect(posts).toHaveLength(1);
    expect(JSON.parse(posts[0].body)).toEqual({
      state: 'failure',
      context: STATUS_CONTEXT,
      description: `No PASS verdict for head ${HEAD.slice(0, 7)}`,
      target_url: pull.html_url,
    });
  });

  it('exits 1 without posting when the API errors', async () => {
    const { requests, api } = await stub(() => ({ status: 500, json: {} }));
    const result = await run({ GITHUB_TOKEN: 'tok', GITHUB_REPOSITORY: 'o/r', PR_NUMBER: '1', GITHUB_API_URL: api });
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('500');
    expect(requests.map(r => `${r.method} ${r.url}`)).toEqual(['GET /repos/o/r/pulls/1']);
  });

  it('exits 2 when PR_NUMBER is missing', async () => {
    const result = await run({ GITHUB_TOKEN: 'tok', GITHUB_REPOSITORY: 'o/r' });
    expect(result.code).toBe(2);
    expect(result.stderr).toContain('PR_NUMBER');
  });
});

describe('documented verdict templates', () => {
  const block = (file: string) => {
    const text = readFileSync(`${root}/${file}`, 'utf8');
    const blocks = [...text.matchAll(/^```\n([\s\S]*?)^```$/gm)].map(match => match[1]).filter(b => b.includes('review-verdict'));
    expect(blocks).toHaveLength(1);
    return blocks[0];
  };

  it('REVIEW.md output format parses once filled in', () => {
    const filled = block('REVIEW.md').replaceAll('PASS | FAIL', 'PASS').replaceAll('<full sha>', HEAD);
    expect(parseVerdict(filled)).toEqual({ verdict: 'PASS', sha: HEAD });
  });

  it('the Dependabot automation verdict comment parses once filled in', () => {
    const filled = block('.github/automation/dependabot-review.md').replaceAll('<head sha>', HEAD);
    expect(parseVerdict(filled)).toEqual({ verdict: 'PASS', sha: HEAD });
  });
});
