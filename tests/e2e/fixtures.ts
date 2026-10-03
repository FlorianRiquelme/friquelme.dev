import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test as base, type Browser } from '@e2e-dev/web';
import { expect } from 'e2e';
import { activeContext } from './targets';

const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');

export interface Motion {
  /** Sets the `prefers-reduced-motion` media feature of the attempt's page. */
  set(reducedMotion: 'reduce' | 'no-preference'): Promise<void>;
}

/**
 * Every test starts on a blank page with reduced motion, fails on uncaught page
 * errors or 4xx/5xx responses from the site, and never contacts analytics.
 */
export const test = base.extend<{ motion: Motion }>({
  motion: async ({ app, browser }, use) => {
    const context = activeContext();
    const errors: string[] = [];
    const failedResponses: string[] = [];
    const origin = new URL(app.baseUrl!).origin;
    context.on('weberror', error => errors.push(error.error().message));
    context.on('response', response => {
      if (new URL(response.url()).origin === origin && response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
    });
    // Keep local verification private and independent of analytics availability.
    await browser.route(/^https:\/\/eu(-assets)?\.i\.posthog\.com\//, route => route.fulfill({ status: 200, headers: { 'content-type': 'text/javascript' }, body: '' }));
    // Media emulation needs a page; the first app.open() reuses this one.
    await browser.goto('about:blank');
    const motion: Motion = { set: reducedMotion => context.pages()[0].emulateMedia({ reducedMotion }) };
    await motion.set('reduce');
    await use(motion);
    expect(errors).toEqual([]);
    expect(failedResponses).toEqual([]);
  },
});
export { expect };

export async function settleRendering(browser: Browser) {
  await browser.evaluate(async () => {
    await document.fonts.ready;
    const animations = document.getAnimations().filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity);
    await Promise.all(animations.map(animation => animation.finished.catch(() => undefined)));
    return null;
  });
}

export interface AxeViolation {
  id: string;
  description: string;
  nodes: { target: string[]; failure: string }[];
}

/** Runs axe-core in the page; the site serves no CSP locally, so the bundled source can be evaluated there. */
export function axeViolations(browser: Browser, tags: string[]) {
  return browser.evaluate(async ({ source, tags }: { source: string; tags: string[] }) => {
    const page = window as unknown as { axe?: { run: (context: Document, options: object) => Promise<{ violations: { id: string; description: string; nodes: { target: unknown[]; failureSummary?: string }[] }[] }> } };
    if (!page.axe) (0, eval)(source);
    const result = await page.axe!.run(document, { runOnly: { type: 'tag', values: tags } });
    return result.violations.map(violation => ({
      id: violation.id,
      description: violation.description,
      nodes: violation.nodes.map(node => ({ target: node.target.map(String), failure: node.failureSummary ?? '' })),
    }));
  }, { source: axeSource, tags });
}

/** True while any part of the element intersects the viewport, as Playwright's toBeInViewport. */
export function inViewport(browser: Browser, selector: string) {
  return browser.evaluate((selector: string) => {
    const element = selector.startsWith('#') ? document.getElementById(decodeURIComponent(selector.slice(1))) : document.querySelector(selector);
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.top < innerHeight && rect.left < innerWidth;
  }, selector);
}

export function viewportWidth(browser: Browser) {
  return browser.evaluate(() => innerWidth);
}
