import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const siteOrigin = 'https://friquelme.dev';
const sitemap = readFileSync(resolve('dist/sitemap-0.xml'), 'utf8');
export const routes = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => new URL(match[1]).pathname);
if (!routes.includes('/') || !routes.includes('/blog/') || routes.length < 3) {
  throw new Error('Built sitemap must include the homepage, blog and published articles; run pnpm build first');
}
export const articles = routes.filter(route => route.startsWith('/blog/') && route !== '/blog/');
