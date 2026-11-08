import type { Browser } from '@e2e-dev/web';
import { test, expect, viewportWidth } from './fixtures';

function workshopState(browser: Browser) {
  return browser.evaluate(() => {
    const root = document.querySelector('[data-workshop]');
    const canvas = document.querySelector('[data-workshop-canvas]');
    return {
      state: root?.getAttribute('data-workshop-state') ?? '',
      settled: root?.getAttribute('data-workshop-settled') ?? '',
      view: root?.getAttribute('data-workshop-view') ?? '',
      motion: root?.getAttribute('data-workshop-motion') ?? '',
      canvasHidden: canvas instanceof HTMLCanvasElement ? canvas.hidden : true,
    };
  });
}

function waitForState(browser: Browser, state: string, timeout = 30_000) {
  return expect.poll(async () => (await workshopState(browser)).state, { timeout }).toBe(state);
}

function waitForSettled(browser: Browser, node: string, timeout = 30_000) {
  return expect.poll(async () => (await workshopState(browser)).settled, { timeout }).toBe(node);
}

async function openScene(app: { open(path?: string): Promise<void> }, browser: Browser) {
  await app.open('/');
  await browser.locator('[data-workshop]').scrollIntoView();
  await waitForState(browser, 'ready');
}

function canvasSignature(browser: Browser) {
  return browser.evaluate(() => {
    const canvas = document.querySelector('[data-workshop-canvas]');
    if (!(canvas instanceof HTMLCanvasElement)) return '';
    const sample = document.createElement('canvas');
    sample.width = 64;
    sample.height = 40;
    const context = sample.getContext('2d');
    if (!context) return '';
    context.drawImage(canvas, 0, 0, sample.width, sample.height);
    const pixels = context.getImageData(0, 0, sample.width, sample.height).data;
    let hash = 2166136261;
    let sum = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      const value = pixels[index] + pixels[index + 1] * 3 + pixels[index + 2] * 7;
      sum += value;
      hash ^= value;
      hash = Math.imul(hash, 16777619);
    }
    return `${hash >>> 0}:${sum}`;
  });
}

test('the GLB loads and the screengrab journey changes the rendered canvas', { timeout: 60_000 }, async ({ app, browser }) => {
  const response = browser.waitForResponse(/\/workshop\/workshop\.glb$/, { timeout: 45_000 });
  await app.open('/');
  await browser.locator('[data-workshop]').scrollIntoView();
  expect((await response).status).toBe(200);
  await waitForState(browser, 'ready');
  expect((await workshopState(browser)).motion).toBe('reduce');
  const overview = await canvasSignature(browser);
  expect(overview).not.toBe('');

  await browser.locator('[data-workshop-room="screengrab"]').tap();
  await waitForSettled(browser, 'room:screengrab');
  const room = await canvasSignature(browser);
  expect(room, 'the room view must change the visible canvas').not.toBe(overview);
  await expect(browser.locator('[data-workshop-monitor]')).toBeVisible();
  await expect(browser.locator('[data-workshop-overview]')).toBeEnabled();

  await browser.locator('[data-workshop-monitor]').tap();
  await waitForSettled(browser, 'interior');
  const interior = await canvasSignature(browser);
  expect(interior, 'the monitor traversal must change the visible canvas').not.toBe(room);
  await expect(browser.locator('[data-workshop-rotate-group]')).toBeVisible();

  await browser.locator('[data-workshop-rotate="right"]').tap();
  const rotated = await canvasSignature(browser);
  expect(rotated, 'the miniature rotation must change the visible canvas').not.toBe(interior);

  await browser.locator('[data-workshop-canvas]').scrollIntoView();
  const canvas = await browser.locator('[data-workshop-canvas]').boundingBox();
  if (!canvas) throw new Error('workshop canvas has no box');
  await browser.mouse.move(canvas.x + canvas.width * 0.5, canvas.y + canvas.height * 0.5);
  await browser.mouse.down();
  await browser.mouse.move(canvas.x + canvas.width * 0.68, canvas.y + canvas.height * 0.5);
  await browser.mouse.up();
  const dragged = await canvasSignature(browser);
  expect(dragged, 'dragging the miniature must change the visible canvas').not.toBe(rotated);

  await browser.locator('[data-workshop-back]').tap();
  await waitForSettled(browser, 'room:screengrab');
  await browser.locator('[data-workshop-back]').tap();
  await waitForSettled(browser, 'overview');
  await expect(browser.locator('[data-workshop-overview]')).toBeEnabled();
});

test('the hero call to action enters the featured room', { timeout: 60_000 }, async ({ app, browser }) => {
  await app.open('/');
  await browser.locator('[data-workshop-enter]').tap();
  await waitForState(browser, 'ready');
  await waitForSettled(browser, 'room:screengrab');
  expect((await workshopState(browser)).view).toBe('room:screengrab');
});

