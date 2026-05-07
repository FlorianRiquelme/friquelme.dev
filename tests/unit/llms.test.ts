import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIContext } from 'astro';

const mockEntries = [
  {
    id: 'older-post',
    body: '## older\n\nbody one.',
    data: {
      title: 'older post',
      description: 'older description',
      pubDate: new Date('2026-01-01T00:00:00Z'),
      author: 'florian riquelme',
      tags: ['old'],
      draft: false,
    },
  },
  {
    id: 'draft-post',
    body: '## draft\n\nshould not appear.',
    data: {
      title: 'draft post',
      description: 'never published',
      pubDate: new Date('2026-02-01T00:00:00Z'),
      author: 'florian riquelme',
      tags: ['hidden'],
      draft: true,
    },
  },
  {
    id: 'newer-post',
    body: '## newer\n\nbody two.',
    data: {
      title: 'newer post',
      description: 'newer description',
      pubDate: new Date('2026-03-01T00:00:00Z'),
      author: 'florian riquelme',
      tags: ['new', 'shiny'],
      draft: false,
    },
  },
];

vi.mock('astro:content', () => ({
  getCollection: vi.fn(async () => mockEntries),
}));

const ctx = {
  site: new URL('https://friquelme.dev'),
} as unknown as APIContext;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /llms.txt', () => {
  it('emits the header, summary, and contact sections', async () => {
    const { GET } = await import('../../src/pages/llms.txt');
    const res = await GET(ctx);
    const text = await res.text();

    expect(text).toContain('# friquelme.dev');
    expect(text).toContain('## Pages');
    expect(text).toContain('## Blog posts');
    expect(text).toContain('## Contact');
    expect(text).toContain('flo@friquelme.dev');
  });

  it('excludes drafts and orders posts by pubDate descending', async () => {
    const { GET } = await import('../../src/pages/llms.txt');
    const res = await GET(ctx);
    const text = await res.text();

    expect(text).not.toContain('draft post');
    const newerIdx = text.indexOf('newer post');
    const olderIdx = text.indexOf('older post');
    expect(newerIdx).toBeGreaterThan(-1);
    expect(olderIdx).toBeGreaterThan(newerIdx);
  });

  it('renders absolute post URLs against the request site', async () => {
    const { GET } = await import('../../src/pages/llms.txt');
    const res = await GET(ctx);
    const text = await res.text();

    expect(text).toContain('https://friquelme.dev/blog/newer-post/');
    expect(text).toContain('https://friquelme.dev/blog/older-post/');
  });

  it('serves text/plain content type', async () => {
    const { GET } = await import('../../src/pages/llms.txt');
    const res = await GET(ctx);

    expect(res.headers.get('content-type')).toContain('text/plain');
  });
});

describe('GET /llms-full.txt', () => {
  it('concatenates raw bodies with title and frontmatter summary', async () => {
    const { GET } = await import('../../src/pages/llms-full.txt');
    const res = await GET(ctx);
    const text = await res.text();

    expect(text).toContain('# newer post');
    expect(text).toContain('newer description');
    expect(text).toContain('tags: new, shiny');
    expect(text).toContain('published: 2026-03-01');
    expect(text).toContain('## newer');
    expect(text).toContain('body two.');
  });

  it('excludes drafts', async () => {
    const { GET } = await import('../../src/pages/llms-full.txt');
    const res = await GET(ctx);
    const text = await res.text();

    expect(text).not.toContain('draft post');
    expect(text).not.toContain('should not appear');
  });

  it('orders posts by pubDate descending', async () => {
    const { GET } = await import('../../src/pages/llms-full.txt');
    const res = await GET(ctx);
    const text = await res.text();

    const newerIdx = text.indexOf('# newer post');
    const olderIdx = text.indexOf('# older post');
    expect(newerIdx).toBeGreaterThan(-1);
    expect(olderIdx).toBeGreaterThan(newerIdx);
  });
});
