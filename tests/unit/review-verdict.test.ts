import { spawn } from 'node:child_process';
import { generateKeyPairSync, sign, verify } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { evaluate, loadPublicKey, summaryLine, warningCommand, parseVerdict, signedPayload, SIGNED_STATUS_CONTEXT, STATUS_CONTEXT } from '../../scripts/review-verdict.mjs';

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
    expect(parseVerdict(body('PASS', HEAD))).toEqual({ verdict: 'PASS', sha: HEAD, signature: null });
    expect(parseVerdict(body('FAIL', HEAD).replace(/\n/g, '\r\n'))).toEqual({ verdict: 'FAIL', sha: HEAD, signature: null });
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
    expect(parseVerdict(padded)).toEqual({ verdict: 'PASS', sha: HEAD, signature: null });
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

const keys = generateKeyPairSync('ed25519');
const REPO = 'o/r';
const sign64 = (over: Partial<{ repo: string; pr: number | string; verdict: string; sha: string }> = {}) =>
  sign(null, Buffer.from(signedPayload({ repo: REPO, pr: 1, verdict: 'PASS', sha: HEAD, ...over }), 'utf8'), keys.privateKey).toString('base64');
function signedBody(verdict: string, sha: string, signature = sign64({ verdict, sha })) {
  const [a, b, c, ...rest] = body(verdict, sha).split('\n');
  return [a, b, c, `<!-- review-verdict-signature: ${signature} -->`, ...rest].join('\n');
}
const ctx = { publicKey: keys.publicKey, repo: REPO, pr: 1, prAuthor: 'FlorianRiquelme' };

describe('evaluate bot filter', () => {
  it('ignores a PASS marker from a Bot-type user even with a trusted association', () => {
    const result = evaluate({ headSha: HEAD, comments: [comment({ user: { login: 'x[bot]', type: 'Bot' } })] });
    expect(result.state).toBe('failure');
    expect(result.description).toBe('No PASS verdict for head ' + HEAD.slice(0, 7));
  });
});

describe('warningCommand and summaryLine', () => {
  const failure = { state: 'failure', description: 'No PASS verdict for head abc1234' };
  it('warns when the state is not success', () => {
    expect(warningCommand(failure)).toBe('::warning title=review-verdict::No PASS verdict for head abc1234');
  });
  it('returns nothing on success', () => {
    expect(warningCommand({ state: 'success', description: 'PASS for abc1234 by x' })).toBeNull();
  });
  it('names state, short sha and description in the summary', () => {
    expect(summaryLine(failure, HEAD)).toBe(`review-verdict: failure for ${HEAD.slice(0, 7)} (No PASS verdict for head abc1234)\n`);
  });
});

describe('signedPayload', () => {
  it('has the contract format', () => {
    expect(signedPayload({ repo: 'o/r', pr: 7, verdict: 'PASS', sha: HEAD })).toBe(`review-verdict:v1:o/r:7:PASS:${HEAD}`);
  });
});

describe('parseVerdict signature', () => {
  it('returns the signature from line index 3', () => {
    const signature = sign64();
    expect(signature).toHaveLength(88);
    expect(parseVerdict(signedBody('PASS', HEAD))).toEqual({ verdict: 'PASS', sha: HEAD, signature });
  });

  it.each([
    ['too short', sign64().slice(0, 80) + '=='],
    ['bad alphabet', '!'.repeat(86) + '=='],
    ['no padding', 'A'.repeat(88)],
  ])('treats a %s signature as absent', (_name, signature) => {
    expect(parseVerdict(signedBody('PASS', HEAD, signature))?.signature).toBeNull();
  });

  it('ignores a signature line that is not line index 3', () => {
    const [a, b, c, d, ...rest] = signedBody('PASS', HEAD).split('\n');
    expect(parseVerdict([a, b, c, 'note', d, ...rest].join('\n'))?.signature).toBeNull();
  });
});

