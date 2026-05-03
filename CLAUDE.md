# Portfolio — Claude Code Instructions

## Quick Context

Astro 5 static site with a portfolio homepage and a blog. Tailwind CSS 4, deployed to AWS via GitHub Actions. Site: https://friquelme.dev — repo is public.

## Design Context

Strategic and visual context lives in two files at the project root. **Read these before any design work.**

- `PRODUCT.md` — register, users, product purpose, brand personality, anti-references, design principles, accessibility bar. The strategic source of truth.
- `DESIGN.md` — Stitch-format visual system: tokens (colors, typography, rounded, spacing), six-section spec, named rules. The visual source of truth.
- `DESIGN.json` — machine-readable sidecar with tonal ramps, motion tokens, and self-contained component snippets. Used by the impeccable live panel; do not hand-edit.

Quick anchors for agents:
- **Register:** `brand` (personal portfolio + manifesto blog; design IS the product).
- **Position:** brownfield AI engineer for AI-enabled (not AI-native) companies.
- **North Star:** "The Operator's Console" — terminal-native, restraint as authority.
- **Eight named rules** govern the spec (One Voice, Tonal Ladder, Twin-Gray, Lowercase Default, Comment-as-Caption, Prompt-as-Heading, Flat-by-Default, Glow-Means-Interactive). See DESIGN.md.
- **Hard bans:** side-stripe borders >1px, gradient text, glassmorphism, hero-metric templates, em dashes in shipped copy, `#000` / `#fff`.

Regenerate via `$impeccable teach` (PRODUCT.md) or `$impeccable document` (DESIGN.md + DESIGN.json) when the system shifts. Never edit DESIGN.json by hand.

## Commands

- `pnpm dev` — local dev server at localhost:4321
- `pnpm build` — build to `./dist/` (use this to verify changes compile)
- `pnpm preview` — preview production build locally
- `pnpm test` — run Vitest unit + Astro Container tests
- `pnpm test:mutation` — Stryker mutation tests on `src/lib/seo.ts` + `src/lib/security/csp.ts`
- `pnpm test:infra` — run CDK assertion tests in `infra/`

## Architecture

Multi-page static site with two main areas:

- **Portfolio** (`src/pages/index.astro`) — four scroll sections: hero (#about), skills (#skills), projects (#projects), contact (#contact)
- **Blog** (`src/pages/blog/`) — listing page (`index.astro`) and dynamic post pages (`[slug].astro`). Posts are MDX files in `src/blog/` using Astro content collections.

All components are `.astro` files (no client-side framework). Client-side JS is minimal and inline — a typing animation in the hero and an IntersectionObserver for scroll-triggered animations.

### Component Organization

- `src/components/content/` — domain components (ProjectCard, SkillBar, TerminalWindow, SectionHeader)
- `src/components/blog/` — blog components (BlogPostCard, BlogFeaturedCard, ArticleHero, Callout, TableOfContents, AuthorCard, PostNavigation, RelatedPosts)
- `src/components/ui/` — generic primitives (Badge, ButtonPrimary, ButtonSecondary, ButtonGhost, ButtonSmall, Tag, Divider, StatusIndicator)
- `src/components/nav/` — navigation (HeaderBar, Footer, Logo, NavItem)
- `src/components/forms/` — form inputs (InputGroup, SearchField, TextareaGroup)

## Styling

Tailwind CSS 4 with a custom dark theme. Tokens are declared in `@theme` blocks inside `src/styles/global.css` (utilities like `bg-bg-page`, `text-text-primary`, `text-green-primary`, `border-border-primary`, `font-mono`). For the canonical token list, naming, role assignments, and named rules, see `DESIGN.md` — do not duplicate values here.

### Animations

- `data-animate` attribute + `is-visible` class triggers `fadeInUp` via IntersectionObserver
- `stagger-1`, `stagger-2`, `stagger-3` classes for cascading delays
- `data-animate-skill` for skill bar width transitions
- Always respect `prefers-reduced-motion` — existing CSS handles this

## Infrastructure (infra/)

AWS CDK stacks in TypeScript. Separate `package.json` with its own dependencies.

- `static-site-stack.ts` — S3 bucket, CloudFront distribution, Route53 DNS, ACM certificate
- `github-oidc-stack.ts` — IAM role for GitHub Actions deploys via OIDC

CDK changes are deployed manually, not through CI. Don't modify infra unless explicitly asked.

## Conventions

- All commits in English
- pnpm only (not npm or yarn)
- Astro components use TypeScript for props interfaces
- Images go through Astro's `<Picture>` component for automatic optimization (AVIF/WebP)
- Project images are SVGs in `src/assets/images/`
- Blog posts are `.mdx` files in `src/blog/` with frontmatter (title, description, pubDate, author, heroImage, tags)
- Tests live in `tests/` (unit + Astro Container) and `infra/test/` (CDK assertions). Run `pnpm test` and `pnpm test:infra` before commits
