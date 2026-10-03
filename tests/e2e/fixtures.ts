import { test as base, expect, type Page } from '@playwright/test';

export const test = base.extend<{ pageHealth: void }>({
  pageHealth: [async ({ page, baseURL }, use) => {
    const errors: string[] = [];
    const failedResponses: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (response.url().startsWith(baseURL!) && response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
    });
    // Keep local verification private and independent of analytics availability.
    await page.route('https://eu.i.posthog.com/**', route => route.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
    await page.route('https://eu-assets.i.posthog.com/**', route => route.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
    await use();
    expect(errors, 'uncaught browser errors').toEqual([]);
    expect(failedResponses, 'failed local page/assets').toEqual([]);
  }, { auto: true }],
});
export { expect };

export async function settleRendering(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    const animations = document.getAnimations().filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity);
    await Promise.all(animations.map(animation => animation.finished.catch(() => undefined)));
  });
}
