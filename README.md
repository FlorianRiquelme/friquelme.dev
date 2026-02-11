# friquelme.dev

Source code for [friquelme.dev](https://friquelme.dev) — my portfolio and technical blog.

Built with [Astro](https://astro.build), styled with [Tailwind CSS](https://tailwindcss.com), deployed to AWS (S3 + CloudFront) via GitHub Actions. Terminal-inspired dark theme, monospace throughout.

## Blog

- [Deploying an Astro Site to AWS — The Full Pipeline](https://friquelme.dev/blog/deploying-astro-to-aws/) — GitHub Actions, S3, CloudFront, OIDC auth, and AWS CDK. No stored credentials, no manual steps.
- [SEO for Astro Sites — What Actually Matters](https://friquelme.dev/blog/seo-for-astro-sites/) — Sitemap, Open Graph, JSON-LD, RSS, canonical URLs. No SEO plugins, just the fundamentals.

## Stack

- **Framework:** Astro 5 (static output)
- **Styling:** Tailwind CSS 4
- **Infrastructure:** AWS CDK (S3, CloudFront, Route 53, ACM)
- **CI/CD:** GitHub Actions with OIDC federation (no stored AWS credentials)

## Development

```bash
pnpm install
pnpm dev        # localhost:4321
pnpm build      # production build to ./dist/
```

## License

MIT
