// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import icon from 'astro-icon';
import mdx from '@astrojs/mdx';
import { remarkReadingTime } from './src/plugins/remark-reading-time.mjs';

// https://astro.build/config
export default defineConfig({
  site: 'https://friquelme.dev',
  compressHTML: true,
  prefetch: true,
  vite: {
    plugins: [tailwindcss()],
  },
  integrations: [icon(), mdx()],
  markdown: {
    shikiConfig: {
      theme: 'github-dark-default',
      wrap: true,
    },
    remarkPlugins: [remarkReadingTime],
  },
});
