import { expect, test } from '@playwright/test';

const pinnedEssayLabel = 'open pinned essay: designing for the operator';

test('desktop: homepage navigation opens the pinned essay', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');

  await page.getByRole('navigation').getByRole('link', { name: 'blog', exact: true }).click();
  await expect(page).toHaveURL(new URL('/blog/', baseURL).href);

  await page.getByRole('link', { name: pinnedEssayLabel, exact: true }).click();
  await expect(page).toHaveURL(new URL('/blog/designing-for-the-operator/', baseURL).href);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('designing for the operator');
  const firstSectionHeading = await page.locator('article h2').first().evaluate((heading) => heading.firstChild?.textContent?.trim());
  expect(firstSectionHeading).toBe('the difference between a ui and a console');
});

test('mobile: the pinned essay title fits and remains reachable at 390×844', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await page.getByRole('button', { name: 'Toggle menu' }).click();
  await page.getByRole('dialog', { name: 'Site navigation' }).getByRole('link', { name: 'blog', exact: true }).click();
  await expect(page).toHaveURL(/\/blog\/$/);

  const pinnedEssay = page.getByRole('link', { name: pinnedEssayLabel, exact: true });
  const title = pinnedEssay.getByText('designing for the operator', { exact: true });
  await expect(title).toBeVisible();

  const layout = await page.evaluate(() => ({
    documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    viewportWidth: window.innerWidth,
  }));
  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);

  const points = await title.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return [0.3, 0.7].map((fraction) => ({ x: rect.left + rect.width * fraction, y: rect.top + rect.height / 2 }));
  });
  for (const point of points) {
    const reachesPinnedTitle = await page.evaluate(({ x, y }) => {
      const target = document.elementFromPoint(x, y);
      return Boolean(target?.closest('a[aria-label="open pinned essay: designing for the operator"]'));
    }, point);
    expect(reachesPinnedTitle, `title point (${Math.round(point.x)}, ${Math.round(point.y)}) should hit the pinned essay`).toBe(true);
  }
});
