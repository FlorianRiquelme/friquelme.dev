import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, it, expect } from 'vitest';
import Layout from '../../src/layouts/Layout.astro';
import type { SeoOutput } from '../../src/lib/seo';

const articleSeo: SeoOutput = {
  canonical: 'https://friquelme.dev/blog/test-post/',
  type: 'article',
  articleJsonLd: {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: 'Test Post',
    description: 'A test.',
    datePublished: '2026-01-15T00:00:00.000Z',
    dateModified: '2026-01-15T00:00:00.000Z',
    author: {
      '@type': 'Person',
      name: 'Florian Riquelme',
      url: 'https://friquelme.dev',
    },
    publisher: {
      '@type': 'Person',
      name: 'Florian Riquelme',
      url: 'https://friquelme.dev',
      logo: {
        '@type': 'ImageObject',
        url: 'https://friquelme.dev/og/index.png',
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': 'https://friquelme.dev/blog/test-post/',
    },
    image: 'https://friquelme.dev/og/test-post.png',
    keywords: 'test',
  },
};

const websiteSeo: SeoOutput = {
  canonical: 'https://friquelme.dev/',
  type: 'website',
};

const baseProps = { title: 'Test Post', description: 'A test.' };

describe('Layout', () => {
  it('renders <link rel="canonical"> from seo.canonical', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(Layout, {
      props: { ...baseProps, seo: articleSeo },
    });

    expect(html).toContain(
      '<link rel="canonical" href="https://friquelme.dev/blog/test-post/"',
    );
  });

  it('renders og:url with the same canonical', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(Layout, {
      props: { ...baseProps, seo: articleSeo },
    });

    expect(html).toContain(
      '<meta property="og:url" content="https://friquelme.dev/blog/test-post/"',
    );
  });

  it('renders og:type from seo.type', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(Layout, {
      props: { ...baseProps, seo: articleSeo },
    });

    expect(html).toContain('<meta property="og:type" content="article"');
  });

  it('renders <script type="application/ld+json"> when seo.articleJsonLd is set', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(Layout, {
      props: { ...baseProps, seo: articleSeo },
    });

    expect(html).toContain('<script type="application/ld+json"');
    expect(html).toContain('"@type":"BlogPosting"');
    expect(html).toContain('"headline":"Test Post"');
    expect(html).toContain('"datePublished":"2026-01-15T00:00:00.000Z"');
  });

  it('does not render JSON-LD script for website-type seo', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(Layout, {
      props: { ...baseProps, seo: websiteSeo },
    });

    expect(html).not.toContain('application/ld+json');
  });
});
