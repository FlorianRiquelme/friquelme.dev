import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect, settleRendering } from './fixtures';
import { articles, routes, siteOrigin } from '../support/site';

async function expectTerminalContent(page: Page) {
  const copy = {
    'hero-terminal': [
      '$ whoami',
      'florian riquelme: senior software engineer',
      '$ cat intro.txt',
      '9+ years shipping saas platforms, e-commerce, and web apps.',
      'i ship llm features into existing codebases without breaking trust.',
      'full-stack across the board, react frontends to aws infrastructure.',
      'currently building at digital-masters, a full-service digital agency.',
      '$ echo $current_stack',
      'php · react · typescript · go',
      '$ echo $experience',
      '9+ years of experience',
    ],
    'contact-terminal': [
      '$ cat contact_info.json',
      '{',
      '"email": "flo@friquelme.dev",',
      '"github": "github.com/FlorianRiquelme",',
      '"linkedin": "linkedin.com/in/florian-riquelme-b97756143",',
      '"location": "hamburg, germany"',
      '}',
    ],
  };
  for (const [id, text] of Object.entries(copy)) {
    const lines = page.locator(`#${id} p[data-type]`);
    await expect(lines).toHaveText(text);
    for (const line of await lines.all()) await expect(line).toBeVisible();
  }
}

for (const route of routes) {
  test(`${route} renders, loads its images and fits the viewport`, async ({ page }) => {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${siteOrigin}${route}`);
    for (const image of await page.locator('img').all()) {
      await image.scrollIntoViewIfNeeded();
      await expect.poll(() => image.evaluate(element => (element as HTMLImageElement).complete && (element as HTMLImageElement).naturalWidth > 0)).toBe(true);
    }
    const width = await page.evaluate(() => ({ content: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth), viewport: innerWidth }));
    expect(width.content, `${route} horizontal overflow`).toBeLessThanOrEqual(width.viewport);
  });

  test(`${route} passes automated WCAG AA checks`, async ({ page }) => {
    await page.goto(route);
    await settleRendering(page);
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    expect(result.violations.map(violation => ({ id: violation.id, description: violation.description, nodes: violation.nodes.map(node => ({ target: node.target, failure: node.failureSummary })) }))).toEqual([]);
  });
}

test('homepage navigation, project destinations and contact work', async ({ page }) => {
  await page.goto('/');
  const mobile = (page.viewportSize()?.width ?? 0) < 768;
  for (const section of ['about', 'projects', 'contact']) {
    if (mobile) await page.getByRole('button', { name: 'Toggle menu' }).click();
    const navigation = mobile ? page.getByRole('dialog', { name: 'Site navigation' }) : page.locator('header nav');
    const link = navigation.locator(`a[href="#${section}"]`);
    await expect(link).toContainText(section);
    await link.click();
    await expect(page).toHaveURL(new RegExp(`#${section}$`));
    await expect(page.locator(`#${section}`)).toBeInViewport();
    if (mobile) await expect(page.getByRole('dialog')).toBeHidden();
  }
  await expect(page.getByRole('link', { name: 'send_message' })).toHaveAttribute('href', 'mailto:flo@friquelme.dev');
  await expect(page.locator('#contact-terminal')).toContainText('flo@friquelme.dev');
  await page.locator('#projects').scrollIntoViewIfNeeded();
  const projectLinks = page.locator('#projects a');
  expect((await projectLinks.evaluateAll(links => links.map(link => link.getAttribute('href')))).sort()).toEqual([
    '/blog/designing-for-the-operator/',
    'https://github.com/FlorianRiquelme/claudefuel',
    'https://github.com/FlorianRiquelme/ddev-claude',
    'https://github.com/FlorianRiquelme/nachtschicht',
  ].sort());
});

