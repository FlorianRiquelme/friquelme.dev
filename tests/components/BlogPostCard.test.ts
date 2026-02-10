import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, it, expect } from 'vitest';
import BlogPostCard from '../../src/components/blog/BlogPostCard.astro';

describe('BlogPostCard', () => {
  const baseProps = {
    title: 'Test Post Title',
    description: 'A description of the test post.',
    pubDate: new Date('2024-06-15'),
    tags: ['astro', 'testing', 'vitest'],
    slug: 'test-post',
  };

  it('renders title, description, and link', async () => {
    const container = await AstroContainer.create();
    const result = await container.renderToString(BlogPostCard, { props: baseProps });

    expect(result).toContain('Test Post Title');
    expect(result).toContain('A description of the test post.');
    expect(result).toContain('/blog/test-post');
  });

  it('renders formatted date', async () => {
    const container = await AstroContainer.create();
    const result = await container.renderToString(BlogPostCard, { props: baseProps });

    expect(result).toContain('Jun');
    expect(result).toContain('2024');
  });

  it('limits displayed tags to 2', async () => {
    const container = await AstroContainer.create();
    const result = await container.renderToString(BlogPostCard, { props: baseProps });

    expect(result).toContain('astro');
    expect(result).toContain('testing');
    expect(result).not.toContain('vitest');
  });

  it('renders reading time when provided', async () => {
    const container = await AstroContainer.create();
    const result = await container.renderToString(BlogPostCard, {
      props: { ...baseProps, readingTime: '5 min read' },
    });

    expect(result).toContain('5 min read');
  });

  it('does not render reading time when not provided', async () => {
    const container = await AstroContainer.create();
    const result = await container.renderToString(BlogPostCard, { props: baseProps });

    expect(result).not.toContain('min read');
  });

  it('shows fallback when heroImage is not provided', async () => {
    const container = await AstroContainer.create();
    const result = await container.renderToString(BlogPostCard, { props: baseProps });

    expect(result).not.toContain('<picture');
    expect(result).toContain('bg-bg-input');
  });
});
