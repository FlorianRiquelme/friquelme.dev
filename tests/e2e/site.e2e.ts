import type { Browser } from '@e2e-dev/web';
import { test, expect, settleRendering, axeViolations, inViewport, viewportWidth } from './fixtures';
import { articles, routes, siteOrigin } from '../support/site';

async function expectTerminalContent(browser: Browser) {
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
    const lines = browser.locator(`#${id} p[data-type]`);
    await expect(lines).toHaveText(text);
    for (const line of await lines.all()) await expect(line).toBeVisible();
  }
}

for (const route of routes) {
  test(`${route} renders, loads its images and fits the viewport`, async ({ app, browser, screen }) => {
    const response = browser.waitForResponse(new URL(route, app.baseUrl).href);
    await app.open(route);
    expect((await response).status).toBe(200);
    const heading = screen.getByRole('heading', { level: 1 });
    await expect(heading).toHaveCount(1);
    await expect(heading).toBeVisible();
    expect(await heading.textContent()).not.toBe('');
    await expect(browser.locator('link[rel="canonical"]')).toHaveAttribute('href', `${siteOrigin}${route}`);
    const images = await browser.evaluate(() => document.images.length);
    for (let index = 0; index < images; index++) {
      await expect.poll(() => browser.evaluate((index: number) => {
        const image = document.images[index];
        image.scrollIntoView({ block: 'nearest' });
        return image.complete && image.naturalWidth > 0;
      }, index)).toBe(true);
    }
    const width = await browser.evaluate(() => ({ content: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth), viewport: innerWidth }));
    expect(width.content, `${route} horizontal overflow`).toBeLessThanOrEqual(width.viewport);
  });

  test(`${route} passes automated WCAG AA checks`, async ({ app, browser }) => {
    await app.open(route);
    await settleRendering(browser);
    expect(await axeViolations(browser, ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])).toEqual([]);
  });
}

test('homepage navigation, project destinations and contact work', async ({ app, browser, screen }) => {
  await app.open('/');
  const mobile = await viewportWidth(browser) < 768;
  for (const section of ['about', 'projects', 'contact']) {
    if (mobile) await screen.getByRole('button', 'Toggle menu').tap();
    const link = browser.locator(`${mobile ? '#mobile-menu' : 'header nav'} a[href="#${section}"]`);
    await expect(link).toContainText(section);
    await link.tap();
    await expect(browser).toHaveURL(new RegExp(`#${section}$`));
    await expect.poll(() => inViewport(browser, `#${section}`)).toBe(true);
    if (mobile) await expect(browser.locator('#mobile-menu')).toBeHidden();
  }
  await expect(screen.getByRole('link', 'send_message')).toHaveAttribute('href', 'mailto:flo@friquelme.dev');
  await expect(browser.locator('#contact-terminal')).toContainText('flo@friquelme.dev');
  await browser.locator('#projects').scrollIntoView();
  expect((await browser.evaluate(() => [...document.querySelectorAll('#projects a')].map(link => link.getAttribute('href') ?? ''))).sort()).toEqual([
    '/blog/designing-for-the-operator/',
    'https://github.com/FlorianRiquelme/claudefuel',
    'https://github.com/FlorianRiquelme/ddev-claude',
    'https://github.com/FlorianRiquelme/nachtschicht',
  ].sort());
});

test('homepage to blog to the exact pinned essay and back', async ({ app, browser, screen }) => {
  await app.open('/');
  const mobile = await viewportWidth(browser) < 768;
  if (mobile) await screen.getByRole('button', 'Toggle menu').tap();
  await browser.locator(`${mobile ? '#mobile-menu' : 'header nav'} a[href="/blog/"]`).tap();
  await expect(browser).toHaveURL('/blog/');
  const pinned = screen.getByRole('link', 'open pinned essay: designing for the operator');
  await expect(pinned).toHaveAttribute('href', '/blog/designing-for-the-operator/');
  await pinned.getByRole('heading').scrollIntoView();
  expect(await browser.evaluate(() => {
    const element = document.querySelector('a[aria-label="open pinned essay: designing for the operator"] :is(h1, h2, h3, h4, h5, h6)')!;
    const rect = element.getBoundingClientRect();
    return [0.2, 0.5, 0.8].every(fraction => element.contains(document.elementFromPoint(rect.left + rect.width * fraction, rect.top + rect.height / 2)));
  }), 'pinned heading is not covered').toBe(true);
  await pinned.tap();
  await expect(browser).toHaveURL('/blog/designing-for-the-operator/');
  await expect(screen.getByRole('heading', { level: 1 })).toHaveText('designing for the operator');
  // The first section is the trial's content anchor for this journey.
  await expect(screen.getByRole('heading', 'the difference between a ui and a console')).toBeVisible();
  await screen.getByRole('link', '< cd ../blog').tap();
  await expect(browser).toHaveURL('/blog/');
});

