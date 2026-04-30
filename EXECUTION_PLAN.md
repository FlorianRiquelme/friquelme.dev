# friquelme.dev — Execution Plan

> Sequenced execution plan reconciling the squirrel audit (score 72/C, 5
> errors / 38 warnings) with the Brownfield AI refresh
> (`PORTFOLIO_REFRESH.md`) and manifesto (`MANIFESTO_OUTLINE.md`). Read
> those first; this file is the *order of operations*.
>
> Each phase below lists: goal, audit findings closed, **Stance Debt**
> verdict, tasks, targeted research, done-when. Start each manually —
> research first (one focused subagent per phase), then execute.

---

## Strategic frame (one paragraph)

The audit grades a CV. The site is becoming a **position document**.
The decision filter is **Stance Debt** — the opposite of technical debt:
convictions you didn't take. Every audit fix is one of *pays down*
(sharpens stance), *neutral* (compliance tax — do if cheap), or
*accumulates* (smooths the signature — refuse). Once `/brownfield`
exists, the audit is grading the wrong artifact and most findings
either dissolve or become refusable in writing.

## Sequence

```
Phase 0   Foundation              (substrate — must precede content)
Phase 1   Open-source NachtSchicht    [gates 2, 5b]
Phase 2   Manifesto at /brownfield    [THE ONE THING]
Phase 3   Headline + intro + meta     (uses Phase 0 helpers)
Phase 4   Skills restructure
Phase 5   Project card trio           (5a ddev-claude, 5b NachtSchicht, 5c sentry-alert)
Phase 6   Failures page               (3 postmortems)
Phase 7   Blog landing + sentence-H1
Phase 8   /system-log + Override Ledger + Plan Receipts
Phase 9   sentry-triage living eval   (long track — runs in parallel after Phase 0)
Phase 10  Audit re-run + Stance Debt receipt
```

Phase 0 unlocks every content phase. Phase 1 gates Phases 2 and 5b.
Phase 2 is the canonical artifact every other phase points to.

---

## Stance Debt verdicts (final)

**Pays down — do, in voice:**
- meta title length (passes audit AND sharpens headline)
- og:image (terminal-aesthetic; replaces "thin content" objection in one move)
- Article JSON-LD with image/publisher.logo (uses the og:image — one source)
- aria-hidden-focus on blog anchors (real keyboard regression — see below)

**Neutral — bundle while in flight:**
- meta description normalization
- datePublished completeness
- link-text disambiguation (`view_repo` keeps visible label, gains aria-label)
- /blog H1 (sentence-shaped, not noun)

**Accumulates — refuse, with public receipt:**
- "Blog" as H1 noun (Phase 7 ships a sentence instead)
- bulking up homepage to 300 words with filler ("AI-driven solutions") — replaced with Tech Stack Manifest
- 18 contrast warnings on muted text (terminal palette is the signature)
- "dev" keyword density (will dilute as headline lands; refuse to add filler)
- three separate /about /contact /privacy pages (Phase 8 consolidates)

**Real, not voice (despite looking aesthetic):**
- aria-hidden-focus on blog anchors — keyboard users genuinely cannot navigate. Fix today, not later.

---

## Phase 0 — Foundation

**Goal.** Build the SEO + og:image + headers substrate every later
phase consumes. No content yet — just rails.

**Closes.** No findings yet. Unblocks closing all of them.

**Stance Debt.** Pays down — one source of truth for canonical / title
/ description / image, one place to edit voice.

**Tasks.**
- **0a Trailing slash.** Astro `trailingSlash` as source of truth.
  Sitemap currently emits `/blog/` and `/blog/<slug>/`. Lock to
  `"always"` and stop the 302. Confirm CloudFront default-root-object
  + S3 routing don't fight the choice.
- **0b SEO helper.** `getSeoMeta({title, description, canonical,
  image, type, datePublished})` → returns object consumed by `<head>`,
  og tags, and Article JSON-LD. One field, three consumers.