describe('evaluate with a public key', () => {
  const ok = (comments: unknown[], over: Record<string, unknown> = {}) => evaluate({ headSha: HEAD, comments, ...ctx, ...over } as never);

  it('without a key an unsigned PASS still counts', () => {
    expect(evaluate({ headSha: HEAD, comments: [comment()], repo: REPO, pr: 1, prAuthor: 'x' }).state).toBe('success');
  });

  it('an unsigned PASS does not count', () => {
    expect(ok([comment()])).toEqual({ state: 'failure', description: `No signed PASS verdict for head ${HEAD.slice(0, 7)}`, targetUrl: null });
  });

  it('a valid signature counts', () => {
    const c = comment({ body: signedBody('PASS', HEAD) });
    expect(ok([c])).toEqual({ state: 'success', description: `Signed PASS for ${HEAD.slice(0, 7)} by rev`, targetUrl: c.html_url });
  });

  it.each([
    ['another sha', sign64({ sha: OLD })],
    ['another PR number', sign64({ pr: 2 })],
    ['another repo', sign64({ repo: 'o/other' })],
    ['a FAIL verdict', sign64({ verdict: 'FAIL' })],
    ['a different key', sign(null, Buffer.from(signedPayload({ repo: REPO, pr: 1, verdict: 'PASS', sha: HEAD }), 'utf8'), generateKeyPairSync('ed25519').privateKey).toString('base64')],
  ])('a signature for %s does not count', (_name, signature) => {
    expect(ok([comment({ body: signedBody('PASS', HEAD, signature) })]).state).toBe('failure');
  });

  it('a well-formed but bogus signature does not count', () => {
    expect(ok([comment({ body: signedBody('PASS', HEAD, 'A'.repeat(86) + '==') })]).state).toBe('failure');
  });

  it('a key that makes verify throw does not count', () => {
    // crypto.verify throws (not just returns false) for a key type that cannot verify Ed25519 signatures.
    const x25519 = generateKeyPairSync('x25519').publicKey;
    expect(() => verify(null, Buffer.from('x'), x25519, Buffer.alloc(64))).toThrow();
    expect(ok([comment({ body: signedBody('PASS', HEAD) })], { publicKey: x25519 }).state).toBe('failure');
  });

  it('a newer signed FAIL beats an older signed PASS', () => {
    const pass = comment({ body: signedBody('PASS', HEAD), created_at: '2026-01-01T00:00:01Z' });
    const fail = comment({ body: signedBody('FAIL', HEAD), created_at: '2026-01-01T00:00:02Z' });
    expect(ok([pass, fail])).toMatchObject({ state: 'failure', description: `Latest verdict for ${HEAD.slice(0, 7)} is FAIL` });
  });

  it('an unsigned FAIL cannot override a signed PASS, and a signed PASS cannot be replaced by an unsigned one', () => {
    const pass = comment({ body: signedBody('PASS', HEAD), created_at: '2026-01-01T00:00:01Z' });
    const fail = comment({ body: body('FAIL', HEAD), created_at: '2026-01-01T00:00:02Z' });
    expect(ok([pass, fail]).state).toBe('success');
  });

  it('still requires a trusted association', () => {
    expect(ok([comment({ body: signedBody('PASS', HEAD), author_association: 'NONE' })]).state).toBe('failure');
  });

  it('accepts an unsigned PASS on a Dependabot PR', () => {
    expect(ok([comment()], { prAuthor: 'dependabot[bot]' })).toMatchObject({ state: 'success', description: `PASS for ${HEAD.slice(0, 7)} by rev` });
  });

  it('keeps the signed descriptions within 140 characters', () => {
    const result = ok([comment({ body: signedBody('PASS', HEAD), user: { login: 'x'.repeat(300) } })]);
    expect(result.state).toBe('success');
    expect(result.description.length).toBeLessThanOrEqual(140);
  });
});

