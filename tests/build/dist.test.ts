import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeAll } from 'vitest';
import sharp from 'sharp';

const ROOT = resolve(fileURLToPath(import.meta.url), '../../..');
const DIST = resolve(ROOT, 'dist');

describe('astro build output', () => {
  beforeAll(() => {
    execSync('pnpm exec astro build', { cwd: ROOT, stdio: 'inherit' });
  });

  describe('trailing slash', () => {
    it('emits dist/blog/index.html', () => {
      expect(existsSync(resolve(DIST, 'blog/index.html'))).toBe(true);
    });

    it('every <loc> in the sitemap ends with a trailing slash', () => {
      const xml = readFileSync(resolve(DIST, 'sitemap-0.xml'), 'utf-8');
      const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
        (m) => m[1],
      );
      expect(locs.length).toBeGreaterThan(0);
      const offenders = locs.filter((url) => !url.endsWith('/'));
      expect(offenders).toEqual([]);
    });

    it('sitemap entries for blog posts include <lastmod>', () => {
      const xml = readFileSync(resolve(DIST, 'sitemap-0.xml'), 'utf-8');
      const blogEntries = [...xml.matchAll(/<url>[\s\S]*?<\/url>/g)]
        .map((m) => m[0])
        .filter((entry) => /<loc>https:\/\/[^<]+\/blog\/[a-z0-9-]+\/<\/loc>/.test(entry));
      expect(blogEntries.length).toBeGreaterThan(0);
      const missingLastmod = blogEntries.filter((e) => !e.includes('<lastmod>'));
      expect(missingLastmod).toEqual([]);
    });

    it.each([
      ['index.html', '/'],
      ['blog/index.html', '/blog/'],
      ['blog/seo-for-astro-sites/index.html', '/blog/<slug>/'],
    ])(
      'every internal <a href> in dist/%s ends with a trailing slash',
      (file) => {
        const html = readFileSync(resolve(DIST, file), 'utf-8');
        const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map(
          (m) => m[1],
        );

        const internalPageLinks = hrefs.filter((href) => {
          if (!href.startsWith('/')) return false;
          if (href.startsWith('//')) return false;
          if (href.startsWith('/#')) return false;
          if (href.includes('#')) return false;
          if (href.includes('?')) return false;
          const last = href.split('/').at(-1) ?? '';
          if (last.includes('.')) return false;
          return true;
        });

        const offenders = internalPageLinks.filter(
          (href) => !href.endsWith('/'),
        );
        expect(offenders).toEqual([]);
      },
    );
  });

  describe('homepage internal links', () => {
    it('links to /blog/designing-for-the-operator/ from the homepage', () => {
      const html = readFileSync(resolve(DIST, 'index.html'), 'utf-8');
      expect(html).toContain('href="/blog/designing-for-the-operator/"');
    });
  });

  describe('og images', () => {
    it('emits dist/og/index.png for the homepage', () => {
      expect(existsSync(resolve(DIST, 'og/index.png'))).toBe(true);
    });

    it('homepage og:image is 1200×630 PNG', async () => {
      const meta = await sharp(resolve(DIST, 'og/index.png')).metadata();
      expect(meta.format).toBe('png');
      expect(meta.width).toBe(1200);
      expect(meta.height).toBe(630);
    });
  });
});
