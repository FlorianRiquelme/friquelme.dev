import { spawn } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runSmoke } from '../../scripts/smoke-production.mjs';
import { buildCsp } from '../../src/lib/security/csp';

const SITE = 'https://friquelme.dev';
const securityHeaders: Record<string, string> = {
  'strict-transport-security': 'max-age=63072000; includeSubDomains; preload',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  'content-security-policy': buildCsp({ posthog: 'eu' }),
};
const locs = [`${SITE}/`, `${SITE}/blog/`, `${SITE}/blog/post/`];
const urlset = (items: string[]) => `<urlset>${items.map(l => `<url><loc>${l}</loc></url>`).join('')}</urlset>`;
const page = (loc: string, body = '<h1>Title</h1>') => `<!doctype html><html><head><title>T</title><link rel="canonical" href="${loc}"></head><body>${body}</body></html>`;
const home = `<!doctype html><html><head><title>Home</title><link rel="canonical" href="${SITE}/"><link rel="stylesheet" href="/_astro/app.css"></head><body><h1>Hi</h1><section id="about"></section><section id="projects"></section><section id="contact"></section></body></html>`;

type Reply = { status?: number; type?: string; body?: string; headers?: Record<string, string | null> };
const baseFiles = (): Record<string, Reply> => ({
  '/sitemap-index.xml': { type: 'application/xml', body: `<sitemapindex><sitemap><loc>${SITE}/sitemap-0.xml</loc></sitemap></sitemapindex>` },
  '/sitemap-0.xml': { type: 'application/xml', body: urlset(locs) },
  '/': { type: 'text/html', body: home },
  '/blog/': { type: 'text/html', body: page(`${SITE}/blog/`, '<h1>Blog</h1><a href="/blog/post/">post</a>') },
  '/blog/post/': { type: 'text/html', body: page(`${SITE}/blog/post/`) },
  '/_astro/app.css': { type: 'text/css', body: 'body{}' },
  '/rss.xml': { type: 'application/xml', body: '<rss/>' },
  '/robots.txt': { type: 'text/plain', body: 'User-agent: *' },
  '/llms.txt': { type: 'text/plain', body: '# llms' },
});