test('only the screengrab room exposes the monitor control', { timeout: 60_000 }, async ({ app, browser }) => {
  await openScene(app, browser);
  await browser.locator('[data-workshop-room="nachtschicht"]').tap();
  await waitForSettled(browser, 'room:nachtschicht');
  await expect(browser.locator('[data-workshop-monitor]')).toBeHidden();
  await browser.locator('[data-workshop-room="screengrab"]').tap();
  await waitForSettled(browser, 'room:screengrab');
  await expect(browser.locator('[data-workshop-monitor]')).toBeVisible();
  await browser.locator('[data-workshop-overview]').tap();
  await waitForSettled(browser, 'overview');
  await expect(browser.locator('[data-workshop-monitor]')).toBeHidden();
});

test('rapid input settles at the last requested destination', { timeout: 60_000 }, async ({ app, browser, motion }) => {
  await motion.set('no-preference');
  await openScene(app, browser);
  expect((await workshopState(browser)).motion).toBe('full');
  await expect.poll(() => browser.evaluate(() => document.querySelector('[data-workshop]')?.getAttribute('data-workshop-active') ?? ''), { timeout: 10_000 }).toBe('true');
  await browser.evaluate(() => {
    for (const selector of [
      '[data-workshop-room="screengrab"]',
      '[data-workshop-room="claudefuel"]',
      '[data-workshop-room="jev-kit"]',
      '[data-workshop-overview]',
      '[data-workshop-room="nachtschicht"]',
    ]) {
      const button = document.querySelector<HTMLButtonElement>(selector);
      if (!button) throw new Error(`missing ${selector}`);
      button.click();
    }
    return null;
  });
  await waitForSettled(browser, 'room:nachtschicht');
  const state = await workshopState(browser);
  expect(state.view).toBe('room:nachtschicht');
  expect(state.settled).toBe('room:nachtschicht');

  await motion.set('reduce');
  await browser.evaluate(() => {
    document.querySelector<HTMLButtonElement>('[data-workshop-room="screengrab"]')?.click();
    document.querySelector<HTMLButtonElement>('[data-workshop-monitor]')?.click();
    return null;
  });
  await waitForSettled(browser, 'interior');
  await browser.evaluate(() => {
    document.querySelector<HTMLButtonElement>('[data-workshop-room="jev-kit"]')?.click();
    return null;
  });
  await waitForSettled(browser, 'room:jev-kit');
  expect((await workshopState(browser)).view).toBe('room:jev-kit');
});

test('Escape returns one view and restores focus', { timeout: 60_000 }, async ({ app, browser }) => {
  await openScene(app, browser);
  await browser.locator('[data-workshop-room="screengrab"]').tap();
  await waitForSettled(browser, 'room:screengrab');
  const monitor = browser.locator('[data-workshop-monitor]');
  await monitor.tap();
  await waitForSettled(browser, 'interior');
  await browser.locator('[data-workshop-back]').focus();
  await browser.keyboard.press('Escape');
  await waitForSettled(browser, 'room:screengrab');
  await expect(browser.locator('[data-workshop-room="screengrab"]')).toBeFocused();
  await browser.keyboard.press('Escape');
  await waitForSettled(browser, 'overview');
  await expect(browser.locator('[data-workshop-overview]')).toBeFocused();
});

test('the renderer pauses offscreen and resumes when the scene returns', { timeout: 60_000 }, async ({ app, browser, motion }) => {
  await motion.set('no-preference');
  await openScene(app, browser);
  const active = () => browser.evaluate(() => document.querySelector('[data-workshop]')?.getAttribute('data-workshop-active') ?? '');
  await expect.poll(active, { timeout: 10_000 }).toBe('true');
  await browser.locator('#contact').scrollIntoView();
  await expect.poll(active, { timeout: 10_000 }).toBe('false');
  await browser.locator('[data-workshop]').scrollIntoView();
  await expect.poll(active, { timeout: 10_000 }).toBe('true');
});

test('a runtime reduced-motion change settles the destination and stops ambient frames', { timeout: 60_000 }, async ({ app, browser, motion }) => {
  await motion.set('no-preference');
  await openScene(app, browser);
  await browser.locator('[data-workshop-room="screengrab"]').tap();
  await motion.set('reduce');
  await waitForSettled(browser, 'room:screengrab');
  await expect.poll(async () => (await workshopState(browser)).motion).toBe('reduce');
  const settled = await canvasSignature(browser);
  await browser.evaluate(() => new Promise<number>((resolve) => window.setTimeout(() => resolve(1), 350)));
  expect(await canvasSignature(browser), 'reduced motion must not keep rendering ambient frames').toBe(settled);
  await motion.set('no-preference');
  await expect.poll(async () => (await workshopState(browser)).motion).toBe('full');
});

