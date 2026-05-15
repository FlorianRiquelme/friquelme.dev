import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, it, expect } from 'vitest';
import ProjectCard from '../../src/components/content/ProjectCard.astro';

const baseProps = {
  title: 'claudefuel',
  description: '// status bar',
  link: 'https://github.com/FlorianRiquelme/claudefuel',
};

describe('ProjectCard postLink', () => {
  it('renders an internal link to the companion blog post when postLink is provided', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(ProjectCard, {
      props: { ...baseProps, postLink: '/blog/designing-for-the-operator/' },
    });

    expect(html).toContain('href="/blog/designing-for-the-operator/"');
    expect(html).toContain('read_post');
  });

  it('omits the post link when postLink is not provided', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(ProjectCard, { props: baseProps });

    expect(html).not.toContain('read_post');
    expect(html).not.toContain('/blog/');
  });
});
