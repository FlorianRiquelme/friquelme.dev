import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, it, expect } from 'vitest';
import ArticleHero from '../../src/components/blog/ArticleHero.astro';

const baseProps = {
  title: 'Test Post',
  description: 'A test.',
  pubDate: new Date('2026-01-15'),
  author: 'florian riquelme',
  tags: ['test'],
};

describe('ArticleHero updatedDate', () => {
  it('omits the updated label when updatedDate is not provided', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(ArticleHero, { props: baseProps });
    expect(html.toLowerCase()).not.toContain('updated');
  });

  it('omits the updated label when updatedDate equals pubDate', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(ArticleHero, {
      props: { ...baseProps, updatedDate: new Date('2026-01-15') },
    });
    expect(html.toLowerCase()).not.toContain('updated');
  });

  it('renders the updated label with formatted date when updatedDate is after pubDate', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(ArticleHero, {
      props: { ...baseProps, updatedDate: new Date('2026-02-20') },
    });
    expect(html.toLowerCase()).toContain('updated');
    expect(html).toContain('February');
    expect(html).toContain('2026-02-20');
  });
});
