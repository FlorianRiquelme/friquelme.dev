---
name: friquelme.dev
description: Brownfield AI engineer's portfolio — terminal-native, restrained, evidence-led.
colors:
  console-black: "#0C0C0C"
  tier-one-surface: "#171717"
  tier-two-inset: "#1A1A1A"
  subtle-rule: "#1F1F1F"
  active-rule: "#252525"
  stdout-white: "#E5E5E5"
  body-gray: "#A3A3A3"
  comment-gray: "#858585"
  decoration-gray: "#898989"
  kernel-green: "#22C55E"
  caution-amber: "#F59E0B"
  halt-red: "#EF4444"
  info-blue: "#3B82F6"
typography:
  display:
    fontFamily: "JetBrains Mono Variable, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
    fontSize: "clamp(1.5rem, 4.5vw, 2.25rem)"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "JetBrains Mono Variable, ui-monospace, monospace"
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: 1.3
  title:
    fontFamily: "JetBrains Mono Variable, ui-monospace, monospace"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "JetBrains Mono Variable, ui-monospace, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "JetBrains Mono Variable, ui-monospace, monospace"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  none: "0"
  pill: "2px"
  default: "4px"
  card: "6px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  section: "60px"
  page: "120px"
components:
  button-primary:
    backgroundColor: "{colors.kernel-green}"
    textColor: "{colors.console-black}"
    typography: "{typography.label}"
    rounded: "{rounded.default}"
    padding: "12px 24px"
  button-secondary:
    backgroundColor: "{colors.tier-one-surface}"
    textColor: "{colors.comment-gray}"
    typography: "{typography.label}"
    rounded: "{rounded.default}"
    padding: "12px 24px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.decoration-gray}"
    typography: "{typography.label}"
    rounded: "{rounded.default}"
    padding: "12px 24px"
  card-surface:
    backgroundColor: "{colors.tier-one-surface}"
    rounded: "{rounded.default}"
    padding: "20px"
  input-field:
    backgroundColor: "{colors.tier-two-inset}"
    textColor: "{colors.stdout-white}"
    typography: "{typography.body}"
    rounded: "{rounded.default}"
    padding: "10px 14px"
  tag:
    backgroundColor: "{colors.tier-two-inset}"
    textColor: "{colors.body-gray}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.comment-gray}"
    typography: "{typography.label}"
    rounded: "{rounded.default}"
    padding: "10px 12px"
  nav-item-active:
    backgroundColor: "{colors.tier-two-inset}"
    textColor: "{colors.kernel-green}"
    typography: "{typography.label}"
    rounded: "{rounded.default}"
    padding: "10px 12px"
---

# Design System: friquelme.dev

## 1. Overview

**Creative North Star: "The Operator's Console"**

A console for the people who already live in a console. The visual language is the practitioner's workspace, not a depiction of one. Every element ought to feel as if it were rendered by `ls`, `cat`, or `ps` — typeface, prompts, status pulses, comment slashes — and not as nostalgic costume but as the reader's actual habitat. The audience (hiring engineers and EMs at AI-enabled companies) recognises the form on sight; that recognition is the filter, and the filter is the point.

The philosophy is **restraint as authority**. Where the category shouts (gradients, neon, particle backgrounds, hero-metric templates), this site says less. One accent, one font family, three depth tiers. The site itself is the proof of craft for the brownfield AI thesis: if the portfolio cannot ship with the same discipline that's claimed about production AI, the position collapses. Every visual choice serves the position or gets cut.

Anti-references, carried over from PRODUCT.md and enforced visually here: gradient-heavy SaaS landing pages, neon-on-black "AI engineer" portfolios, glassmorphism, hero-metric templates, identical card grids, and bootcamp-grad portfolios with decorative SVG illustrations and pastel palettes.

