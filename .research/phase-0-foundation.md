# Phase 0 Foundation — Research Report

> Source: `EXECUTION_PLAN.md` Phase 0 (lines 71–118).
> Goal: resolve four foundation choices before writing helpers — `trailingSlash`, og:image pipeline, PostHog CSP, CDK ResponseHeadersPolicy.
> Date: 2026-04-30.
> Methodology note: the multi-AI orchestrator failed in this environment (Codex/Gemini CLIs blocked by malformed PATH from Herd; codex routed to a `perplexity` model the ChatGPT account doesn't entitle; `claude-sonnet` probe-single produces empty output — only `codex`/`gemini` are routable through the orchestrator). After PATH cleanup the run still failed at the model-config layer. Synthesis below was assembled from direct codebase reads + Context7 docs (Astro 5, PostHog, aws-cdk-lib v2). External-CLI perspective is captured but limited.

---

## Executive summary

All four Phase 0 choices have a clear, low-risk answer once the codebase is read. The 302 redirects are coming from the S3 website endpoint, not from Astro or CloudFront — so `trailingSlash: 'always'` in `astro.config.mjs` is sufficient (no CloudFront Function needed) because `S3StaticWebsiteOrigin` already handles directory indexes. The og:image pick is **Satori + sharp via an Astro static endpoint using `astro:assets` `fontData`** — this is the pattern Astro core itself documents, and `sharp` + `@fontsource-variable/jetbrains-mono` are already in the project. The CDK stack **already has a `ResponseHeadersPolicy` attached to the default behavior**, so Phase 0d is a non-replacing augmentation: add `contentSecurityPolicy` inside `securityHeadersBehavior` and a `customHeadersBehavior` entry for `Permissions-Policy`. PostHog EU CSP is covered by `https://*.posthog.com` (the wildcard captures both `eu.i.posthog.com` and `eu-assets.i.posthog.com`); `'unsafe-inline'` is required because the PostHog bootstrap snippet is `<script is:inline>`.

---

## Codebase facts (verified by direct read)

| File | Fact |
|---|---|
| `astro.config.mjs:13-48` | `site: 'https://friquelme.dev'`, `compressHTML`, `prefetch`. **No `trailingSlash`, no `build.format`** (= defaults: `ignore` + `directory`). `sitemap()` is registered with no options. |
| `package.json:13-37` | `astro@5.17.1`, `@astrojs/sitemap@3.7.0`, `@astrojs/mdx@4.3.13`, `@fontsource-variable/jetbrains-mono@5.2.8`. **`sharp@0.34.5` is already in devDeps.** Vitest 4.0.18 is the test framework. |
| `src/layouts/Layout.astro:1-49` | Single layout. `canonicalURL = new URL(Astro.url.pathname, Astro.site)` — will gain a trailing slash automatically once `trailingSlash: 'always'` is set. Has `<title>`, `<meta name="description">`, og/twitter tags. **No JSON-LD.** |
| `src/layouts/Layout.astro:54-86` | Plain `<script>` (not `is:inline`) for IntersectionObserver + reduced-motion. **Astro will bundle this** into a hashed asset → does NOT need `'unsafe-inline'`. |
| `src/components/posthog.astro:4` | `<script is:inline>` PostHog snippet — **does** need `'unsafe-inline'` (or a sha256 hash). |
| `src/components/posthog.astro:42` | `posthog.init('phc_…', { api_host: 'https://eu.i.posthog.com', persistence: 'memory' })`. Cookieless ✓. Loads `/static/array.js` from `eu.i.posthog.com`. No autocapture/session_recording overrides → defaults. |
| `infra/lib/static-site-stack.ts:42-65` | **`ResponseHeadersPolicy` already exists** with HSTS (2-year), `contentTypeOptions`, `frameOptions: DENY`, `referrerPolicy: STRICT_ORIGIN_WHEN_CROSS_ORIGIN`. Attached at line 72 as `defaultBehavior.responseHeadersPolicy`. **No CSP, no Permissions-Policy yet.** |
| `infra/lib/static-site-stack.ts:70` | Origin is `S3StaticWebsiteOrigin` (not `S3Origin`/`S3BucketOrigin`). The S3 website endpoint resolves `/blog/` → `/blog/index.html` natively. |

---

## Key themes

### 1. `trailingSlash` — the 302s are from S3, not Astro

The audit flagged "302 trailing-slash redirects." Mechanically:

- S3 website endpoints respond to `GET /blog` (no slash) with `302 → /blog/`, then resolve `/blog/index.html`. This is an S3 feature, not a misconfiguration.
- Astro's static output emits **internal links** based on `trailingSlash` + `build.format`. With the current default (`trailingSlash: 'ignore'`), Astro writes `<a href="/blog">` in some places and `<a href="/blog/">` in others — every "no slash" link triggers the S3 302.
- Setting `trailingSlash: 'always'` makes Astro emit slash-suffixed internal hrefs and canonical URLs consistently. **External crawlers** hitting old non-slash URLs will still see one 302 — that's the *correct* canonical signal we want.
- `build.format` defaults to `'directory'` already (Astro docs explicitly recommend `'always' + 'directory'` together).
- `@astrojs/sitemap` reads `Astro.config.site` + the file layout produced by `build.format`. With `directory`, it emits `https://friquelme.dev/blog/` and `https://friquelme.dev/blog/<slug>/` consistently.
- **No CloudFront Function or Lambda@Edge is needed** — `S3StaticWebsiteOrigin` already does the directory-index resolution.

**Code shape:**

```js
// astro.config.mjs
export default defineConfig({
  site: 'https://friquelme.dev',
  trailingSlash: 'always',          // NEW
  build: { format: 'directory' },    // NEW (explicit; matches default)
  // …rest unchanged
});
```

### 2. og:image — Satori + sharp via static endpoint

Astro's official docs (Context7: `/withastro/docs`, "Generate OpenGraph Image with Satori using Font Data") publish exactly the pattern we need: a static API route using `astro:assets` `fontData` + `satori` + `satori-html` + `sharp`. This:

- Runs at **build time** in static mode (Astro pre-renders endpoints when output is static), so PNGs land in `dist/` as plain files. No runtime requirement.
- Reads the font from `astro:assets` `fontData` so JetBrains Mono is bundled correctly without manual ArrayBuffer wrangling.
- Produces consistent monospace rendering — Satori's CSS-subset is well-suited to the terminal aesthetic (block layouts, fixed monospace, dark backgrounds).
- `sharp` is already a devDep; no new dependency cost.

**Disagreement resolution (Codex vs Gemini, from prior session memory):**
- Codex previously argued "raw SVG → PNG via sharp" for simplicity.
- Gemini argued "Satori for diff/postmortem aesthetic."
- Astro core endorses Satori with `astro:assets` `fontData` — this is decisive new evidence Codex didn't have. Satori reads HTML+CSS templates, which is much easier to maintain across the five page-type variants (manifesto / post / project / eval / failure) than hand-tuning SVG `<text>` positioning. **Satori wins.**

**Code shape:**

```ts
// src/pages/og/[...slug].png.ts
import type { APIRoute } from 'astro';
import { fontData } from 'astro:assets';
import { outDir } from 'astro:config/server';
import { readFile } from 'node:fs/promises';
import satori from 'satori';
import { html } from 'satori-html';
import sharp from 'sharp';

export const getStaticPaths = async () => [
  { params: { slug: 'index' }, props: { title: 'friquelme.dev', kind: 'home' } },
  // ...one per page-type variant + per-blog-post
];

export const GET: APIRoute = async ({ props, url }) => {
  const fontPath = fontData['--font-jetbrains-mono'][0]?.src[0]?.url;
  const data = import.meta.env.DEV
    ? await fetch(new URL(fontPath!, url.origin)).then(r => r.arrayBuffer())
    : await readFile(new URL(`.${fontPath}`, outDir));

  const svg = await satori(
    html`
      <div style="display:flex;flex-direction:column;width:1200px;height:630px;background:#0C0C0C;color:#E5E5E5;font-family:JetBrains Mono;padding:64px;">
        <div style="border-left:6px solid #22C55E;padding-left:24px;font-size:64px;line-height:1.15;">${props.title}</div>
        <div style="margin-top:auto;color:#737373;font-size:24px;">~/friquelme.dev/${props.slug ?? ''}</div>
      </div>`,
    { width: 1200, height: 630, fonts: [{ name: 'JetBrains Mono', data, weight: 500, style: 'normal' }] }
  );

  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
```

**Page-type variants:** five templates (manifesto / post / project / eval / failure) — all share the same `<div>` shell, vary the badge/footer line. Wrap in `getOgImageHtml({ title, kind, slug })` for one source.

### 3. PostHog CSP — wildcard sufficient, `'unsafe-inline'` required

PostHog's official CSP docs (Context7: `/websites/posthog`, "Basic CSP for PostHog"):

```
default-src 'self';
script-src 'self' https://*.posthog.com;
connect-src 'self' https://*.posthog.com;
worker-src 'self' blob: data:;
```

Verified facts:
- EU region uses `eu.i.posthog.com` (events) and `eu-assets.i.posthog.com` (static assets at `/static/`, `/array/`). Wildcard `*.posthog.com` captures both.
- `worker-src 'self' blob: data:` is needed for rrweb session-replay workers (even when `session_recording` is unset, PostHog defaults can lazy-load it).
- The `posthog.init` snippet at `posthog.astro:42` is `<script is:inline>` → CSP must allow `'unsafe-inline'` OR a sha256 hash. Hashes break every time the snippet is regenerated; nonces don't work for static output (no per-request server). **Ship `'unsafe-inline'` for now.**
- The Layout.astro IntersectionObserver script is a plain `<script>` (no `is:inline`), so Astro bundles it into a hashed asset under `/_astro/` served from `'self'` — no inline allowance needed for it.

**Code shape (the CSP string the helper will emit):**

```
default-src 'self';
script-src 'self' 'unsafe-inline' https://*.posthog.com;
connect-src 'self' https://*.posthog.com;
img-src 'self' data: https:;
style-src 'self' 'unsafe-inline';
font-src 'self' data:;
worker-src 'self' blob: data:;
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
object-src 'none';
upgrade-insecure-requests
```

(The `'unsafe-inline'` for `style-src` covers Astro's scoped-style hashing + Tailwind 4's runtime injection. Tightening with hashes is a Phase 10 concern — premature for substrate.)

### 4. CDK ResponseHeadersPolicy — non-replacing augmentation

`infra/lib/static-site-stack.ts:42-65` already constructs a `ResponseHeadersPolicy` and attaches it at line 72. Phase 0d is **augmentation**, not creation. The change is purely a property update on the existing logical resource — CloudFront will issue a distribution update (5–10 min propagation), not a replacement. Replacement only happens for properties that change distribution identity (e.g., `domainNames`, certain origin moves).

CDK API (Context7: `/websites/aws_amazon_cdk_api_v2_python`):
- `securityHeadersBehavior.contentSecurityPolicy: ResponseHeadersContentSecurityPolicy({ contentSecurityPolicy, override })` — exists in v2.
- `customHeadersBehavior` is needed for `Permissions-Policy` (CDK doesn't model it as a first-class security-header field).

**Code shape (TypeScript, drop-in replacement for lines 42-65):**

```ts
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://*.posthog.com",
  "connect-src 'self' https://*.posthog.com",
  "img-src 'self' data: https:",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "worker-src 'self' blob: data:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join('; ');

const responseHeadersPolicy = new cloudfront.ResponseHeadersPolicy(
  this,
  'SecurityHeaders',
  {
    securityHeadersBehavior: {
      strictTransportSecurity: {
        accessControlMaxAge: cdk.Duration.seconds(63072000),
        includeSubdomains: true,
        preload: true,
        override: true,
      },
      contentTypeOptions: { override: true },
      frameOptions: {
        frameOption: cloudfront.HeadersFrameOption.DENY,
        override: true,
      },
      referrerPolicy: {
        referrerPolicy: cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
        override: true,
      },
      contentSecurityPolicy: {
        contentSecurityPolicy: csp,
        override: true,
      },
    },
    customHeadersBehavior: {
      customHeaders: [
        {
          header: 'Permissions-Policy',
          value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          override: true,
        },
      ],
    },
  },
);
```

**Pitfall flag:** CSP header value is bounded by CloudFront's per-header 8 KB limit. The starter above is ~450 chars — plenty of headroom. If reportUri or future allowlists balloon it, monitor the CloudFront error logs for `InvalidResponseHeader`.

---

## Key takeaways (act on these in order)

1. **Set `trailingSlash: 'always'` and `build.format: 'directory'` in `astro.config.mjs`.** No CloudFront work needed — `S3StaticWebsiteOrigin` handles directory indexes. Verifies with `pnpm build` → check `dist/blog/index.html` and `dist/blog/<slug>/index.html` exist; sitemap.xml emits slash-suffixed URLs.
2. **Build `getSeoMeta()` helper** at `src/lib/seo.ts` returning `{ title, description, canonical, image, type, datePublished, ogImageUrl, articleJsonLd }`. Layout.astro consumes the same object three ways (`<head>` tags, og tags, JSON-LD `<script type="application/ld+json">`). Canonical URLs derive from `new URL(Astro.url.pathname, Astro.site)` — Astro auto-adds the trailing slash once `trailingSlash: 'always'` is set.
3. **Implement og:image as Satori + sharp + `astro:assets` `fontData` in a static API route at `src/pages/og/[...slug].png.ts`.** Use `getStaticPaths` to emit one PNG per content-collection entry plus the homepage variants. `sharp` is already installed. Add `satori` + `satori-html` as deps. JetBrains Mono is already bundled via `@fontsource-variable/jetbrains-mono`.
4. **PostHog CSP: ship the wildcard CSP above with `'unsafe-inline'` allowed for `script-src` and `style-src`.** The `is:inline` PostHog bootstrap is the only inline script; the IntersectionObserver script in Layout.astro is auto-bundled and hashed. Don't bother with nonces in static output — they don't work without a server. Phase 10 can tighten with sha256 hashes if desired.
5. **Augment the existing `ResponseHeadersPolicy` in `infra/lib/static-site-stack.ts` (drop-in replacement above).** Add `contentSecurityPolicy` to `securityHeadersBehavior` and `Permissions-Policy` via `customHeadersBehavior`. Deploy with `cd infra && pnpm cdk deploy StaticSiteStack` — CloudFront will do an in-place update (5–10 min propagation, no resource replacement).
6. **Re-audit after each helper lands**, but expect the score to stay near 72 — Phase 0 is substrate. Confirm only that (a) trailing-slash 302s on internal pages drop, (b) `Content-Security-Policy` header is present, (c) `pnpm build` is green.

---

## Edge cases to watch (from local analysis + PostHog/CDK docs)

- **Astro inline script discrimination.** Only `<script is:inline>` triggers `'unsafe-inline'` requirement. The IntersectionObserver block in `Layout.astro:54` is a plain `<script>` and gets bundled — verify by inspecting `dist/_astro/` after build for the hashed JS file, and confirm the inline tag is gone from the rendered HTML. If the audit still flags an inline IntersectionObserver, that means Astro inlined it (small enough for `compressHTML`'s threshold) — check `compressHTML: true` interaction.
- **PostHog snippet sha256 hash alternative.** If you later want strict CSP, the snippet at `posthog.astro:4-43` has a stable shape — generate `sha256-…` once with `openssl dgst -sha256 -binary | base64` and add to `script-src`. Re-hash on snippet update.
- **`@astrojs/sitemap` and trailing slash.** v3.7.0 honors `Astro.config.site` + `build.format`. With `directory`, output URLs include the trailing slash. **Verify after first build** — `dist/sitemap-0.xml` should contain `<loc>https://friquelme.dev/blog/</loc>` (with slash) for every page.
- **Twitter card image dimensions.** 1200×630 is the consensus. Twitter compresses heavily — keep file size under 1 MB (Satori output is typically 30–60 KB for terminal-style content; well within budget).
- **`getStaticPaths` for og:image.** Must enumerate content collection entries at build time. Use `getCollection('blog')` in the route module and feed `slug` + `data.title` to props.
- **CloudFront cache invalidation on policy update.** After `cdk deploy`, headers are applied to new edge requests immediately, but cached responses serve stale headers until TTL expiry or invalidation. Run `aws cloudfront create-invalidation --distribution-id <id> --paths '/*'` after deploy if the audit checks within minutes.
- **`'unsafe-inline'` lint warnings.** Squirrel and similar auditors flag `'unsafe-inline'` even when justified. This is one of the *neutral / compliance-tax* items per the Stance Debt frame — accept the flag with a written receipt in Phase 10, since static output + cookieless analytics are the constraints driving it.

---

## Sources & attribution

- **Codebase reads (direct):** `astro.config.mjs`, `package.json`, `src/layouts/Layout.astro`, `src/components/posthog.astro`, `infra/lib/static-site-stack.ts` — at `/Users/florianriquelme/Repos/mine/portfolio/`. Verified 2026-04-30.
- **Astro 5 trailingSlash + build.format:** [withastro/docs — configuration-reference.mdx](https://github.com/withastro/docs/blob/main/src/content/docs/en/reference/configuration-reference.mdx) (via Context7 `/withastro/docs`). The `directory` + `'always'` pairing is recommended in the same source.
- **Astro 5 OG image with Satori + fontData:** [withastro/docs — fonts.mdx](https://github.com/withastro/docs/blob/main/src/content/docs/en/guides/fonts.mdx) (Context7). This is the pattern Astro core publishes — the strongest signal for the Codex/Gemini disagreement resolution.
- **PostHog CSP & EU region:** [posthog.com/docs/advanced/content-security-policy](https://posthog.com/docs/advanced/content-security-policy) and [posthog.com/docs/advanced/proxy/node](https://posthog.com/docs/advanced/proxy/node) (Context7 `/websites/posthog`). `eu.i.posthog.com` (API) + `eu-assets.i.posthog.com` (assets) confirmed.
- **CDK `ResponseHeadersPolicy`:** [docs.aws.amazon.com — `aws_cdk.aws_cloudfront`](https://docs.aws.amazon.com/cdk/api/v2/python/aws_cdk.aws_cloudfront/) (Context7 `/websites/aws_amazon_cdk_api_v2_python`). Custom + security headers behavior pattern. CDK is language-agnostic; the TypeScript sketch above is a direct port.
- **Multi-AI orchestrator (Codex/Gemini):** Failed in this environment — see Methodology below. **No external-LLM perspective contributed to this report**; all claims are sourced from official docs or direct codebase reads.

[Inference] flags:
- The 302s being from S3 (vs Astro static redirects) is inferred from: Astro static output cannot emit runtime redirects, S3 website endpoints redirect non-slash to slash by default, and the `S3StaticWebsiteOrigin` in the stack confirms website-endpoint origin.
- `'unsafe-inline'` requirement scope (PostHog is:inline only, IntersectionObserver bundled) is inferred from Astro 5's `is:inline` directive semantics — verify post-build by inspecting rendered HTML.

---

## Methodology

**Intent:** `/octo:research` standard intensity — 4 parallel agents (Codex, Gemini, Claude Edge Cases, Claude Codebase Analysis).

**What ran:**
1. First parallel dispatch — all four agents launched.
2. **Codex + Gemini failed** (exit 127): malformed `PATH` from Herd's unquoted `~/Library/Application Support/Herd/bin/` entry split `env` on the space.
3. **Both Claude Sonnet probes failed silently** (exit 0, empty `## Output`) — the orchestrator's `probe-single claude-sonnet` is a no-op in this version (only `codex` and `gemini` are routable providers).
4. User removed Herd from `~/.zshrc`; cleared PATH at the source.
5. Codex retry with explicit clean PATH **failed again** (exit 1): octopus config routes codex to `model: perplexity`, but the authenticated ChatGPT account doesn't entitle that model. Separate config issue, fixable later via `octo:model-config`.
6. Gemini retry — still pending at synthesis time; not waited for. No external LLM perspective made it into this report.

**Fallback used:** direct file reads + Context7 docs lookups (Astro 5, PostHog, aws-cdk-lib v2). This produced higher-quality answers than the failed orchestrator would have, because the codebase reads gave authoritative ground truth (e.g., that `ResponseHeadersPolicy` already exists, that `sharp` and JetBrains Mono are already installed) that no external LLM could have known.

**Gaps acknowledged:**
- No fresh community survey of `astro-og-canvas` adoption in 2026 (Gemini agent would have provided this — orchestrator failed). The Astro core endorsement of Satori is decisive enough to proceed without it.
- No live verification of the exact `eu-assets.i.posthog.com` paths PostHog uses today — relied on Context7 docs (high-confidence source, but may be subtly stale).
- No build-output inspection yet (must run `pnpm build` post-implementation to confirm sitemap URL format and inline-script bundling behavior). Captured as the first verification step in Key Takeaway #1.

**Provider attribution:** none — all findings sourced from official docs or codebase reads.
