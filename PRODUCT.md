# Product

## Register

brand

## Users

Hiring engineers and engineering managers at AI-enabled companies (not AI-native research labs), plus technical recruiters scanning for signal beyond keyword match. Secondary audience: senior engineers thinking about their own AI repositioning.

Context: they arrive cold from a search result, LinkedIn, or a referral, with seconds to judge whether this is a senior engineer doing real in-production AI work — not another bootcamp grad with Copilot, and not a researcher with no production scars.

Job to be done: in under three seconds, confirm "this person threads LLMs through real codebases for real teams." Then, if interested, follow the breadcrumb trail (homepage → projects → manifesto → contact) without friction.

## Product Purpose

Position Florian Riquelme as a **brownfield AI engineer** — the practitioner who takes a 10-year-old codebase, a non-technical team, and a real P&L, and threads LLMs through them without breaking trust.

The site converts recruiter and EM visits into outreach about hiring or contract work. Success looks like a hiring engineer reading the homepage, opening one of the three OSS tools (ddev-claude, sentry-alert, NachtSchicht), scanning the pinned "Brownfield AI" manifesto, and reaching the contact form with intent. Every section exists to compress that journey.

The site is *not* a CV, not a tutorial blog, not a hype reel. It's a position document.

## Brand Personality

Three words: **terminal-native, opinionated, evidence-led**.

Tone: senior, anti-hype, unflashy. The voice of someone who has shipped enough that they no longer need to perform expertise. Short paragraphs. Strong opinions. Concrete examples from real work. No "AI-driven." No model-name lists as decoration. No restated headings. No em dashes in copy.

Lowercase by default in UI copy and post bodies (the existing convention). Capitalisation is reserved for headlines that earn it. Comments (`// like this`) and shell prompts (`$ like this`) are first-class typography, not novelty.

Emotional goal: a reader closes a tab thinking "this person knows what they're doing" before they consciously notice why.

## Anti-references

Things this site must never resemble:

- **Gradient-heavy SaaS landing pages.** Hero-metric templates (big number, small label, supporting stats), identical card grids, "Trusted by" logo bars.
- **"AI engineer" portfolio aesthetic.** Neon-on-black, particle backgrounds, animated gradients, glassmorphism, "Powered by GPT-4" badges, model-name confetti.
- **Bootcamp-grad portfolios.** Every section a different style, decorative SVG illustrations, dribbble-flavoured pastels, "Hi, I'm X 👋" hero.
- **Generic dev-influencer blog.** Listicles, screenshot-of-tweet embeds, top-10 frameworks of 2026.

If a reader could plausibly say "AI made that" or "another bootcamp portfolio," the design has failed the position.

## Design Principles

1. **Show, don't tell.** Every claim links to code, numbers, or a shipped artifact. Standalone adjectives ("scalable," "robust," "AI-driven") are negative signal to this audience.
2. **Practice what you preach.** The site itself is the proof of craft for the brownfield AI thesis. If we can't ship the portfolio with the same discipline we claim about production AI, the position collapses. Performance, accessibility, and copy precision are load-bearing.
3. **Restraint as authority.** This audience reads quiet as senior. Where the category shouts (gradients, neon, hero metrics), this site says less. Whitespace, monospace, full borders, single accent. No decoration that doesn't earn its place.
4. **Position over decoration.** Every element serves the brownfield AI thesis or gets cut. The terminal aesthetic isn't a stylistic choice; it's autobiographical, and it filters the audience by selecting for readers who recognise the form.

## Accessibility & Inclusion

Target: **WCAG 2.2 AA** across all surfaces.

Already in code: semantic HTML, `sr-only` long-form summaries for the terminal-styled hero (so screen readers and AI crawlers get prose, not ASCII art), `prefers-reduced-motion` handling for the typing animation, scroll-triggered fades, and skill-bar transitions, focus-visible states on interactive elements, alt text on project imagery.

Standing rules:
- Body text contrast ≥ 4.5:1, large text and UI components ≥ 3:1, against the dark background tokens.
- Never rely on the green accent alone to convey state; pair with text or an icon.
- Keyboard navigation must reach every interactive element in DOM order; no focus traps.
- Reduced-motion users get the same content, just without movement, never less of it.

No specific user needs flagged beyond the AA bar.