**Key Characteristics:**
- Mono-forward typography (JetBrains Mono, all roles)
- Three-tier tonal depth on a near-black canvas, no shadows at rest
- Single saturated accent (Kernel Green) used sparingly for signal, never decoration
- Terminal grammar treated as first-class typography: `$` prompts, `// comments`, `~` paths
- Lowercase by default in copy and UI; uppercase reserved for nothing
- Tight component shapes (4px corners, full borders, no side stripes)

## 2. Colors: The Console Palette

A palette of one accent and a long ladder of warm-shifted neutrals. The neutrals carry the whole system; the accent earns attention by appearing rarely.

### Primary
- **Kernel Green** (`#22C55E`): The single accent. Used for active state (`>` prompt prefix, active nav item), evidence (`★ stars`, status pulses, percentage values), the manifesto blockquote bar, and primary-button surfaces. Coverage budget on any given screen: ≤10%. Anything more dilutes its meaning.

### Neutral
- **Console Black** (`#0C0C0C`): Page canvas. The rest of the system layers on top of this.
- **Tier-One Surface** (`#171717`): Cards, terminal-window bodies, nav-active highlights. The first tonal lift.
- **Tier-Two Inset** (`#1A1A1A`): Inputs, tags, terminal-window title bars. Reads as a slight inset, not a lift.
- **Subtle Rule** (`#1F1F1F`): Default border for cards, inputs, dividers.
- **Active Rule** (`#252525`): Border on hovered secondary buttons. The only neutral that ever moves.
- **Stdout White** (`#E5E5E5`): Primary readable text, headlines, strong emphasis.
- **Body Gray** (`#A3A3A3`): Secondary body text, paragraph copy in long-form posts.
- **Comment Gray** (`#858585`): Tertiary text, descriptions framed as `// comments`, table cells.
- **Decoration Gray** (`#898989`): Time stamps, copyright lines, the most muted UI tier.

### Semantic
- **Caution Amber** (`#F59E0B`): Used at 8% opacity background + full text in `Badge variant="warning"`. Never as primary signal.
- **Halt Red** (`#EF4444`): Same treatment for `error`. Used as the leftmost terminal-window traffic-light dot.
- **Info Blue** (`#3B82F6`): Reserved for `info` badge variant. The `latest` chip on the featured blog card.

### Named Rules

**The One Voice Rule.** Kernel Green is the only saturated colour on most screens. If the screen has more than one saturated colour, one of them is wrong. The amber/red/blue semantic trio exists for *state*, not for decoration; they appear as 8% backgrounds with full-strength text, never as primary surface treatments.

**The Tonal Ladder Rule.** Depth is tonal, never shadowed. The three steps are Console Black → Tier-One Surface → Tier-Two Inset. A new component must pick one step, not invent a fourth.

**The Twin-Gray Rule.** Comment Gray (`#858585`) and Decoration Gray (`#898989`) are intentionally near-identical. Pick by *role*, not by appearance: Comment Gray for inline content (descriptions, captions, table cells), Decoration Gray for chrome (timestamps, footers, label tier). Never introduce a third gray in this band.

## 3. Typography

**Display Font:** JetBrains Mono Variable
**Body Font:** JetBrains Mono Variable
**Label / Mono Font:** JetBrains Mono Variable

**Character:** One typeface for everything. Variable-weight monospace at 400/500/600/700. The choice rejects the "sans body + mono code" convention because the position is that the person behind the site lives in a terminal, and the typeface should reflect where the work actually happens. Every glyph at every weight reads as `console output`.

### Hierarchy

- **Display** (600, `clamp(1.5rem, 4.5vw, 2.25rem)`, line-height 1.3, letter-spacing -0.01em): Hero h1 ("shipping products, not just writing code."). Article h1 lifts to 32px on desktop with weight 700.
- **Headline** (600, 28px, line-height 1.3): Section-header commands ("$ neofetch --skills", "$ ls -la ~/projects"), set in Kernel Green so they read as terminal commands, not prose headings.
- **Title** (600, 18–22px, line-height 1.4): Card titles (project name, blog post title), featured card h2, sub-section h2.
- **Body** (400, 14px, line-height 1.6 in UI / 1.8 in long-form prose): Paragraph copy and most descriptive text. Long-form post body caps at ~70ch via the `prose` container.
- **Label** (500, 11–13px, line-height 1.4): Buttons, nav items, tags, badges, status indicators, footer copy. The most-used scale on the site.