test('an asset failure leaves the poster and ordinary content usable', { timeout: 60_000 }, async ({ app, browser }) => {
  await browser.route(/\/workshop\/manifest\.json$/, (route) => route.abort());
  await app.open('/');
  await browser.locator('[data-workshop]').scrollIntoView();
  await waitForState(browser, 'fallback');
  const state = await workshopState(browser);
  expect(state.canvasHidden).toBe(true);
  await expect(browser.locator('[data-workshop-poster]')).toBeVisible();
  await expect(browser.locator('[data-workshop-room="screengrab"]')).toBeDisabled();
  await expect(browser.locator('[data-workshop]')).toContainText('could not load');
  await expect(browser.locator('#profile-summary')).toBeVisible();
  await expect(browser.locator('#projects')).toContainText('screengrab');
});

test('a resize to desktop releases the mobile menu scroll lock', async ({ app, browser, screen }) => {
  await app.open('/');
  await browser.setViewport({ width: 390, height: 844 });
  const trigger = screen.getByRole('button', 'Toggle menu');
  await trigger.tap();
  await expect(browser.locator('#mobile-menu')).toBeVisible();
  expect(await browser.evaluate(() => document.body.style.overflow)).toBe('hidden');
  await browser.setViewport({ width: 1280, height: 900 });
  await expect(browser.locator('#mobile-menu')).toBeHidden();
  await expect.poll(() => browser.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe('hidden');
  await expect(browser.locator('header nav')).toBeVisible();
  await browser.setViewport({ width: 390, height: 844 });
  await trigger.tap();
  await expect(browser.locator('#mobile-menu')).toBeVisible();
  await screen.getByRole('button', 'Close menu').tap();
  await expect(browser.locator('#mobile-menu')).toBeHidden();
});

test('browser back restores a usable workshop after leaving the homepage', { timeout: 60_000 }, async ({ app, browser }) => {
  await openScene(app, browser);
  await browser.locator('[data-workshop-room="screengrab"]').tap();
  await waitForSettled(browser, 'room:screengrab');
  await app.open('/blog/');
  await expect(browser).toHaveURL('/blog/');
  await browser.back();
  await browser.locator('[data-workshop]').scrollIntoView();
  await waitForState(browser, 'ready');
  await browser.locator('[data-workshop-room="nachtschicht"]').tap();
  await waitForSettled(browser, 'room:nachtschicht');
  expect((await workshopState(browser)).canvasHidden).toBe(false);
});

test('invalid geometry restores the poster without breaking the project index', async ({ app, browser }) => {
  await browser.route(/\/workshop\/workshop\.glb$/, route => route.fulfill({
    status: 200,
    headers: { 'content-type': 'model/gltf-binary' },
    body: 'invalid geometry',
  }));
  await app.open('/');
  await browser.locator('[data-workshop]').scrollIntoView();
  await waitForState(browser, 'fallback');
  await expect(browser.locator('[data-workshop-poster]')).toBeVisible();
  await expect(browser.locator('[data-workshop-overview]')).toBeDisabled();
  await expect(browser.locator('#projects article')).toHaveCount(7);
});

test('blocked enhancement scripts leave all seven projects and contact visible', async ({ app, browser }) => {
  await browser.route(/\/_astro\/.*\.js(?:\?.*)?$/, route => route.abort());
  await app.open('/');
  await expect(browser.locator('#profile-summary')).toBeVisible();
  const projects = browser.locator('#projects article');
  await expect(projects).toHaveCount(7);
  for (const project of await projects.all()) {
    await expect(project).toBeVisible();
  }
  expect(await browser.evaluate(() => [...document.querySelectorAll('#projects article')].map(element => getComputedStyle(element).opacity))).toEqual(Array(7).fill('1'));
  await expect(browser.locator('#contact a[href="mailto:flo@friquelme.dev"]').first()).toBeVisible();
});

test('losing the graphics context restores the poster and usable page', async ({ app, browser }) => {
  await openScene(app, browser);
  await browser.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('[data-workshop-canvas]');
    const extension = canvas?.getContext('webgl2')?.getExtension('WEBGL_lose_context');
    if (!extension) throw new Error('The test browser must support controlled WebGL context loss');
    extension.loseContext();
    return null;
  });
  await waitForState(browser, 'fallback');
  await expect(browser.locator('[data-workshop-poster]')).toBeVisible();
  await expect(browser.locator('[data-workshop-overview]')).toBeDisabled();
  await expect(browser.locator('#profile-summary')).toBeVisible();
  await expect(browser.locator('#projects article')).toHaveCount(7);
});

test('the mobile scene spans the figure with controls below it', async ({ app, browser }) => {
  await app.open('/');
  if ((await viewportWidth(browser)) >= 768) await browser.setViewport({ width: 390, height: 844 });
  const viewport = await browser.locator('.workshop-viewport').boundingBox();
  const figure = await browser.locator('[data-workshop]').boundingBox();
  const caption = await browser.locator('.workshop-caption').boundingBox();
  if (!viewport || !figure || !caption) throw new Error('workshop layout is not measurable');
  expect(Math.abs(viewport.width - figure.width)).toBeLessThanOrEqual(2);
  expect(caption.y).toBeGreaterThanOrEqual(viewport.y + viewport.height - 1);
});
