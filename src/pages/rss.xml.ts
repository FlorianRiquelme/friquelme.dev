import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { getPublishedPosts } from '../utils/blog';

export async function GET(context: APIContext) {
  const posts = getPublishedPosts(await getCollection('blog'));

  return rss({
    title: 'friquelme.dev blog',
    description: 'Thoughts on code, systems, and building things that work',
    site: context.site!,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: `/blog/${post.id}/`,
    })),
  });
}