### Named Rules

**The Lowercase Default Rule.** UI copy and headings default to lowercase. The terminal hates Shift. Capitalisation, when it appears, is in long-form blog body text only — and even there, sentence case dominates.

**The Comment-as-Caption Rule.** Descriptive text under a heading or beside a section is framed with leading `// `. Section descriptions, project blurbs, and footer copyright all follow this. It treats helper text as code commentary, not marketing copy.

**The Prompt-as-Heading Rule.** Top-level section headers on landing pages are written as terminal commands prefixed with `$ ` and coloured Kernel Green. They are headings, not decoration; screen readers receive them as h2 elements.

## 4. Elevation

The system is **flat with tonal layering**. Surfaces are flat at rest; depth is conveyed by stepping through the three-tier tonal ladder (Console Black → Tier-One Surface → Tier-Two Inset). There are no resting shadows on any component anywhere in the system.

The single shadow vocabulary is reserved for **state**, never structure, and is tinted with the accent so it reads as a green-glow halo on hover, not a generic dark drop-shadow.

### Shadow Vocabulary

- **Hover lift** (`box-shadow: 0 10px 15px -3px rgba(34,197,94,0.05), 0 4px 6px -4px rgba(34,197,94,0.05)`, paired with `translateY(-4px)` and a border tint to `rgba(34,197,94,0.2)`): The only shadow in the system. Applies to interactive cards (project cards, blog post cards) on `:hover`. Returns to flat on leave with a 300ms ease-out transition.

### Named Rules

**The Flat-by-Default Rule.** No component has a resting shadow. If a designer reaches for `box-shadow` on a default state, the answer is to step the surface up the tonal ladder instead.

**The Glow-Means-Interactive Rule.** The green-tinted hover halo is reserved for elements that change route on click. Static cards (skill bars, status indicators, dividers) do not get the treatment. Hover effects are a state contract, not decoration.

## 5. Components

The component philosophy: **quiet and exact, like CLI flags**. Components feel like rendered shell output — tight padding, small radius, full borders, monospace everywhere. Internal weight comes from typography and tonal contrast, never from drop shadows or colour washes.

### Buttons

- **Shape:** 4px radius (`rounded`), full borders only (no side stripes).
- **Primary** (`button-primary`): Kernel Green background, Console Black text, 13px medium label, 24px / 12px padding (`px-6 py-3`), `lucide:terminal` default leading icon. Full-width on mobile, intrinsic on `sm` and up.
- **Secondary** (`button-secondary`): Tier-One Surface background, Subtle Rule border, Comment Gray text, same shape and padding as Primary.
- **Ghost** (`button-ghost`): Transparent background, Decoration Gray text, no border, otherwise identical shape.
- **Small** (compact primary): Kernel Green background, 4px / 16px padding, 11px label, used for inline CTAs in cards.
- **Hover / Focus:**
  - Primary: `brightness(110%)` and `:active` `scale(0.95)` over 200ms.
  - Secondary: border shifts Subtle Rule → Active Rule.
  - Ghost: text shifts Decoration Gray → Comment Gray.
  - All buttons must show a visible focus ring (browser-default `:focus-visible` outline at minimum; refine to a 2px Kernel Green ring before hardening).

### Cards / Containers

