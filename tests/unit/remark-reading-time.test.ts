import { describe, it, expect } from 'vitest';
import { remarkReadingTime } from '../../src/plugins/remark-reading-time.mjs';

function makeTree(text: string) {
  return { type: 'root', children: [{ type: 'text', value: text }] };
}

function runPlugin(text: string) {
  const tree = makeTree(text);
  const data: { astro: { frontmatter: Record<string, unknown> } } = {
    astro: { frontmatter: {} },
  };
  const plugin = remarkReadingTime();
  plugin(tree, { data });
  return data.astro.frontmatter.readingTime as string;
}

describe('remarkReadingTime', () => {
  it('attaches readingTime to frontmatter', () => {
    const result = runPlugin('Hello world');
    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
  });

  it('returns "1 min read" for short content', () => {
    const result = runPlugin('A short paragraph.');
    expect(result).toBe('1 min read');
  });

  it('returns longer reading time for long content', () => {
    const longText = 'word '.repeat(1000);
    const result = runPlugin(longText);
    expect(result).toMatch(/\d+ min read/);
    const minutes = parseInt(result);
    expect(minutes).toBeGreaterThan(1);
  });
});
