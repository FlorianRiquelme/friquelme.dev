# Portfolio — Claude Code Instructions

## Quick Context

Astro 5 static site, single page (`src/pages/index.astro`), Tailwind CSS 4, deployed to AWS via GitHub Actions. Site: https://friquelme.dev

## Commands

- `pnpm dev` — local dev server at localhost:4321
- `pnpm build` — build to `./dist/` (use this to verify changes compile)
- `pnpm preview` — preview production build locally

## Architecture

Single-page portfolio with four scroll sections: hero (#about), skills (#skills), projects (#projects), contact (#contact).

All components are `.astro` files (no client-side framework). Client-side JS is minimal and inline in the page — a typing animation in the hero and an IntersectionObserver for scroll-triggered animations.

### Component Organization

- `src/components/content/` — domain components (ProjectCard, SkillBar, TerminalWindow, SectionHeader)
- `src/components/ui/` — generic primitives (Badge, ButtonPrimary, ButtonSecondary, ButtonGhost, ButtonSmall, Tag, Divider, StatusIndicator)
- `src/components/nav/` — navigation (HeaderBar, Footer, Logo, NavItem)
- `src/components/forms/` — form inputs (InputGroup, SearchField, TextareaGroup)

## Styling

Tailwind CSS 4 with a custom dark theme defined in `src/styles/global.css`. Key tokens:

| Token | Value | Usage |
|---|---|---|
| `bg-page` | #0C0C0C | Page background |
| `bg-surface` | #171717 | Cards, sections |
| `green-primary` | #22C55E | Accent, CTAs, links |
| `text-primary` | #E5E5E5 | Headings, body |
| `text-secondary` | #A3A3A3 | Descriptions |
| `text-tertiary` | #737373 | Subtle labels |
| `text-muted` | #525252 | Decorative text |
| `border-primary` | #1F1F1F | Card borders |
| `font-mono` | JetBrains Mono | Everything — monospace throughout |

The design is terminal-inspired. Keep this aesthetic consistent: monospace font, dark background, green accents, understated UI.

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
- No testing framework — validate with `pnpm build`
