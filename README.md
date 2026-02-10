# friquelme.dev

Personal portfolio site for Florian Riquelme — senior software engineer based in Hamburg, Germany.

**Live:** [friquelme.dev](https://friquelme.dev)

## Tech Stack

- **Framework:** [Astro 5](https://astro.build) (static output)
- **Styling:** [Tailwind CSS 4](https://tailwindcss.com) via Vite plugin
- **Icons:** [astro-icon](https://github.com/natemoo-re/astro-icon) with Lucide
- **Font:** JetBrains Mono
- **Infrastructure:** AWS CDK (S3 + CloudFront + Route53 + ACM)
- **CI/CD:** GitHub Actions with OIDC authentication
- **Package Manager:** pnpm

## Development

```sh
pnpm install
pnpm dev          # http://localhost:4321
pnpm build        # Static output to ./dist/
pnpm preview      # Preview production build
```

## Project Structure

```
src/
├── assets/images/       # Project card images
├── components/
│   ├── content/         # ProjectCard, SkillBar, TerminalWindow, etc.
│   ├── forms/           # InputGroup, SearchField, TextareaGroup
│   ├── nav/             # HeaderBar, Footer, Logo, NavItem
│   └── ui/              # Badge, Button variants, Tag, Divider
├── layouts/Layout.astro # Base HTML layout with meta, fonts, analytics
├── pages/index.astro    # Single-page site (hero, skills, projects, contact)
└── styles/global.css    # Tailwind theme, animations, base styles

infra/                   # AWS CDK stacks
├── lib/
│   ├── static-site-stack.ts   # S3 + CloudFront + DNS + TLS
│   └── github-oidc-stack.ts   # GitHub Actions deploy role
└── bin/infra.ts
```

## Deployment

Pushes to `main` trigger the GitHub Actions workflow which:

1. Builds the static site with Astro
2. Authenticates to AWS via OIDC (no stored credentials)
3. Syncs to S3 with appropriate cache headers
4. Invalidates CloudFront cache

Infrastructure is managed separately via CDK in the `infra/` directory.