test('homepage to blog to the exact pinned essay and back', async ({ page, baseURL }) => {
  await page.goto('/');
  const mobile = (page.viewportSize()?.width ?? 0) < 768;
  if (mobile) await page.getByRole('button', { name: 'Toggle menu' }).click();
  const navigation = mobile ? page.getByRole('dialog') : page.locator('header nav');
  await navigation.getByRole('link', { name: 'blog', exact: true }).click();
  await expect(page).toHaveURL(new URL('/blog/', baseURL).href);
  const pinned = page.getByRole('link', { name: 'open pinned essay: designing for the operator', exact: true });
  await expect(pinned).toHaveAttribute('href', '/blog/designing-for-the-operator/');
  const title = pinned.getByRole('heading');
  await title.scrollIntoViewIfNeeded();
  expect(await title.evaluate(element => {
    const rect = element.getBoundingClientRect();
    return [0.2, 0.5, 0.8].every(fraction => element.contains(document.elementFromPoint(rect.left + rect.width * fraction, rect.top + rect.height / 2)));
  }), 'pinned heading is not covered').toBe(true);
  await pinned.click();
  await expect(page).toHaveURL(new URL('/blog/designing-for-the-operator/', baseURL).href);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('designing for the operator');
  await page.getByRole('link', { name: 'cd ../blog' }).click();
  await expect(page).toHaveURL(new URL('/blog/', baseURL).href);
});

for (const route of articles) {
  test(`${route} table of contents and article links work`, async ({ page, baseURL }) => {
    await page.goto(route);
    const toc = page.locator('#toc-list a');
    expect(await toc.count()).toBeGreaterThan(0);
    const first = toc.first();
    const href = (await first.getAttribute('href'))!;
    await first.click();
    await expect(page).toHaveURL(new URL(`${route}${href}`, baseURL).href);
    await expect(page.locator(href)).toBeInViewport();
    const related = page.locator('aside a[href^="/blog/"]');
    expect(await related.count()).toBeGreaterThan(0);
    const relatedHref = (await related.first().getAttribute('href'))!;
    expect(relatedHref).not.toBe(route);
    await related.first().click();
    await expect(page).toHaveURL(new URL(relatedHref, baseURL).href);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.goto(route);
    const adjacent = page.locator('article a').filter({ hasText: /previous post|next post/ });
    expect(await adjacent.count()).toBeGreaterThan(0);
    const adjacentHref = (await adjacent.first().getAttribute('href'))!;
    await adjacent.first().click();
    await expect(page).toHaveURL(new URL(adjacentHref, baseURL).href);
  });
}

test('navigation works with the keyboard and restores focus', async ({ page }) => {
  await page.goto('/');
  if ((page.viewportSize()?.width ?? 0) >= 768) {
    const blog = page.locator('header nav').getByRole('link', { name: 'blog', exact: true });
    await blog.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/blog\/$/);
    return;
  }
  const trigger = page.getByRole('button', { name: 'Toggle menu' });
  await trigger.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  const links = dialog.locator('a, button');
  await links.first().focus();
  await page.keyboard.press('Shift+Tab');
  await expect(links.last()).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(links.first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
  await trigger.click();
  await dialog.getByRole('button', { name: 'Close menu' }).click();
  await expect(dialog).toBeHidden();
});

test('ordinary-motion terminal content finishes rendering', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await expect(page.locator('#hero-terminal .terminal-hidden')).toHaveCount(0, { timeout: 15_000 });
  await page.locator('#contact-terminal-wrapper').evaluate(element => element.scrollIntoView({ behavior: 'instant', block: 'center' }));
  await expect(page.locator('#contact-terminal .terminal-hidden')).toHaveCount(0, { timeout: 10_000 });
  await expectTerminalContent(page);
});

test('reduced-motion terminal content is available immediately', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#hero-terminal .terminal-hidden')).toHaveCount(0);
  await expect(page.locator('#contact-terminal .terminal-hidden')).toHaveCount(0);
  await expectTerminalContent(page);
  await expect(page.locator('#hero-bottom')).toHaveCSS('opacity', '1');
  for (const animated of await page.locator('[data-animate]').all()) {
    await expect(animated).toHaveCSS('animation-name', 'none');
    await expect(animated).toHaveCSS('opacity', '1');
  }
});
