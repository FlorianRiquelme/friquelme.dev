// Spike measurement for #80: serves dist/ with the production CSP header and records, per page,
// CSP violations, console errors and whether PostHog issued a capture request.
// Capture requests are answered locally so no events reach the real PostHog project.
// Usage: node scripts/measure-csp.mjs (after pnpm build)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { previewHost } from './preview.mjs';
import { buildCsp } from '../src/lib/security/csp.ts';

const csp = buildCsp({ posthog: 'eu' });
// Production is https-only; locally over http this directive would upgrade every subresource and fail.
const servedCsp = csp.replace('; upgrade-insecure-requests', '');
const dist = resolve('dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain', '.webp': 'image/webp', '.avif': 'image/avif' };
const server = createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path.endsWith('/')) path += 'index.html';
  try {
    const body = await readFile(join(dist, path));
    res.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream', 'content-security-policy': servedCsp });
    res.end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, previewHost, r));
const origin = `http://${previewHost}:${server.address().port}`;

// posthog-js drops events from bots: navigator.webdriver and the HeadlessChrome UA both count.
const browser = await chromium.launch({ args: ['--disable-blink-features=AutomationControlled'] });
const UA = (await browser.newPage().then(async p => { const ua = await p.evaluate(() => navigator.userAgent); await p.close(); return ua; })).replace('HeadlessChrome', 'Chrome');
const results = [];
try {
  for (const path of ['/', '/blog/', '/blog/brownfield-ai/']) {
    const page = await browser.newPage({ userAgent: UA });
    const violations = [], errors = [], captures = [], posthogScripts = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', e => errors.push(e.message));
    await page.exposeFunction('__cspViolation', v => violations.push(v));
    await page.addInitScript(() => document.addEventListener('securitypolicyviolation', e =>
      window.__cspViolation(`${e.effectiveDirective} blocked ${e.blockedURI || 'inline'}`)));
    page.on('response', r => { if (r.url().includes('posthog.com') && r.request().resourceType() === 'script') posthogScripts.push(`${r.status()} ${r.url()}`); });
    await page.route(/eu\.i\.posthog\.com\/(e|i\/v0\/e|batch|flags|decide)\//, route => {
      captures.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`);
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await page.goto(origin + path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    const posthogLoaded = await page.evaluate(() => Boolean(window.posthog?.__loaded));
    results.push({ path, violations, errors, posthogLoaded, posthogScripts, captures });
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
console.log(JSON.stringify({ csp, servedCsp, results }, null, 2));
process.exitCode = results.every(r => !r.violations.length && !r.errors.length && r.posthogLoaded && r.captures.some(c => c.startsWith('POST'))) ? 0 : 1;
