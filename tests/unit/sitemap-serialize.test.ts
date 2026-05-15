import { describe, it, expect } from 'vitest';
import { serializeSitemapEntry } from '../../src/plugins/sitemap-serialize.mjs';

const posts = {
  'designing-for-the-operator': {
    pubDate: new Date('2026-05-15T00:00:00.000Z'),
  },
  'brownfield-ai': {
    pubDate: new Date('2026-04-30T00:00:00.000Z'),
    updatedDate: new Date('2026-05-10T00:00:00.000Z'),
  },
};

describe('serializeSitemapEntry', () => {
  it('returns the item unchanged when the URL is not a blog post', () => {
    const item = { url: 'https://friquelme.dev/' };
    expect(serializeSitemapEntry(item, posts)).toEqual(item);
  });

  it('returns the item unchanged when the slug has no matching post', () => {
    const item = { url: 'https://friquelme.dev/blog/' };
    expect(serializeSitemapEntry(item, posts)).toEqual(item);
  });

  it('adds lastmod from pubDate when the post has no updatedDate', () => {
    const item = { url: 'https://friquelme.dev/blog/designing-for-the-operator/' };
    const result = serializeSitemapEntry(item, posts);
    expect(result.lastmod).toBe('2026-05-15T00:00:00.000Z');
  });

  it('prefers updatedDate over pubDate when both are present', () => {
    const item = { url: 'https://friquelme.dev/blog/brownfield-ai/' };
    const result = serializeSitemapEntry(item, posts);
    expect(result.lastmod).toBe('2026-05-10T00:00:00.000Z');
  });
});
