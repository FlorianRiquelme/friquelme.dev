import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { Window, type IFetchInterceptor } from 'happy-dom';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { routes, siteOrigin, articles } from '../support/site';

const dist = resolve('dist');
function fileFor(pathname: string) {
  return resolve(dist, pathname.slice(1), pathname.endsWith('/') ? 'index.html' : '');
}
function readDocument(pathname: string, interceptor?: IFetchInterceptor) {
  // This suite reads built files. Asset loading and script execution belong to browser tests.
  const window = new Window({ url: `${siteOrigin}${pathname}`, settings: {
    disableCSSFileLoading: true,
    disableJavaScriptFileLoading: true,
    disableIframePageLoading: true,
    enableJavaScriptEvaluation: false,
    fetch: { interceptor },
  } });
  window.document.write(readFileSync(fileFor(pathname), 'utf8'));
  return window;
}

// Contracts apply to every published page, including posts added later.
describe('all built pages', () => {
  it('parses built HTML without requesting production resources', async () => {
    const requests: string[] = [];
    const window = readDocument('/', { beforeAsyncRequest: async ({ request, window }) => {
      requests.push(request.url);
      return new window.Response('', { status: 200 });
    } });
    try {
      await window.happyDOM.waitUntilComplete();
      expect(window.document.querySelector('link[rel="stylesheet"]')).not.toBeNull();
      expect(requests).toEqual([]);
    } finally { await window.happyDOM.abort(); }
  });
  it('has no duplicate sitemap URLs', () => expect(new Set(routes).size).toBe(routes.length));
  it('the sitemap covers every built HTML page', () => {
    const builtPages = (readdirSync(dist, { recursive: true }) as string[])
      .filter(file => file === 'index.html' || file.endsWith('/index.html'))
      .map(file => `/${file.replace(/index\.html$/, '')}`);
    expect([...routes].sort()).toEqual(builtPages.sort());
  });
  for (const route of routes) {
    it(`${route} has exact canonical metadata, valid structured data and reachable internal links`, async () => {
      const window = readDocument(route);
      try {
        const document = window.document;
        expect(document.querySelectorAll('h1')).toHaveLength(1);
        expect(document.title.trim()).not.toBe('');
        expect(document.querySelector('meta[name="description"]')?.getAttribute('content')?.trim()).toBeTruthy();
        expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(`${siteOrigin}${route}`);
        expect(document.querySelector('meta[property="og:url"]')?.getAttribute('content')).toBe(`${siteOrigin}${route}`);
        for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
          expect(() => JSON.parse(script.textContent ?? '')).not.toThrow();
        }
        const targets = document.querySelectorAll('a[href], img[src], script[src], link[rel="stylesheet"], link[rel="icon"], link[rel="preload"]');
        expect(targets.length).toBeGreaterThan(0);
        for (const element of targets) {
          const raw = element.getAttribute('href') ?? element.getAttribute('src');
          expect(raw?.trim(), `empty link/asset in ${route}`).toBeTruthy();
          const url = new URL(raw!, `${siteOrigin}${route}`);
          expect(['http:', 'https:', 'mailto:']).toContain(url.protocol);
          if (url.origin !== siteOrigin) continue;
          expect(existsSync(fileFor(url.pathname)), `${route} → ${raw}`).toBe(true);
          if (url.hash) {
            const target = readDocument(url.pathname);
            try { expect(target.document.getElementById(decodeURIComponent(url.hash.slice(1))), `${route} → ${raw}`).not.toBeNull(); }
            finally { await target.happyDOM.abort(); }
          }
        }
        if (articles.includes(route)) {
          expect(document.querySelector('article')?.textContent?.trim().length).toBeGreaterThan(100);
          expect(document.querySelector('meta[property="og:type"]')?.getAttribute('content')).toBe('article');
          const schemas = Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map(script => JSON.parse(script.textContent!));
          expect(schemas.some(schema => schema['@type'] === 'BlogPosting')).toBe(true);
        }
      } finally { await window.happyDOM.abort(); }
    });
    it(`${route} has a valid 1200×630 Open Graph image`, async () => {
      const window = readDocument(route);
      try {
        const image = window.document.querySelector('meta[property="og:image"]')?.getAttribute('content');
        expect(image).toBeTruthy();
        const metadata = await sharp(fileFor(new URL(image!).pathname)).metadata();
        expect({ format: metadata.format, width: metadata.width, height: metadata.height }).toEqual({ format: 'png', width: 1200, height: 630 });
      } finally { await window.happyDOM.abort(); }
    });
  }
  it('RSS contains exactly the published articles with reachable canonical URLs', () => {
    const rss = readFileSync(resolve(dist, 'rss.xml'), 'utf8');
    const items = [...rss.matchAll(/<item>([\s\S]*?)<\/item>/g)];
    const links = items.map(item => new URL(item[1].match(/<link>([^<]+)<\/link>/)![1]));
    expect(links.map(url => url.pathname).sort()).toEqual([...articles].sort());
    expect(links.every(url => url.origin === siteOrigin)).toBe(true);
  });
  it('LLM discovery links and full-text headings cover every published article', async () => {
    const index = readFileSync(resolve(dist, 'llms.txt'), 'utf8');
    const full = readFileSync(resolve(dist, 'llms-full.txt'), 'utf8');
    expect(index).toContain('Florian Riquelme');
    for (const route of articles) {
      expect(index).toContain(`${siteOrigin}${route}`);
      const window = readDocument(route);
      try { expect(full).toContain(`# ${window.document.querySelector('h1')!.textContent!.trim()}`); }
      finally { await window.happyDOM.abort(); }
    }
  });
});

// The expected origin comes from the built sitemap index, which @astrojs/sitemap derives from `site`.
describe('robots.txt', () => {
  const sitemapLines = () => readFileSync(resolve(dist, 'robots.txt'), 'utf8').split(/\r?\n/).filter(line => /^Sitemap:/i.test(line));
  it('has exactly one Sitemap line', () => expect(sitemapLines()).toHaveLength(1));
  it('advertises the built sitemap index on the configured site origin', () => {
    const sitemap = new URL(sitemapLines()[0].replace(/^Sitemap:/i, '').trim());
    const file = resolve(dist, sitemap.pathname.slice(1));
    expect(existsSync(file), `${sitemap.pathname} is not in dist/`).toBe(true);
    const index = readFileSync(file, 'utf8');
    expect(index).toMatch(/<sitemapindex[\s>]/);
    const origins = [...index.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => new URL(match[1]).origin);
    expect(origins.length).toBeGreaterThan(0);
    expect(new Set(origins)).toEqual(new Set([sitemap.origin]));
    expect(sitemap.href).toBe(`${origins[0]}/sitemap-index.xml`);
  });
});
