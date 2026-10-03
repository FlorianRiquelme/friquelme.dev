import { test } from '@e2e-dev/web';
import { expect } from 'e2e';

test('homepage to blog to the pinned operator essay', async ({ app, agent, browser, screen }) => {
  await app.open('/');
  await expect(browser.locator('header nav a[href="/blog/"]')).toBeVisible();
  await agent.act('Click the blog link in the homepage header navigation. Do not use direct URL navigation.');
  await expect(browser).toHaveURL('/blog/');
  await expect(screen.getByRole('heading', { name: 'shipping AI into real codebases.', exact: true })).toBeVisible();

  // Assert the link itself before acting: an agent can otherwise recover a wrong destination.
  await expect(screen.getByRole('link', { name: 'open pinned essay: designing for the operator', exact: true }))
    .toHaveAttribute('href', '/blog/designing-for-the-operator/', { ignoreCase: false });
  await agent.act('Click the pinned essay link titled designing for the operator on this blog page. Do not use direct URL navigation or recover by choosing a different link.');
  await expect(browser).toHaveURL('/blog/designing-for-the-operator/');
  await expect(screen.getByRole('heading', { name: 'designing for the operator', exact: true })).toBeVisible();
  await expect(screen.getByRole('heading', { name: 'the difference between a ui and a console', exact: true })).toBeVisible();
  await app.screenshot('operator-article');
});
