import { describe, it, expect } from 'vitest';
import { getSeoMeta } from '../../src/lib/seo';

describe('getSeoMeta', () => {
  const site = new URL('https://friquelme.dev');

  const postInput = {
    kind: 'post' as const,
    title: 'Hello world',
    description: 'A first post.',
    slug: 'hello-world',
    datePublished: new Date('2026-01-15T00:00:00Z'),
    author: 'Florian Riquelme',
    tags: ['astro', 'typescript'],
  };

  describe('home variant', () => {
    it('returns a canonical URL with a trailing slash', () => {
      const result = getSeoMeta(
        { kind: 'home', title: 'friquelme.dev', description: 'd' },
        { site, pathname: '/' },
      );

      expect(result.canonical).toBe('https://friquelme.dev/');
    });

    it('omits articleJsonLd', () => {
      const result = getSeoMeta(
        { kind: 'home', title: 't', description: 'd' },
        { site, pathname: '/' },
      );

      expect(result.articleJsonLd).toBeUndefined();
    });
  });

  describe('post variant', () => {
    it('returns canonical URL for /blog/<slug>/', () => {
      const result = getSeoMeta(postInput, {
        site,
        pathname: '/blog/hello-world/',
      });

      expect(result.canonical).toBe(
        'https://friquelme.dev/blog/hello-world/',
      );
    });

    it('returns articleJsonLd with BlogPosting @type, headline, and description', () => {
      const result = getSeoMeta(postInput, {
        site,
        pathname: '/blog/hello-world/',
      });

      expect(result.articleJsonLd).toEqual(
        expect.objectContaining({
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          headline: 'Hello world',
          description: 'A first post.',
        }),
      );
    });

    it('returns articleJsonLd with datePublished as ISO 8601', () => {
      const result = getSeoMeta(postInput, {
        site,
        pathname: '/blog/hello-world/',
      });

      expect(result.articleJsonLd?.datePublished).toBe(
        '2026-01-15T00:00:00.000Z',
      );
    });

    it('emits dateModified when updatedDate provided', () => {
      const result = getSeoMeta(
        { ...postInput, dateModified: new Date('2026-02-01T00:00:00Z') },
        { site, pathname: '/blog/hello-world/' },
      );

      expect(result.articleJsonLd?.dateModified).toBe(
        '2026-02-01T00:00:00.000Z',
      );
    });

    it('falls back dateModified to datePublished when not provided', () => {
      const result = getSeoMeta(postInput, {
        site,
        pathname: '/blog/hello-world/',
      });

      expect(result.articleJsonLd?.dateModified).toBe(
        '2026-01-15T00:00:00.000Z',
      );
    });

    it('emits Person author with site origin URL', () => {
      const result = getSeoMeta(postInput, {
        site,
        pathname: '/blog/hello-world/',
      });

      expect(result.articleJsonLd?.author).toEqual({
        '@type': 'Person',
        name: 'Florian Riquelme',
        url: 'https://friquelme.dev',
      });
    });

    it('emits Person publisher with site origin URL and logo', () => {
      const result = getSeoMeta(postInput, {
        site,
        pathname: '/blog/hello-world/',
      });

      expect(result.articleJsonLd?.publisher).toEqual({
        '@type': 'Person',
        name: 'Florian Riquelme',
        url: 'https://friquelme.dev',
        logo: {
          '@type': 'ImageObject',
          url: 'https://friquelme.dev/og/index.png',
        },
      });
    });

    it('emits mainEntityOfPage with canonical @id', () => {
      const result = getSeoMeta(postInput, {
        site,
        pathname: '/blog/hello-world/',
      });

      expect(result.articleJsonLd?.mainEntityOfPage).toEqual({
        '@type': 'WebPage',
        '@id': 'https://friquelme.dev/blog/hello-world/',
      });
    });

    it('joins tags into comma-separated keywords', () => {
      const result = getSeoMeta(postInput, {
        site,
        pathname: '/blog/hello-world/',
      });

      expect(result.articleJsonLd?.keywords).toBe('astro, typescript');
    });

    it('resolves imageSrc against site for absolute image URL', () => {
      const result = getSeoMeta(
        { ...postInput, imageSrc: '/images/hero.png' },
        { site, pathname: '/blog/hello-world/' },
      );

      expect(result.articleJsonLd?.image).toBe(
        'https://friquelme.dev/images/hero.png',
      );
    });

    it('defaults image to /og/<slug>.png when imageSrc not provided', () => {
      const result = getSeoMeta(postInput, {
        site,
        pathname: '/blog/hello-world/',
      });

      expect(result.articleJsonLd?.image).toBe(
        'https://friquelme.dev/og/hello-world.png',
      );
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
      const result = getSeoMeta(postInput, {
        site,
        pathname: '/blog/hello-world/',
      });

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
