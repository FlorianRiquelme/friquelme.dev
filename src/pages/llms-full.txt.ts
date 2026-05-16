import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { getPublishedPosts } from '../utils/blog';

// Emits raw MDX bodies (JSX literals like <Callout> are kept verbatim, LLMs tolerate them).
export async function GET(_context: APIContext) {
  const posts = getPublishedPosts(await getCollection('blog'));

  const sections = posts.map((post) => {
    const tags = post.data.tags.join(', ');
    const date = post.data.pubDate.toISOString().slice(0, 10);
    const header = [
      `# ${post.data.title}`,
      '',
      `> ${post.data.description}`,
      `> tags: ${tags}`,
      `> published: ${date}`,
      '',
    ].join('\n');
    return `${header}${post.body ?? ''}`.trimEnd();
  });

  return new Response(sections.join('\n\n---\n\n') + '\n', {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
