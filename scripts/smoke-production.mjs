import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildCsp } from '../src/lib/security/csp.ts';

const expectedHeaders = {
  'strict-transport-security': 'max-age=63072000; includeSubDomains; preload',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  'content-security-policy': buildCsp({ posthog: 'eu' }),
};

const sleep = ms => new Promise(done => setTimeout(done, ms));
const locs = xml => [...xml.matchAll(/<loc>\s*([^<]*?)\s*<\/loc>/g)].map(match => match[1]);

/**
 * @param {{ baseUrl: string, site?: string, distDir?: string | null, checkHeaders?: boolean,
 *   identityTimeoutMs?: number, pollMs?: number, fetchImpl?: typeof fetch }} options
 * @returns {Promise<{ ok: boolean, baseUrl: string, routes: string[], failures: string[] }>}
 */
export async function runSmoke({
  baseUrl, site = 'https://friquelme.dev', distDir = null, checkHeaders = true,
  identityTimeoutMs = 300_000, pollMs = 10_000, fetchImpl = fetch,
} = {}) {
  const base = baseUrl.replace(/\/$/, '');
  const failures = [];
  const result = routes => ({ ok: failures.length === 0, baseUrl, routes, failures });
  const get = url => fetchImpl(url, { redirect: 'manual' });

  if (distDir) {
    const expected = readFileSync(resolve(distDir, 'index.html'));
    const deadline = Date.now() + identityTimeoutMs;
    for (;;) {
      try {
        const response = await get(`${base}/`);
        if (Buffer.from(await response.arrayBuffer()).equals(expected)) break;
      } catch { /* origin not reachable yet; keep waiting */ }
      if (Date.now() + pollMs > deadline) {
        failures.push(`production / does not serve this build within ${Math.round(identityTimeoutMs / 1000)}s`);
        return result([]);
      }
      await sleep(pollMs);
    }
  }

  const text = async (url, label = url) => {
    try {
      const response = await get(url);
      if (response.status !== 200) { failures.push(`${label}: expected status 200, got ${response.status}`); return null; }
      return { response, body: await response.text() };
    } catch (error) { failures.push(`${label}: request failed (${error.message})`); return null; }
  };

  const routes = [];
  const index = await text(`${base}/sitemap-index.xml`);
  const sitemaps = index ? locs(index.body) : [];
  if (index && sitemaps.length === 0) failures.push(`${base}/sitemap-index.xml: expected at least 1 sitemap, got 0`);
  for (const sitemap of sitemaps) {
    const page = await text(`${base}${new URL(sitemap, site).pathname}`, sitemap);
    if (!page) continue;
    const found = locs(page.body);
    if (found.length === 0) failures.push(`${sitemap}: expected at least 1 loc, got 0`);
    for (const loc of found) {
      const origin = new URL(loc).origin;
      if (origin !== new URL(site).origin) failures.push(`${loc}: expected origin ${new URL(site).origin}, got ${origin}`);
      else routes.push(loc);
    }
  }
  if (routes.length === 0) { failures.push('no routes in sitemap'); return result(routes); }

  const pages = new Map();
  for (const loc of routes) {
    const url = `${base}${new URL(loc).pathname}`;
    const page = await text(url);
    if (!page) continue;
    const { response, body } = page;
    pages.set(loc, body);
    const type = response.headers.get('content-type') ?? '';
    if (!type.startsWith('text/html')) failures.push(`${url}: expected content-type text/html, got ${type || 'none'}`);
    const h1 = (body.match(/<h1[\s>]/g) ?? []).length;
    if (h1 !== 1) failures.push(`${url}: expected exactly 1 <h1>, got ${h1}`);
    const canonicals = [...body.matchAll(/<link\b[^>]*>/g)].map(match => match[0])
      .filter(tag => /\brel=["']canonical["']/.test(tag))
      .map(tag => tag.match(/\bhref=["']([^"']*)["']/)?.[1] ?? '');
    if (canonicals.length !== 1) failures.push(`${url}: expected exactly 1 canonical link, got ${canonicals.length}`);
    else if (canonicals[0] !== loc) failures.push(`${url}: expected canonical ${loc}, got ${canonicals[0]}`);
    if (checkHeaders) {
      for (const [name, expected] of Object.entries(expectedHeaders)) {
        const actual = response.headers.get(name);
        if (actual !== expected) failures.push(`${url}: expected ${name} ${expected}, got ${actual ?? 'missing'}`);
      }
    }
  }

  const home = pages.get(`${new URL(site).origin}/`);
  if (home !== undefined) {
    for (const id of ['about', 'projects', 'contact']) {
      if (!new RegExp(`\\bid=["']${id}["']`).test(home)) failures.push(`${base}/: expected element with id="${id}", got none`);
    }
    if (!/<title[^>]*>\s*[^<\s][^<]*<\/title>/.test(home)) failures.push(`${base}/: expected non-empty <title>, got none`);
    const origins = new Set([new URL(site).origin, new URL(base).origin]);
    const assets = [...home.matchAll(/<link\b[^>]*>/g)].map(match => match[0])
      .filter(tag => /\brel=["']stylesheet["']/.test(tag))
      .map(tag => tag.match(/\bhref=["']([^"']*)["']/)?.[1])
      .concat([...home.matchAll(/<script\b[^>]*\bsrc=["']([^"']*)["']/g)].map(match => match[1]));
    for (const ref of new Set(assets.filter(Boolean))) {
      const resolved = new URL(ref, `${base}/`);
      if (!origins.has(resolved.origin)) continue;
      await text(`${base}${resolved.pathname}${resolved.search}`);
    }
  }

  const blogLoc = routes.find(loc => new URL(loc).pathname === '/blog/');
  const blog = blogLoc && pages.get(blogLoc);
  if (blog !== undefined) {
    for (const loc of routes.filter(loc => /^\/blog\/[^/]+\/$/.test(new URL(loc).pathname))) {
      const path = new URL(loc).pathname;
      if (!blog.includes(`href="${path}"`) && !blog.includes(`href="${loc}"`)) failures.push(`${base}/blog/: expected link to ${path}, got none`);
    }
  }

  for (const path of ['/rss.xml', '/robots.txt', '/llms.txt']) await text(`${base}${path}`);
  return result(routes);
}

function parseArgs(argv) {
  const options = {};
  const names = { '--base-url': 'baseUrl', '--site': 'site', '--dist': 'dist', '--report': 'report', '--identity-timeout-ms': 'identityTimeoutMs' };
  for (let i = 0; i < argv.length; i += 2) {
    const key = names[argv[i]];
    if (!key || argv[i + 1] === undefined) return null;
    options[key] = argv[i + 1];
  }
  return options;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const options = parseArgs(process.argv.slice(2));
  const timeout = options?.identityTimeoutMs === undefined ? undefined : Number(options.identityTimeoutMs);
  if (!options?.baseUrl || (timeout !== undefined && !(timeout >= 0))) {
    console.error('Usage: smoke-production.mjs --base-url <url> [--site <origin>] [--dist <dir>] [--report <file>] [--identity-timeout-ms N]');
    process.exit(2);
  }
  const result = await runSmoke({
    baseUrl: options.baseUrl, site: options.site, distDir: options.dist ?? null, identityTimeoutMs: timeout,
  });
  const report = resolve(options.report ?? 'reports/smoke/summary.json');
  mkdirSync(dirname(report), { recursive: true });
  writeFileSync(report, `${JSON.stringify({
    ok: result.ok, baseUrl: result.baseUrl, distDir: options.dist ?? null, checkedAt: new Date().toISOString(),
    routes: result.routes, failures: result.failures,
  }, null, 2)}\n`);
  for (const failure of result.failures) console.error(failure);
  console.log(result.ok ? `smoke passed: ${result.routes.length} routes at ${result.baseUrl}` : `smoke FAILED: ${result.failures.length} failure(s) at ${result.baseUrl}`);
  process.exit(result.ok ? 0 : 1);
}
