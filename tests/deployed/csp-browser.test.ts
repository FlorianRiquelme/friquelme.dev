import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deployedBaseUrl, requireReachable, routes } from './target';

const base = deployedBaseUrl();

declare global {
  interface Window {
    __cspViolations: string[];
    posthog?: { __loaded?: boolean };
  }
}

let browser: Browser;
const visited: string[] = [];

/** Opens a page that records every securitypolicyviolation event and uncaught page error. */
async function observedPage() {
  const page = await browser.newPage();
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', event => {
      window.__cspViolations.push(`${event.violatedDirective} blocked ${event.blockedURI || 'inline'}`);
    });
  });
  return { page, pageErrors };
}

const violations = (page: Page) => page.evaluate(() => window.__cspViolations);

describe(`real CSP in Chromium on ${base.origin}`, () => {
  beforeAll(async () => {
    await requireReachable(base);
    browser = await chromium.launch();
  });
  afterAll(() => browser?.close());

  // Without this the zero-violation assertions below could pass because the collector is broken.
  it('the collector sees a violation when a disallowed script is injected', async () => {
    const { page } = await observedPage();
    await page.goto(base.href);
    await page.evaluate(() => {
      const script = document.createElement('script');
      script.src = 'https://example.com/blocked.js';
      document.head.append(script);
    });
    await expect.poll(() => violations(page)).toEqual([expect.stringContaining('script-src')]);
    await page.close();
  });

  it.each(routes)('%s loads without CSP violations or page errors', async route => {
    const { page, pageErrors } = await observedPage();
    await page.goto(new URL(route, base).href, { waitUntil: 'load' });
    // The analytics snippet is not stubbed: the real library must load and initialise under the CSP.
    await page.waitForFunction(() => window.posthog?.__loaded === true, undefined, { timeout: 20_000 });
    await page.waitForLoadState('networkidle');
    expect(await violations(page)).toEqual([]);
    expect(pageErrors).toEqual([]);
    visited.push(route);
    await page.close();
  });

  it('visited every route', () => {
    expect(visited.length).toBeGreaterThan(0);
    expect([...visited].sort()).toEqual([...routes].sort());
  });
});
