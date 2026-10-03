import { test } from '@e2e-dev/web';
import { expect } from 'e2e';

test('mobile pinned essay title is readable and unobscured', async ({ app, agent, browser, screen }) => {
  await browser.setViewport({ width: 390, height: 844 });
  await app.open('/blog/');
  await expect(browser).toHaveURL('/blog/');
  await expect(screen.getByRole('heading', { name: 'designing for the operator', exact: true })).toBeVisible();
  await app.screenshot('mobile-pinned-essay');
  // DOM visibility alone cannot establish that pixels are readable or uncovered.
  await agent.assert('At the current 390 by 844 viewport, the full pinned essay heading "designing for the operator" is readable. No overlay covers any part of its letters, its text is not clipped horizontally, and no horizontal scrolling is needed to read it.', { vision: true });
});
