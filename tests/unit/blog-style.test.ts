import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const blogDir = fileURLToPath(new URL('../../src/blog/', import.meta.url));
const mdxFiles = readdirSync(blogDir).filter((f) => f.endsWith('.mdx'));

describe('blog heading case (DESIGN.md: Lowercase Default)', () => {
  it.each(mdxFiles)('%s starts every H2/H3 with a lowercase character', (file) => {
    const raw = readFileSync(join(blogDir, file), 'utf-8');
    const offenders: string[] = [];
    for (const line of raw.split('\n')) {
      const match = line.match(/^#{2,3}\s+(.+)$/);
      if (!match) continue;
      const first = match[1][0];
      if (first !== first.toLowerCase()) {
        offenders.push(line);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('shipped copy bans em dashes (PRODUCT.md hard ban)', () => {
  const srcDir = fileURLToPath(new URL('../../src/', import.meta.url));
  function walk(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) out.push(...walk(full));
      else if (/\.(mdx|astro|ts|tsx)$/.test(entry.name)) out.push(full);
    }
    return out;
  }
  const sourceFiles = walk(srcDir);

  it.each(sourceFiles)('%s contains no U+2014', (file) => {
    const raw = readFileSync(file, 'utf-8');
    const offenders = raw.split('\n')
      .map((line, i) => ({ line, i: i + 1 }))
      .filter(({ line }) => line.includes('—'));
    expect(offenders).toEqual([]);
  });
});
