import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import satori from 'satori';
import { html } from 'satori-html';
import sharp from 'sharp';
import { buildOgImageHtml, type OgImageInput } from '../../lib/og/template';
import { getPublishedPosts } from '../../utils/blog';
// @ts-expect-error — Vite ?inline returns a base64 data URI string
import bgDataUri from '../../assets/og/bg.png?inline';

const FONT_URL = new URL(
  '../../../node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff',
  import.meta.url,
);

let cachedFontData: ArrayBuffer | null = null;
async function loadFontData(): Promise<ArrayBuffer> {
  if (cachedFontData) return cachedFontData;
  const buf = await readFile(fileURLToPath(FONT_URL));
  cachedFontData = buf.buffer.slice(
    buf.byteOffset,
    buf.byteOffset + buf.byteLength,
  ) as ArrayBuffer;
  return cachedFontData;
}

export const getStaticPaths: GetStaticPaths = async () => {
  const posts = getPublishedPosts(await getCollection('blog'));

  return [
    {
      params: { slug: 'index' },
      props: { kind: 'home', title: 'friquelme.dev' } satisfies OgImageInput,
    },
    ...posts.map((post) => ({
      params: { slug: post.id },
      props: {
        kind: 'post',
        title: post.data.title,
        slug: post.id,
      } satisfies OgImageInput,
    })),
  ];
};

export const GET: APIRoute = async ({ props }) => {
  const input = props as OgImageInput;
  const fontData = await loadFontData();
  const node = html(buildOgImageHtml(input, bgDataUri));
  const svg = await satori(node, {
    width: 1200,
    height: 630,
    fonts: [
      {
        name: 'JetBrains Mono',
        data: fontData,
        weight: 400,
        style: 'normal',
      },
    ],
  });
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return new Response(png, {
    headers: { 'Content-Type': 'image/png' },
  });
};
