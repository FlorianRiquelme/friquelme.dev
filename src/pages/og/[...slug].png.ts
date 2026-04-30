import type { APIRoute, GetStaticPaths } from 'astro';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import satori from 'satori';
import { html } from 'satori-html';
import sharp from 'sharp';
import { buildOgImageHtml, type OgImageInput } from '../../lib/og/template';

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
  return [
    {
      params: { slug: 'index' },
      props: { kind: 'home', title: 'friquelme.dev' } satisfies OgImageInput,
    },
  ];
};

export const GET: APIRoute = async ({ props }) => {
  const input = props as OgImageInput;
  const fontData = await loadFontData();
  const node = html(buildOgImageHtml(input));
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