- **0c og:image pipeline.** Pick approach (see research). Default
  template = monospace title block, dark bg, green accent rule, file
  path footer (`~/friquelme.dev/<slug>`). Variants per page type
  (manifesto, post, project, eval, failure).
- **0d CSP via CloudFront `ResponseHeadersPolicy` (CDK).** Starter:
  `default-src 'self'; script-src 'self' 'unsafe-inline'
  https://*.posthog.com; connect-src 'self' https://*.posthog.com;
  img-src 'self' data: https:; style-src 'self' 'unsafe-inline'`.
  Verify against PostHog's actual hostnames (cloud + EU region) and
  any session-replay endpoints.

**Targeted research.**
- Astro 5: how `trailingSlash: "always"` interacts with
  `@astrojs/sitemap`, S3 default-root-object, and CloudFront default
  cache behavior. Does it rewrite to `/blog/index.html` paths?
- og:image options: compare `astro-og-canvas`, Satori, raw SVG
  template-literals, and Playwright screenshots. Pick on simplicity +
  on-brand fit. Codex says static SVG; Gemini says Satori for diff/
  postmortem aesthetic. Resolve here.
- PostHog CSP: real hostnames for the EU region (`eu.i.posthog.com`?
  Verify), asset CDN, session-replay endpoints. Read current
  `posthog.init` config to confirm flags.
- CDK `aws-cloudfront.ResponseHeadersPolicy` API surface — how to
  attach to the existing distribution in `infra/static-site-stack.ts`
  without a full redeploy churn.

**Done when.** All four helpers ship without changing visible UI.
`pnpm build` green. Re-audit shows trailing-slash 302s gone, CSP
header present, score still ~72 (no content fixed yet — that's
expected).

---

## Phase 1 — Open-source NachtSchicht

**Goal.** Public GitHub repo so the manifesto can link directly to
`CLAUDE.md` and the trust-protocol code.

**Closes.** No squirrel findings directly. Gates Phase 2 and Phase 5b.

**Stance Debt.** Pays down massively. Without a public link, the
manifesto's authority halves.

**Tasks.** Per `~/Repos/mine/nachtschicht-repo/plans/open-source.md`.
Phase 0 of that plan (verify tool runs end-to-end) is the first gate.

**Targeted research.** Already done — open-source plan is execution-ready.

**Done when.** `github.com/<you>/nachtschicht` public, README is
recruiter-readable, LICENSE present, all commits authored by personal
email, `PORTFOLIO_REFRESH.md` updated with real URL.

---

## Phase 2 — Manifesto at `/brownfield`

**Goal.** Ship the position document. **THE ONE THING.** Every other
URL on the site points to this as "what is this site."

**Closes.** og:image template proven on the highest-leverage page;
"thin content" objection neutralized site-wide; new canonical
reference for every recruiter outreach and every cold link share.

**Stance Debt.** Pays down everything downstream.

**Tasks.**
- Convert `MANIFESTO_OUTLINE.md` → `src/blog/brownfield-ai.mdx` per
  the outline.
- Pin on `/blog` landing.
- Use Phase 0b SEO helper for `<head>`.
- Use Phase 0c og:image generator — design *the* template here first;
  reuse across the site afterwards. Suggested: a terminal-styled pull
  quote of one principle, monospace, green accent.
- Verify each principle's example links to live code in NachtSchicht
  / sentry-alert.
- Self-edit pass: cut 20%, every sentence earns its place.

**Targeted research.**
- Re-read NachtSchicht README + `CLAUDE.md` to confirm Principle 1 /
  Principle 3 / Principle 6 examples are accurate against the
  now-public repo.
- Re-read sentry-alert recent commits + eval README for Principle 2 /
  Principle 5 numbers.