for (const route of articles) {
  test(`${route} table of contents and article links work`, async ({ app, browser, screen }) => {
    await app.open(route);
    const toc = browser.locator('#toc-list a');
    expect(await toc.count()).toBeGreaterThan(0);
    const href = (await toc.first().getAttribute('href'))!;
    await toc.first().tap();
    await expect(browser).toHaveURL(`${route}${href}`);
    await expect.poll(() => inViewport(browser, href)).toBe(true);
    const related = browser.locator('aside a[href^="/blog/"]');
    expect(await related.count()).toBeGreaterThan(0);
    const relatedHref = (await related.first().getAttribute('href'))!;
    expect(relatedHref).not.toBe(route);
    await related.first().tap();
    await expect(browser).toHaveURL(relatedHref);
    await expect(screen.getByRole('heading', { level: 1 })).toBeVisible();
    await app.open(route);
    const adjacent = browser.locator('article a').filter({ hasText: /previous post|next post/ });
    expect(await adjacent.count()).toBeGreaterThan(0);
    const adjacentHref = (await adjacent.first().getAttribute('href'))!;
    await adjacent.first().tap();
    await expect(browser).toHaveURL(adjacentHref);
  });
}

test('navigation works with the keyboard and restores focus', async ({ app, browser, screen }) => {
  await app.open('/');
  if (await viewportWidth(browser) >= 768) {
    await browser.locator('header nav a[href="/blog/"]').focus();
    await browser.keyboard.press('Enter');
    await expect(browser).toHaveURL('/blog/');
    return;
  }
  const trigger = screen.getByRole('button', 'Toggle menu');
  await trigger.focus();
  await browser.keyboard.press('Enter');
  const dialog = screen.getByRole('dialog', 'Site navigation');
  await expect(dialog).toBeVisible();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  const controls = browser.locator('#mobile-menu :is(a, button)');
  await controls.first().focus();
  await browser.keyboard.press('Shift+Tab');
  await expect(controls.last()).toBeFocused();
  await browser.keyboard.press('Tab');
  await expect(controls.first()).toBeFocused();
  await browser.keyboard.press('Escape');
  await expect(browser.locator('#mobile-menu')).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  expect(await browser.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe('hidden');
  await trigger.tap();
  await dialog.getByRole('button', 'Close menu').tap();
  await expect(browser.locator('#mobile-menu')).toBeHidden();
});

test('ordinary-motion terminal content finishes rendering', async ({ app, browser, motion }) => {
  await motion.set('no-preference');
  await app.open('/');
  await expect(browser.locator('#hero-terminal .terminal-hidden')).toHaveCount(0, { timeout: 15_000 });
  await browser.evaluate(() => {
    document.getElementById('contact-terminal-wrapper')!.scrollIntoView({ behavior: 'instant', block: 'center' });
    return null;
  });
  await expect(browser.locator('#contact-terminal .terminal-hidden')).toHaveCount(0, { timeout: 10_000 });
  await expectTerminalContent(browser);
});

test('reduced-motion terminal content is available immediately', async ({ app, browser }) => {
  await app.open('/');
  await expect(browser.locator('#hero-terminal .terminal-hidden')).toHaveCount(0);
  await expect(browser.locator('#contact-terminal .terminal-hidden')).toHaveCount(0);
  await expectTerminalContent(browser);
  await expect.poll(() => browser.evaluate(() => getComputedStyle(document.getElementById('hero-bottom')!).opacity)).toBe('1');
  await expect.poll(() => browser.evaluate(() => {
    const animated = [...document.querySelectorAll('[data-animate]')].map(element => getComputedStyle(element));
    return animated.length > 0 && animated.every(style => style.animationName === 'none' && style.opacity === '1');
  })).toBe(true);
});
