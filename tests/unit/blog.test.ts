import { describe, it, expect } from 'vitest';
import { formatStars, formatDate, getPublishedPosts } from '../../src/utils/blog';

describe('formatStars', () => {
  it('returns "0" for zero', () => {
    expect(formatStars(0)).toBe('0');
  });

  it('returns the number as-is below 1000', () => {
    expect(formatStars(999)).toBe('999');
  });

  it('formats 1000 as "1.0k"', () => {
    expect(formatStars(1000)).toBe('1.0k');
  });

  it('formats 1500 as "1.5k"', () => {
    expect(formatStars(1500)).toBe('1.5k');
  });

  it('formats 10000 as "10.0k"', () => {
    expect(formatStars(10000)).toBe('10.0k');
  });
});

describe('formatDate', () => {
  it('formats a date as "Mon DD, YYYY"', () => {
    const result = formatDate(new Date('2024-01-15'));
    expect(result).toContain('Jan');
    expect(result).toContain('2024');
    expect(result).toContain('15');
  });

  it('handles different months', () => {
    const result = formatDate(new Date('2025-12-25'));
    expect(result).toContain('Dec');
    expect(result).toContain('25');
    expect(result).toContain('2025');
  });
});

describe('getPublishedPosts', () => {
  const makePosts = (entries: { draft?: boolean; pubDate: string }[]) =>
    entries.map((e, i) => ({
      id: `post-${i}`,
      data: {
        draft: e.draft,
        pubDate: new Date(e.pubDate),
      },
    }));

  it('filters out drafts', () => {
    const posts = makePosts([
      { pubDate: '2024-01-01' },
      { draft: true, pubDate: '2024-02-01' },
      { draft: false, pubDate: '2024-03-01' },
    ]);
    const result = getPublishedPosts(posts);
    expect(result).toHaveLength(2);
    expect(result.every((p) => !p.data.draft)).toBe(true);
  });

  it('sorts by pubDate descending (newest first)', () => {
    const posts = makePosts([
      { pubDate: '2024-01-01' },
      { pubDate: '2024-06-15' },
      { pubDate: '2024-03-10' },
    ]);
    const result = getPublishedPosts(posts);
    expect(result[0].id).toBe('post-1'); // Jun 15
    expect(result[1].id).toBe('post-2'); // Mar 10
    expect(result[2].id).toBe('post-0'); // Jan 1
  });

  it('returns empty array for empty input', () => {
    expect(getPublishedPosts([])).toEqual([]);
  });

  it('returns empty array when all posts are drafts', () => {
    const posts = makePosts([
      { draft: true, pubDate: '2024-01-01' },
      { draft: true, pubDate: '2024-02-01' },
    ]);
    expect(getPublishedPosts(posts)).toEqual([]);
  });
});
