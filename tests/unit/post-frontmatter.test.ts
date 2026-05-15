import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

function loadFrontmatter(slug: string): Record<string, string> {
  const url = new URL(`../../src/blog/${slug}.mdx`, import.meta.url);
  const raw = readFileSync(fileURLToPath(url), 'utf-8');
  const match = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!match) throw new Error(`No frontmatter in ${slug}.mdx`);
  const out: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const m = line.match(/^(\w+):\s*"?(.*?)"?$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

describe('designing-for-the-operator frontmatter', () => {
  const fm = loadFrontmatter('designing-for-the-operator');

  it('has a description short enough to render fully in SERPs (≤155 chars)', () => {
    expect(fm.description.length).toBeLessThanOrEqual(155);
  });

  it('keeps the load-bearing entities: claudefuel, claude code, status bar', () => {
    const desc = fm.description.toLowerCase();
    expect(desc).toContain('claudefuel');
    expect(desc).toContain('claude code');
    expect(desc).toContain('status bar');
  });
});