- **Corner Style:** 4px radius (`rounded`).
- **Background:** Tier-One Surface (`#171717`).
- **Border:** 1px Subtle Rule (`#1F1F1F`). Full perimeter only.
- **Internal Padding:** 20px (`p-5`) for content cards, 24px (`p-6`) for `SurfaceCard`-style containers, 16–24px on terminal-window bodies (`p-4 md:p-6`).
- **Hover Strategy** (interactive cards only): see Elevation §4 — translate up 4px, tint border to `rgba(34,197,94,0.2)`, apply the green-tinted ambient glow, transition 300ms.
- **Image cards** (project, blog featured/post): hero image on Tier-Two Inset background, fixed height (180–220px), `object-cover`, `group-hover:scale-105` on the image with a 300ms ease-out. The lift, the border-tint, and the image scale move as one motion.

### Inputs / Fields

- **Style:** Tier-Two Inset background, 1px Subtle Rule border, 4px radius. Leading icon (16px, `lucide:terminal` default) in Decoration Gray. Placeholder copy in Decoration Gray, value in Stdout White.
- **Padding:** 14px / 10px (`px-3.5 py-2.5`) for inputs; 14px (`p-3.5`) for textareas with fixed 120px height (`h-30`).
- **Focus:** 2px Kernel Green inset ring at 40% alpha (`focus-within:ring-2 focus-within:ring-green-primary/40 focus-within:ring-inset` on the wrapper, `focus:` on the textarea where there is no wrapper). The input keeps `outline-none`; the visible ring lives on the bordered shell so the terminal aesthetic stays intact.
- **Search field** (`SearchField`): Inline pill version. Tier-Two Inset background, no border, 12px / 8px padding.

### Tags / Badges / Status

- **Tag** (`Tag`): Tier-Two Inset background, 2px radius (`rounded-sm`), Body Gray text at 11px, 10px / 4px padding. Body Gray (not Decoration Gray) because tags are content-bearing under the Twin-Gray Rule's "inline content" role and need ≥ 4.5:1 contrast at small sizes. Used for project tags, blog tags.
- **Badge** (`Badge`): Same shape as Tag. Background is the semantic colour at 8% opacity (`bg-{role}/[0.08]`), text is the semantic colour at full strength. Variants: `success` Kernel Green, `warning` Caution Amber, `error` Halt Red, `info` Info Blue.
- **Status Indicator** (`StatusIndicator`): A 2px-wide Kernel Green dot with an `animate-ping` halo (the same green at 75% opacity expanding-and-fading). 11px label in Kernel Green to its right. The site's only ambient motion at rest.

### Navigation

- **HeaderBar:** Sticky, top of viewport, 16px / 20px / 64px padding scale across breakpoints, 1px Subtle Rule bottom border. Flex layout with logo + nav cluster + status. Mobile collapses nav into a fullscreen overlay triggered by a hamburger button. The trigger toggles `aria-expanded`, exposes `aria-controls`, and the overlay carries `role="dialog"` + `aria-modal="true"`. Tab/Shift+Tab is trapped inside the dialog while open; Escape closes it; focus returns to the trigger on close.
- **NavItem:** 13px label, 12px / 10px padding, 4px radius. Inactive: Comment Gray text, no background, leading non-breaking space (preserves alignment with active state). Active: Tier-Two Inset background, Kernel Green text and weight 500, leading `>` prompt rendered in Kernel Green.
- **Logo:** A green `~` (tilde, JetBrains Mono semibold 18px) followed by the brand name in Stdout White medium 16px. Treated as wordmark, not icon.
- **Footer:** Top-aligned divider, two rows: brand + links above the divider, copyright + `exit 0` below. Both rows use Decoration Gray at 11px. The literal `exit 0` is a load-bearing detail — closes the page like a clean shell exit.

### Signature: TerminalWindow

The site's most distinctive component. A faux-macOS terminal frame used to hold hero introduction copy and contact details.