describe('loadPublicKey', () => {
  let tmp: string;
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));
  const write = (content: string) => {
    tmp = mkdtempSync(join(tmpdir(), 'rv-key-'));
    const file = join(tmp, 'key.pub');
    writeFileSync(file, content);
    return file;
  };

  it('returns null when the file does not exist', () => {
    tmp = mkdtempSync(join(tmpdir(), 'rv-key-'));
    expect(loadPublicKey(join(tmp, 'missing.pub'))).toBeNull();
  });

  it('returns the Ed25519 key', () => {
    const key = loadPublicKey(write(keys.publicKey.export({ type: 'spki', format: 'pem' }) as string));
    expect(key?.asymmetricKeyType).toBe('ed25519');
  });

  it('throws on garbage', () => {
    expect(() => loadPublicKey(write('garbage'))).toThrow();
  });

  it('throws on a non-Ed25519 key', () => {
    const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 }).publicKey.export({ type: 'spki', format: 'pem' }) as string;
    expect(() => loadPublicKey(write(rsa))).toThrow(/Ed25519/);
  });

  it('throws on a read error other than ENOENT', () => {
    tmp = mkdtempSync(join(tmpdir(), 'rv-key-'));
    expect(() => loadPublicKey(tmp)).toThrow();
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

  // Every run gets a cwd whose key situation the test chooses; the default is no key file, so the
  // suite does not depend on whether the repository has activated signing.
  function run(env: Record<string, string>, cwd = mkdtempSync(join(tmpdir(), 'rv-nokey-'))) {
    return new Promise<{ code: number | null; stdout: string; stderr: string }>(done => {
      const child = spawn(process.execPath, [script], {
        cwd,
        env: { PATH: process.env.PATH ?? '', ...env },
      });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', d => (stdout += d));
      child.stderr.on('data', d => (stderr += d));
      child.on('close', code => {
        rmSync(cwd, { recursive: true, force: true });
        done({ code, stdout, stderr });
      });
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

  describe('with a public key file in the working directory', () => {
    let cwd: string;
    afterEach(() => rmSync(cwd, { recursive: true, force: true }));

    async function runSigned(commentBody: string, author = 'FlorianRiquelme', keyFile?: string) {
      cwd = mkdtempSync(join(tmpdir(), 'rv-cli-'));
      mkdirSync(join(cwd, '.github'));
      writeFileSync(join(cwd, '.github/review-verdict-key.pub'), keyFile ?? (keys.publicKey.export({ type: 'spki', format: 'pem' }) as string));
      const { requests, api } = await stub((_req, url) => {
        if (url === '/repos/o/r/pulls/1') return { status: 200, json: { ...pull, user: { login: author } } };
        if (url.startsWith('/repos/o/r/issues/1/comments')) return { status: 200, json: [comment({ body: commentBody })] };
        return { status: 201, json: {} };
      });
      const result = await run({ GITHUB_TOKEN: 'tok', GITHUB_REPOSITORY: 'o/r', PR_NUMBER: '1', GITHUB_API_URL: api }, cwd);
      const post = requests.find(r => r.method === 'POST');
      return { result, status: post ? JSON.parse(post.body) : null };
    }

    it('posts success for a signed PASS', async () => {
      const { result, status } = await runSigned(signedBody('PASS', HEAD));
      expect(result.code).toBe(0);
      expect(status).toMatchObject({ state: 'success', description: `Signed PASS for ${HEAD.slice(0, 7)} by rev` });
    });

    it('posts failure for an unsigned PASS', async () => {
      const { status } = await runSigned(body('PASS', HEAD));
      expect(status).toMatchObject({ state: 'failure', description: `No signed PASS verdict for head ${HEAD.slice(0, 7)}` });
    });

    it('posts success for an unsigned PASS on a Dependabot PR', async () => {
      const { status } = await runSigned(body('PASS', HEAD), 'dependabot[bot]');
      expect(status).toEqual({ state: 'success', context: SIGNED_STATUS_CONTEXT, description: `PASS for ${HEAD.slice(0, 7)} by rev`, target_url: expect.stringContaining('#issuecomment-') });
    });

    it('posts the signed context, not review-verdict', async () => {
      const { status } = await runSigned(signedBody('PASS', HEAD));
      expect(status.context).toBe(SIGNED_STATUS_CONTEXT);
      expect(SIGNED_STATUS_CONTEXT).toBe('review-verdict-signed');
    });

    it('posts a failure under the signed context and exits 1 when the key file is garbage', async () => {
      const { result, status } = await runSigned(signedBody('PASS', HEAD), 'FlorianRiquelme', 'garbage');
      expect(result.code).toBe(1);
      expect(status).toEqual({ state: 'failure', context: SIGNED_STATUS_CONTEXT, description: 'Review verdict key does not load', target_url: pull.html_url });
    });
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
    expect(parseVerdict(filled)).toEqual({ verdict: 'PASS', sha: HEAD, signature: null });
  });

  it('the Dependabot automation verdict comment parses once filled in', () => {
    const filled = block('.github/automation/dependabot-review.md').replaceAll('<head sha>', HEAD);
    expect(parseVerdict(filled)).toEqual({ verdict: 'PASS', sha: HEAD, signature: null });
  });
});

describe('the Dependabot automation prompt', () => {
  const prompt = readFileSync(`${root}/.github/automation/dependabot-review.md`, 'utf8');

  it('names exactly the status contexts the check posts', () => {
    const contexts = new Set([...prompt.matchAll(/`(review-verdict(?:-signed)?)`/g)].map(match => match[1]));
    expect([...contexts].sort()).toEqual([SIGNED_STATUS_CONTEXT, STATUS_CONTEXT].sort());
  });

  it('checks the signed context once the key exists on main, and probes that key file', () => {
    expect(prompt).toContain('`review-verdict-signed` once `.github/review-verdict-key.pub` exists on `main`');
    expect(prompt).toContain('contents/.github/review-verdict-key.pub?ref=main');
    expect(prompt).toContain('select(.context=="<required context>")');
  });
});
