export type OgImageInput =
  | { kind: 'home'; title: string }
  | { kind: 'post'; title: string; slug: string }
  | { kind: 'project'; title: string; slug: string };

const COLORS = {
  bg: '#0C0C0C',
  text: '#E5E5E5',
  accent: '#22C55E',
  muted: '#737373',
} as const;

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function footerPath(input: OgImageInput): string {
  switch (input.kind) {
    case 'home':
      return '~/';
    case 'post':
      return `~/blog/${input.slug}`;
    case 'project':
      return `~/projects/${input.slug}`;
  }
}

export function buildOgImageHtml(input: OgImageInput): string {
  const title = escapeHtml(input.title);
  const path = escapeHtml(footerPath(input));

  return `
<div style="display:flex;flex-direction:column;width:1200px;height:630px;background:${COLORS.bg};color:${COLORS.text};font-family:JetBrains Mono;padding:64px;">
  <div style="border-left:6px solid ${COLORS.accent};padding-left:24px;font-size:64px;line-height:1.15;">${title}</div>
  <div style="margin-top:auto;color:${COLORS.muted};font-size:24px;">${path}</div>
</div>
  `.trim();
}