- **Frame:** 4px radius, Tier-One Surface body, 1px Subtle Rule border.
- **Title bar:** Tier-Two Inset background, 1px Subtle Rule bottom border, 12px / 16px padding. Three traffic-light dots (Halt Red, Caution Amber, Kernel Green; 12px diameter, `rounded-full`), then a Decoration Gray title at 12px (e.g., `~/friquelme.dev — bash`).
- **Body:** 16px padding (`p-4`) on mobile, 24px (`p-6`) on desktop, 6px row gap. Content alternates command lines (`$ ` prefix in Kernel Green, content in Stdout White) and output lines (Body Gray or Stdout White depending on emphasis).
- **Behaviour:** Lines reveal sequentially via a typing animation on first paint or first scroll-into-view. Cursor block (9px wide, full line height, Kernel Green) blinks at 1s steps via `animate-blink`. Both behaviours respect `prefers-reduced-motion` and degrade to instant reveal.

## 6. Do's and Don'ts

### Do:

- **Do** keep Kernel Green coverage at or below 10% of any given screen. Its rarity is the meaning.
- **Do** use the three-tier tonal ladder (Console Black → Tier-One Surface → Tier-Two Inset) as the only depth grammar. New components pick a step, not a shadow.
- **Do** treat `$ ` prefixes, `// ` comments, and `~` paths as first-class typography. They are headings and captions, not decoration.
- **Do** write UI copy in lowercase by default. Sentence case appears only in long-form blog body.
- **Do** pair the Kernel Green accent with a non-colour cue (text, icon, prompt prefix) so state never depends on hue alone.
- **Do** hold body text contrast ≥ 4.5:1 and large text / UI components ≥ 3:1 against the dark surfaces. Stdout White on Console Black clears this comfortably; Comment Gray and Decoration Gray sit at the edge — verify before promoting either to body copy.
- **Do** respect `prefers-reduced-motion`. Reduced-motion users get the same content, just without movement.
- **Do** ship hover/focus/active states on every interactive element. A static default-only component reads as dead.

### Don't:

- **Don't** use `border-left` or `border-right` greater than 1px as a coloured accent stripe on cards, list items, callouts, or alerts. The Callout and prose blockquote use full-perimeter 1px green/20 borders with a 6% green background tint and a leading `>` glyph — copy that pattern for any new emphasised block.
- **Don't** write gradient text. No `background-clip: text` with a gradient. Single solid colour, emphasis via weight or size.
- **Don't** use glassmorphism. No backdrop blurs as decoration. The dark surfaces don't need fog.
- **Don't** introduce a hero-metric template (big number, small label, supporting stats, gradient accent). The MetricCard primitive exists for genuine data display, not for SaaS-cliché identity.
- **Don't** ship identical card grids. The homepage already varies card sizes (project grid 2-up, blog grid 3-up, featured card full-width). Maintain that variation; do not collapse to a single card system.
- **Don't** reach for a modal as the first thought. Inline disclosure, progressive enhancement, or a separate route almost always beats a modal on this site.
- **Don't** add a third gray near `#858585` / `#898989`. The pair already covers tertiary and chrome roles. New muted needs pick one; they don't add a third.
- **Don't** add a second display font, body font, or sans companion. JetBrains Mono carries every role.
- **Don't** wrap copy in a `max-w-prose` container reflexively. Most landing-page sections want their own measure (the homepage uses `max-w-[900px]` for terminals and `max-w-[700px]` for the contact frame).
- **Don't** write em dashes in copy. Use commas, colons, semicolons, periods, or parentheses. This rule applies in `.astro` and `.mdx` files alike.
- **Don't** use `#000` or `#fff` anywhere. Console Black (`#0C0C0C`) and Stdout White (`#E5E5E5`) are the only legal extremes.
- **Don't** describe yourself with adjectives the audience can't verify ("AI-driven", "scalable", "robust"). Show, don't tell. Every claim links to code, numbers, or a shipped artifact, per PRODUCT.md.
- **Don't** ship a marketing aesthetic. Neon, particles, animated gradients, "Trusted by" logo bars, and gradient-heavy CTA bands are the anti-position. If the screen could appear unchanged on a generic AI-product landing page, redo it.
