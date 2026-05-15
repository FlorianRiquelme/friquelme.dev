// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import icon from 'astro-icon';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { remarkReadingTime } from './src/plugins/remark-reading-time.mjs';
import { loadPostsFromDir, serializeSitemapEntry } from './src/plugins/sitemap-serialize.mjs';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import { h } from 'hastscript';

const postsBySlug = loadPostsFromDir(new URL('./src/blog/', import.meta.url));

// https://astro.build/config
export default defineConfig({
  site: 'https://friquelme.dev',
  trailingSlash: 'always',
  build: { format: 'directory' },
  compressHTML: true,
  prefetch: true,
  vite: {
    plugins: [tailwindcss()],
  },
  integrations: [
    icon(),
    mdx({
      rehypePlugins: [
        rehypeSlug,
        [
          rehypeAutolinkHeadings,
          {
            behavior: 'append',
            properties: {
              className: ['heading-anchor'],
              ariaHidden: 'true',
              tabIndex: -1
            },
            content: () => [h('span.anchor-icon', '#')],
          },
        ],
      ],
    }),
    sitemap({
      serialize(item) {
        return serializeSitemapEntry(item, postsBySlug);
      },
    })
  ],
  markdown: {
    shikiConfig: {
      theme: 'github-dark-default',
      wrap: true,
    },
    remarkPlugins: [remarkReadingTime],
  },
});
