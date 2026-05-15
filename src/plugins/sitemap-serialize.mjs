import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export function serializeSitemapEntry(item, postsBySlug) {
  const match = item.url.match(/\/blog\/([^/]+)\/?$/);
  if (!match) return item;
  const post = postsBySlug[match[1]];
  if (!post) return item;
  const date = post.updatedDate ?? post.pubDate;
  return { ...item, lastmod: date.toISOString() };
}

export function loadPostsFromDir(blogDirUrl) {
  const blogDir = fileURLToPath(blogDirUrl);
  const out = {};
  for (const file of readdirSync(blogDir)) {
    if (!file.endsWith('.mdx')) continue;
    const slug = file.replace(/\.mdx$/, '');
    const raw = readFileSync(path.join(blogDir, file), 'utf-8');
    const fm = raw.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
    const pubMatch = fm.match(/pubDate:\s*([\d-]+)/);
    if (!pubMatch) continue;
    const updatedMatch = fm.match(/updatedDate:\s*([\d-]+)/);
    out[slug] = {
      pubDate: new Date(pubMatch[1]),
      ...(updatedMatch && { updatedDate: new Date(updatedMatch[1]) }),
    };
  }
  return out;
}
