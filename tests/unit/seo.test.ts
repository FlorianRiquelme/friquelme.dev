import { describe, it, expect } from 'vitest';
import { getSeoMeta } from '../../src/lib/seo';

describe('getSeoMeta', () => {
  const site = new URL('https://friquelme.dev');

  describe('home variant', () => {
    it('returns a canonical URL with a trailing slash', () => {
      const result = getSeoMeta(
        { kind: 'home', title: 'friquelme.dev', description: 'd' },
        { site, pathname: '/' },
      );

      expect(result.canonical).toBe('https://friquelme.dev/');
    });
  });

  describe('post variant', () => {
    const input = {
      kind: 'post' as const,
      title: 'Hello world',
      description: 'A first post.',
      slug: 'hello-world',
      datePublished: new Date('2026-01-15T00:00:00Z'),
    };

    it('returns canonical URL for /blog/<slug>/', () => {
      const result = getSeoMeta(input, {
        site,
        pathname: '/blog/hello-world/',
      });

      expect(result.canonical).toBe(
        'https://friquelme.dev/blog/hello-world/',
      );
    });

    it('returns articleJsonLd with Article @type and headline', () => {
      const result = getSeoMeta(input, {
        site,
        pathname: '/blog/hello-world/',
      });

      expect(result.articleJsonLd).toEqual(
        expect.objectContaining({
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: 'Hello world',
        }),
      );
    });

    it('returns articleJsonLd with datePublished as ISO 8601', () => {
      const result = getSeoMeta(input, {
        site,
        pathname: '/blog/hello-world/',
      });

      expect(result.articleJsonLd?.datePublished).toBe(
        '2026-01-15T00:00:00.000Z',
      );
    });
  });

  describe('home variant — non-article fields', () => {
    it('omits articleJsonLd', () => {
      const result = getSeoMeta(
        { kind: 'home', title: 't', description: 'd' },
        { site, pathname: '/' },
      );

      expect(result.articleJsonLd).toBeUndefined();
    });
  });

  describe('og:type discriminator', () => {
    it('home variant emits type "website"', () => {
      const result = getSeoMeta(
        { kind: 'home', title: 't', description: 'd' },
        { site, pathname: '/' },
      );

      expect(result.type).toBe('website');
    });

    it('post variant emits type "article"', () => {
      const result = getSeoMeta(
        {
          kind: 'post',
          title: 't',
          description: 'd',
          slug: 's',
          datePublished: new Date('2026-01-01'),
        },
        { site, pathname: '/blog/s/' },
      );

      expect(result.type).toBe('article');
    });

    it('project variant emits type "website"', () => {
      const result = getSeoMeta(
        {
          kind: 'project',
          title: 't',
          description: 'd',
          slug: 'project-x',
        },
        { site, pathname: '/projects/project-x/' },
      );

      expect(result.type).toBe('website');
    });
  });

  describe('project variant', () => {
    const input = {
      kind: 'project' as const,
      title: 'Project X',
      description: 'A project.',
      slug: 'project-x',
    };

    it('returns canonical URL for /projects/<slug>/', () => {
      const result = getSeoMeta(input, {
        site,
        pathname: '/projects/project-x/',
      });

      expect(result.canonical).toBe(
        'https://friquelme.dev/projects/project-x/',
      );
    });

    it('omits articleJsonLd (projects are not Articles)', () => {
      const result = getSeoMeta(input, {
        site,
        pathname: '/projects/project-x/',
      });

      expect(result.articleJsonLd).toBeUndefined();
    });
  });
});