- Voice/tone audit: does each principle name a *specific failure*
  (per outline's failure-modes-for-the-post check)? Reject any
  paragraph that could appear in a generic "responsible AI" post.
- **Candidate principle: `Plan/Act Separation`.** Surfaced in the
  multi-AI workflow brainstorm as the durable belief under the local
  Claude Code stack: diffs are reviewable, plans aren't, so planning
  needs plurality (multi-LLM) and execution doesn't (single agent).
  Same instinct as brownfield work — distrust the architectural
  decision you can't revert; trust the small change you can. Decide
  during research whether this earns a spot in `MANIFESTO_OUTLINE.md`
  or stays as background reasoning that the Override Ledger (Phase
  8c) cites.

**Done when.** Post is published, pinned on `/blog`, has og:image,
has full Article JSON-LD via SEO helper, principles read aloud
without sounding generic.

---

## Phase 3 — Headline + intro + meta

**Goal.** Hero says "Brownfield AI" in 3 seconds. Hits all the
homepage SEO error/warnings as a side-effect.

**Closes.** ERR meta-title (`/`), WARN meta-description, WARN thin
content (via tech manifest), WARN keyword density (dilutes naturally),
WARN missing og:image (homepage).

**Stance Debt.** Pays down — title becomes a stance, not a keyword
soup.

**Tasks.**
- Title (lock pick from `PORTFOLIO_REFRESH.md` Task 1). Aim ≤55c.
- Meta description: ~140-155c leading with "AI integration in
  production codebases."
- Hero `cat intro.txt` — use the refresh-plan draft.
- **Technical Stack Manifest** (Gemini's invention) — structured `<dl>`
  mapping legacy → AI augmentation (e.g. `PHP/Laravel monolith → eval-gated
  LLM features`, `Sentry firehose → 2-tier triage agent`). Replaces
  filler-content fix; bumps homepage word count without diluting
  voice.
- Use Phase 0c og:image — terminal screenshot of `intro.txt` with
  green accent.

**Targeted research.**
- Pull a list of actually-shipped legacy→AI mappings from real work.
  Sources: digital-masters codebase, sentry-alert deployment,
  NachtSchicht overnight runs. Memory query for "shipped" /
  "production." Anti-pattern: don't list aspirations.
- Headline pick already explored in `PORTFOLIO_REFRESH.md` — confirm
  one and freeze it.

**Done when.** Homepage SEO fields all green, Tech Stack Manifest
renders below hero, recruiter reads "Brownfield AI" in 3 seconds.

---

## Phase 4 — Skills restructure

**Goal.** AI Integration on top with brownfield captions on classical
skills.

**Closes.** No direct audit findings. Reinforces the voice that lets
us refuse audit pressure elsewhere.

**Stance Debt.** Pays down.

**Tasks.**
- Reorder: AI Integration → Backend → Frontend → DevOps.
- Captions per `PORTFOLIO_REFRESH.md` ("the substrate that holds AI in
  production").
- AI Integration toolbox with `shipped / experimented / read about`
  honesty buckets.

**Targeted research.**
- Audit own LLM work: what's actually shipped at digital-masters?
  Which models / frameworks / eval tooling actually ran in prod?
  Memory query + commit log archaeology.
- Anti-pattern check: no model names as "Skills" (`Skill: GPT-4o` =
  `Skill: Dewalt Hammer`).

**Done when.** Skills section reads brownfield-coded; honesty buckets
visible.

---

## Phase 5 — Project card trio

**Goal.** Three OSS AI tools as cards: ddev-claude, sentry-alert (with
eval link), NachtSchicht. Production-Adjacent Proof in one row.

**Closes.** WARN link-text ambiguity (specific per-card labels), WARN
datePublished partial coverage (cards include first-release dates).

**Stance Debt.** Pays down — three Production-Adjacent Proof artifacts
visible at once.

**Tasks (parallelizable across cards).**
- **5a** ddev-claude reframe (`PORTFOLIO_REFRESH.md` Task 3).
- **5b** NachtSchicht card (`PORTFOLIO_REFRESH.md` Task 8). Blocked
  by Phase 1.
- **5c** sentry-alert reframe to surface eval link (`/evals/sentry-triage`).
- Replace generic `view_repo →` and `github` labels with project-
  specific verbs and per-link aria-labels.

**Targeted research.**
- Tags taxonomy already drafted in `PORTFOLIO_REFRESH.md`.
- Confirm GitHub URLs are stable post-Phase-1 push.

**Done when.** Three cards live, no duplicate link labels, audit no
longer flags identical-link-purpose.

---

## Phase 6 — Failures page

**Goal.** `/failures` (or `/postmortems`) with 3 short entries from
sentry-alert git log. Production-Adjacent Proof, made literal.

**Closes.** None directly. Adds a class of content the audit doesn't
grade — and that's the point.

**Stance Debt.** Pays down hard. The page no LinkedIn-style portfolio
has.

**Tasks.** Per `PORTFOLIO_REFRESH.md` Task 6 — three ~150-word
postmortems (duplicate-Slack spam, wrong-environment cost burn, agent
ran out of turns). Each ends with metric + transferable lesson.

**Targeted research.**
- Re-read sentry-alert git log for the three commits referenced.
- Confirm metrics are publishable (no real Sentry IDs, no client
  names, no internal URLs).

**Done when.** Page lives; each entry has metric + lesson + commit
link.

---

## Phase 7 — Blog landing + sentence-H1

**Goal.** Latest 2-3 posts surfaced on `/blog`; manifesto pinned at
top; H1 in voice. Fix the one real (not voice) accessibility bug.

**Closes.** ERR no H1 on `/blog`; ERR/WARN `/blog` meta description
short; ERR aria-hidden-focus (TOC component); ERR meta-title >60c on
`/blog/deploying-astro-to-aws`.

**Stance Debt.** Sentence-H1 pays down ("Notes from threading LLMs
through production codebases."); fixing aria-hidden-focus is real (not
voice), so do it.

**Tasks.**
- H1: sentence-shaped (Claude's compromise). Reject `<h1>Blog</h1>`.
- Pin manifesto card at top of listing.
- Surface latest 3 posts.
- Audit `TableOfContents.astro` and any anchor heading components
  introduced in commit `537ef2a` ("anchor navigation to blog
  headings"). The aria-hidden likely came from there. Fix: replace
  with non-focusable spans or remove `aria-hidden` if anchor is
  reachable.
- Tighten the long blog-post title (`deploying-astro-to-aws` 66c).
- Refuse fix on /blog 150-word "thinness" — that's One-Word UX.

**Targeted research.**
- Read `src/components/blog/TableOfContents.astro` and any post
  template touched by commit `537ef2a`.
- Indie engineer /blog precedents (julia evans, simonw, dan abramov)
  for sentence-H1 framing.

**Done when.** /blog passes audit on H1, descriptions, and
aria-hidden-focus. /blog 150-word warning remains and is documented in
Phase 10 receipt.

---

## Phase 8 — `/system-log` identity surface

**Goal.** One terminal-aesthetic page that consolidates About +
Contact + Privacy, plus the **Override Ledger** — the operating
substrate that turns the site from a CV into a position document
about *how the operator actually works*. Synthesis of Gemini's
`/system-log` (operational history), Codex's terse dossier, and the
multi-AI brainstorm output naming the local Claude Code workflow as a
brownfield hiring signal.

**Closes.** WARN no /about, no /contact, no /privacy. Plus: closes
the unspoken provenance question every AI engineer portfolio in 2026
fails to answer.

**Stance Debt.** Pays down. Operational history is brownfield-coded.
A brochure /about would accumulate. The Override Ledger pays down
*twice* — once by refusing the conventional `/uses` page, once by
organizing around rejected defaults instead of tools.

**Tasks.**
- **8a Page at `/system-log`** (or `/colophon` — pick during research).
  Sections: identity (name, location/timezone), work focus, contact
  (link to homepage `#contact` or email), OSS links, **changelog**
  (last 5-10 site changes with dates), privacy note (PostHog
  cookieless tracking — minimal disclosure).
- **8b Footer link + `<link rel="me">` + JSON-LD `sameAs`.**
- **8c Override Ledger section** at `/system-log#override-ledger`.
  Static `OperatorStack.astro` component. Organized by **deficiency,
  not by tool** — the unit is a rejected Claude Code default, the
  tool name is the footnote. Four ledger entries to start (room to
  grow):
  - `single-prior bias` → planning convergence too early → claude-octopus
  - `context amnesia` → stateless sessions on long projects → claude-mem
  - `improvisation drift` → execution wanders on complex tasks → superpowers
  - `plan/act conflation` → small edits don't need a parliament → plan-mode + execute
  Each row: trigger condition, failure mode in brownfield work, override,
  one real example, link to artifact (when one exists). Diagnostic
  test: any sentence that could appear unchanged on Anthropic's
  marketing site is stance debt — cut it.
- **8d Plan Receipts artifact** at
  `/system-log/override-ledger/<one-real-decision>`. Pick *one*
  shipped portfolio decision (candidate: the headline pick from
  `PORTFOLIO_REFRESH.md` — "Brownfield AI" vs the alternatives the
  octopus surfaced). Show the actual multi-LLM disagreement (Codex
  vs Gemini vs Claude), the override reasoning in voice, and the
  resulting unified diff against the homepage. Hard to fake — every
  other AI portfolio shows polished output; this shows the
  disagreement *before* the output.
- **8e Provenance disclosure.** Two-sentence section, in voice.
  Names what was AI-assisted (planning, research synthesis, draft
  copy), what wasn't (every public claim, every refusal in the
  Stance Debt receipt, every line of architecture decision). The
  honest brownfield move: disclosing the involvement is what makes
  the human work visible.

**Targeted research.**
- Colophon precedents: paulrobertlloyd.com/colophon,
  robweychert.com/colophon, others to surface in research.
- GDPR-minimal cookieless privacy copy template (PostHog cookieless
  is the relevant disclosure).
- Astro pattern for auto-generating changelog from `git log` (vs
  hand-curated entries).
- Sanitization pass on any claude-mem excerpts referenced as proof —
  client names, repo paths, internal todos must not leak. Same gate
  applied to sentry-alert before public release.
- Anti-pattern check on Override Ledger copy: does any row read like
  a tool endorsement? If yes, rewrite with deficiency in the lead
  position. The reader should learn the *failure*, not the *tool*.
- Pull the actual octopus output from the headline brainstorm session
  out of conversation history / claude-mem. Confirm it's
  publishable as-is or what minimum redaction is required.

**Done when.** Page lives, footer links, audit no longer flags
missing E-E-A-T pages. Override Ledger renders four entries with
deficiency-led copy. Plan Receipts subpage shows one real multi-LLM
disagreement + override + diff. Provenance disclosure ships with the
page (not added later as a footer note). No sentence in the Ledger
section could appear on Anthropic marketing copy.

---

## Phase 9 — sentry-triage living eval (long track)

**Goal.** Ship `/evals/sentry-triage` v1 with real data + **trace
honesty** (Gemini's "Latency of Logic" insight — the audit's blind
spot, the brownfield reader's strongest signal).

**Closes.** None directly. Adds the artifact that beats every audit
finding combined.

**Stance Debt.** Pays down. Real numbers, real failures, real cost.

**Tasks.** Per `sentry-alert/evals/sentry-triage/README.md`. Plus:
render at least one **real trace** on the page — model call, token
cost, time, decision, retry — not just summary stats. Make the page
feel like a dashboard sitting on a running engine, not a static chart.

**Targeted research.**
- Re-enable sentry-alert against a small project for case collection.
- Build `tools/anonymize.ts` per eval README.
- 50 cases collected, anonymized, labeled, hold-out 20% frozen.
- Render component for a single trace (token-counted, cost-tagged,
  decision-traced).

**Done when.** v1 page renders with ≥50 cases, summary metrics, ≥1
example trace, regression suite frozen.

---

## Phase 10 — Audit re-run + Stance Debt receipt

**Goal.** Re-run squirrel, document explicit refusals.

**Closes.** Score climb to ≥85 expected. Anything still flagged is
documented as deliberate.

**Stance Debt.** Pays down — refusal in writing is the strongest form
of stance.

**Tasks.**
- `squirrel audit https://friquelme.dev --coverage full --format llm`
- `squirrel report --diff <baseline-id> --format llm` against this
  audit's baseline.
- Add **Refusals** subsection to `/system-log` (or as part of the
  manifesto's appendix): "These audit findings are intentionally not
  fixed. Each one would smooth a signature element of brownfield
  positioning."
- Lists: muted contrast (terminal palette), thin /blog index
  (One-Word UX principle), `view_repo` link text (audience-specific
  clarity), no separate /about (consolidated to /system-log).

**Targeted research.**
- `squirrel report --diff` mode usage against the baseline.
- Compose the receipt copy in voice — itself becomes brownfield-coded
  content.

**Done when.** Score ≥85; refusal list shipped; receipt itself reads
as on-brand brownfield content.

---

## Audit findings → phase mapping

| Finding | Phase | Verdict |
|---|---|---|
| meta title >60c on `/` | 3 | close |
| meta title >60c on `/blog/deploying-astro-to-aws` | 7 | close |
| no H1 on `/blog` | 7 | close (sentence-shaped) |
| `/blog` meta-desc 56c | 7 | close |
| `/blog/seo-for-astro-sites` desc 181c | 7 | close |
| Article JSON-LD missing image + publisher.logo | 0 | close (helper) |
| aria-hidden-focus on blog anchors | 7 | close (real bug) |
| missing og:image (all 4) | 0 + 2 | close (template + first use) |
| no CSP header | 0d | close |
| 302 trailing-slash redirects | 0a | close |
| thin content `/` | 3 | close (tech manifest) |
| thin content `/blog` | 7 | refuse (sentence-H1 only) |
| `dev` keyword density 3.1% | 3 | close (dilutes naturally) |
| DOM size + critical CSS chain | — | defer |
| 18 contrast warnings | — | refuse (palette) |
| github / view_repo ambiguity | 5 | close (specific labels) |
| no About/Contact/Privacy | 8 | close (consolidated) |
| 50% datePublished | 0 + 5 | close (helper enforces) |
| LinkedIn 999 | — | ignore (false positive) |
| HTTP→HTTPS redirects flagged | — | ignore (correct behavior) |

**14 close, 3 refuse (with receipt), 1 defer, 2 ignore.**

---

## Workflow

For each phase:

1. Open this file. Read the phase block.
2. Spawn a focused research subagent with the **Targeted research**
   bullets as its prompt. Wait for result.
3. Decide and freeze the open choices the research surfaces.
4. Implement tasks. Atomic commits per task.
5. Re-audit (`squirrel audit https://friquelme.dev -C surface -f
   llm`) only if the phase claims to close findings.
6. Update this file with what got closed and what's still open.

## Out of scope for this plan

- New strategic positioning beyond what's in `PORTFOLIO_REFRESH.md`
- Visual redesign (terminal aesthetic stays)
- Adding sections beyond Tasks 1-9 of the refresh
- Cross-posting / distribution (covered in `MANIFESTO_OUTLINE.md`)

## Done when

- All four refresh artifacts shipped: `/brownfield` manifesto, three
  project cards, `/failures` page, `/evals/sentry-triage` v1.
- `/system-log` consolidating About / Contact / Privacy is live.
- Audit score ≥85 (Grade B+) with explicit refusals documented for
  the four findings we deliberately don't fix.
- Phase 10 receipt page makes the refusals legible to the brownfield
  reader as voice, not as a TODO list.
