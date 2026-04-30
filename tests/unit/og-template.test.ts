import { describe, it, expect } from 'vitest';
import { buildOgImageHtml } from '../../src/lib/og/template';

describe('buildOgImageHtml', () => {
  it('renders the title in the output for the home variant', () => {
    const html = buildOgImageHtml({ kind: 'home', title: 'friquelme.dev' });
    expect(html).toContain('friquelme.dev');
  });

  it('uses the bg-page color (#0C0C0C) as the canvas background', () => {
    const html = buildOgImageHtml({ kind: 'home', title: 't' });
    expect(html).toContain('#0C0C0C');
  });

  it('uses the green-primary accent (#22C55E) somewhere in the layout', () => {
    const html = buildOgImageHtml({ kind: 'home', title: 't' });
    expect(html).toContain('#22C55E');
  });

  it('renders a footer path of "~/" for the home variant', () => {
    const html = buildOgImageHtml({ kind: 'home', title: 't' });
    expect(html).toContain('~/');
    expect(html).not.toContain('/blog/');
    expect(html).not.toContain('/projects/');
  });

  it('renders a footer path of "~/blog/<slug>" for the post variant', () => {
    const html = buildOgImageHtml({
      kind: 'post',
      title: 'Hello',
      slug: 'hello-world',
    });
    expect(html).toContain('~/blog/hello-world');
  });

  it('renders a footer path of "~/projects/<slug>" for the project variant', () => {
    const html = buildOgImageHtml({
      kind: 'project',
      title: 'Project X',
      slug: 'project-x',
    });
    expect(html).toContain('~/projects/project-x');
  });

  it('escapes ampersand in titles to prevent broken HTML parsing', () => {
    const html = buildOgImageHtml({ kind: 'home', title: 'A & B' });
    expect(html).toContain('A &amp; B');
    expect(html).not.toContain('A & B');
  });

  it('escapes angle brackets in titles', () => {
    const html = buildOgImageHtml({ kind: 'home', title: '<script>' });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