let files = baseFiles();
let server: Server;
let baseUrl = '';
beforeAll(async () => {
  server = createServer((req, res) => {
    const reply = files[req.url ?? ''];
    if (!reply) { res.writeHead(404).end('nope'); return; }
    const isHtml = reply.type === 'text/html';
    const headers: Record<string, string | null> = { 'content-type': reply.type ?? 'text/plain', ...(isHtml ? securityHeaders : {}), ...reply.headers };
    for (const name of Object.keys(headers)) if (headers[name] === null) delete headers[name];
    res.writeHead(reply.status ?? 200, headers as Record<string, string>).end(reply.body ?? '');
  });
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(() => new Promise<void>(done => server.close(() => done())));

const smoke = (overrides: Partial<Parameters<typeof runSmoke>[0]> = {}) => runSmoke({ baseUrl, site: SITE, ...overrides });
const withFiles = (patch: Record<string, Reply | null>) => {
  files = baseFiles();
  for (const [path, reply] of Object.entries(patch)) { if (reply) files[path] = { ...files[path], ...reply }; else delete files[path]; }
};
describe('runSmoke contracts', () => {
  it('passes a healthy site and lists the sitemap routes', async () => {
    files = baseFiles();
    expect(await smoke()).toEqual({ ok: true, baseUrl, routes: locs, failures: [] });
  });

  it('fails a route that is not 200', async () => {
    withFiles({ '/blog/post/': { status: 404 } });
    const result = await smoke();
    expect(result.ok).toBe(false);
    expect(result.failures).toEqual([`${baseUrl}/blog/post/: expected status 200, got 404`]);
  });

  it('fails a route that is not served as html', async () => {
    withFiles({ '/blog/post/': { type: 'text/plain', headers: securityHeaders } });
    expect((await smoke()).failures).toEqual([`${baseUrl}/blog/post/: expected content-type text/html, got text/plain`]);
  });

  it('fails a route without an h1', async () => {
    withFiles({ '/blog/post/': { body: page(`${SITE}/blog/post/`, '') } });
    expect((await smoke()).failures).toEqual([`${baseUrl}/blog/post/: expected exactly 1 <h1>, got 0`]);
  });

  it('fails a route with two h1', async () => {
    withFiles({ '/blog/post/': { body: page(`${SITE}/blog/post/`, '<h1>a</h1><h1 class="x">b</h1>') } });
    expect((await smoke()).failures).toEqual([`${baseUrl}/blog/post/: expected exactly 1 <h1>, got 2`]);
  });

  it('fails a wrong canonical', async () => {
    withFiles({ '/blog/post/': { body: page(`${SITE}/blog/other/`) } });
    expect((await smoke()).failures).toEqual([`${baseUrl}/blog/post/: expected canonical ${SITE}/blog/post/, got ${SITE}/blog/other/`]);
  });

  it('fails a loc on a foreign origin', async () => {
    withFiles({ '/sitemap-0.xml': { body: urlset([...locs, 'https://evil.example/x/']) } });
    const result = await smoke();
    expect(result.failures).toEqual(['https://evil.example/x/: expected origin https://friquelme.dev, got https://evil.example']);
    expect(result.routes).toEqual(locs);
  });

  it('fails an empty sitemap', async () => {
    withFiles({ '/sitemap-0.xml': { body: '<urlset></urlset>' } });
    expect((await smoke()).failures).toEqual([`${SITE}/sitemap-0.xml: expected at least 1 loc, got 0`, 'no routes in sitemap']);
  });

  it('fails a stylesheet that is not 200', async () => {
    withFiles({ '/_astro/app.css': null });
    expect((await smoke()).failures).toEqual([`${baseUrl}/_astro/app.css: expected status 200, got 404`]);
  });

  it('fails a missing CSP', async () => {
    withFiles({ '/blog/post/': { headers: { 'content-security-policy': null } } });
    expect((await smoke()).failures).toEqual([`${baseUrl}/blog/post/: expected content-security-policy ${securityHeaders['content-security-policy']}, got missing`]);
  });

  it('fails an HSTS value that differs', async () => {
    withFiles({ '/': { headers: { 'strict-transport-security': 'max-age=63072000; includeSubDomains; preload; extra' } } });
    expect((await smoke()).failures).toEqual([`${baseUrl}/: expected strict-transport-security max-age=63072000; includeSubDomains; preload, got max-age=63072000; includeSubDomains; preload; extra`]);
  });

  it('ignores headers when checkHeaders is false', async () => {
    withFiles({ '/blog/post/': { headers: { 'content-security-policy': null, 'x-frame-options': null } } });
    expect(await smoke({ checkHeaders: false })).toEqual({ ok: true, baseUrl, routes: locs, failures: [] });
  });

  it('fails when /blog/ misses a post link', async () => {
    withFiles({ '/blog/': { body: page(`${SITE}/blog/`, '<h1>Blog</h1>') } });
    expect((await smoke()).failures).toEqual([`${baseUrl}/blog/: expected link to /blog/post/, got none`]);
  });

  it('fails when rss.xml is missing', async () => {
    withFiles({ '/rss.xml': null });
    expect((await smoke()).failures).toEqual([`${baseUrl}/rss.xml: expected status 200, got 404`]);
  });
});

describe('runSmoke identity', () => {
  const dist = mkdtempSync(join(tmpdir(), 'smoke-dist-'));
  afterAll(() => rmSync(dist, { recursive: true, force: true }));

  it('passes when production serves the build', async () => {
    files = baseFiles();
    writeFileSync(join(dist, 'index.html'), home);
    expect(await smoke({ distDir: dist, identityTimeoutMs: 1000, pollMs: 10 })).toEqual({ ok: true, baseUrl, routes: locs, failures: [] });
  });

  it('fails after the timeout and runs no contracts when production serves another build', async () => {
    files = baseFiles();
    writeFileSync(join(dist, 'index.html'), `${home}<!-- other build -->`);
    const requests: string[] = [];
    const fetchImpl: typeof fetch = (input, init) => { requests.push(String(input)); return fetch(input, init); };
    const result = await smoke({ distDir: dist, identityTimeoutMs: 50, pollMs: 10, fetchImpl });
    expect(result).toEqual({ ok: false, baseUrl, routes: [], failures: ['production / does not serve this build within 0s'] });
    expect(new Set(requests)).toEqual(new Set([`${baseUrl}/`]));
  });
});

describe('smoke-production CLI', () => {
  const dir = mkdtempSync(join(tmpdir(), 'smoke-cli-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  const run = (args: string[]) => new Promise<{ status: number | null; stderr: string }>(done => {
    const child = spawn(process.execPath, ['scripts/smoke-production.mjs', ...args]);
    let stderr = '';
    child.stderr.on('data', d => { stderr += d; });
    child.on('close', status => done({ status, stderr }));
  });

  it('exits 0 and writes the report on success', async () => {
    files = baseFiles();
    const report = join(dir, 'ok', 'summary.json');
    const result = await run(['--base-url', baseUrl, '--report', report]);
    expect(result.status).toBe(0);
    const json = JSON.parse(readFileSync(report, 'utf8'));
    expect(json).toMatchObject({ ok: true, baseUrl, distDir: null, routes: locs, failures: [] });
    expect(typeof json.checkedAt).toBe('string');
  });

  it('exits 1 and reports the failure', async () => {
    withFiles({ '/rss.xml': null });
    const report = join(dir, 'bad.json');
    const result = await run(['--base-url', baseUrl, '--report', report]);
    expect(result.status).toBe(1);
    expect(JSON.parse(readFileSync(report, 'utf8')).failures).toEqual([`${baseUrl}/rss.xml: expected status 200, got 404`]);
    expect(result.stderr).toContain(`${baseUrl}/rss.xml: expected status 200, got 404`);
  });

  it('exits 2 without --base-url', async () => {
    expect((await run([])).status).toBe(2);
  });
});
