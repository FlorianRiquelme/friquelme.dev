# Portfolio Refresh Plan v3 — friquelme.dev

> v3 supersedes v2. Three changes: NachtSchicht confirmed open-sourceable,
> three OSS tools now form the core artifact set, and a pinned manifesto
> ("Brownfield AI") becomes the position document. Tasks 7/8/9 added.

---

## Strategic frame (internal — not site copy)

I'm not repositioning from "full-stack" to "AI engineer." I'm
repositioning from **practitioner → adopter-in-chief**. The precise
category:

> **Brownfield AI engineer** — taking a 10-year-old codebase, a
> non-technical team, and a real P&L, and threading LLMs through it
> without breaking anything.

Greenfield AI is what AI-native startups do. Brownfield is harder,
scarcer, worth more — *but only if named*. My PHP/React decade isn't a
liability to overcome; it's the qualification for the role.

**Public-facing translation:** "AI in production codebases," "AI
integration for teams with real users," "leading AI adoption." The
term "brownfield" appears in *one* place — the pinned manifesto — and
nowhere else as label.

---

## Goal (unchanged)

Within 3 seconds, a visitor (recruiter, CTO at an AI-enabled company)
should understand: **this person is doing serious AI engineering work
in production** — not someone who occasionally uses Copilot, and not
another "AI engineer" rebrand.

---

## The three open-source artifacts

The portfolio rests on three of my own AI tools, all open source, all
linked from the projects section. Together they form a coherent
position no bootcamp grad can fake.

| Project | Status | What it proves |
|---|---|---|
| **ddev-claude** | public ✓ | Sandboxing — isolation primitives for AI-assisted dev |
| **sentry-alert** | going public *(see sentry-alert/evals/sentry-triage/README.md)* | Production observability — measured, cost-aware, eval-gated |
| **NachtSchicht** | going public *(see nachtschicht-repo/plans/open-source.md)* | Autonomy — trust protocol, reversibility, evidence trails |

The sequence the recruiter walks:

```
Headline      "AI in production codebases"
Skills        AI Integration on top
Projects      Three open-source AI tools — sandbox, triage, autonomy
Eval          /evals/sentry-triage — real numbers, real cost, real failures
Manifesto     "Brownfield AI" — six principles, pinned, with code links
Failures      Three real postmortems from the tooling
Blog          Latest posts surfaced
```

Every claim links to code or numbers.

---

## Tasks in priority order

### Task 1 — Headline, page title, meta

**Decision needed: pick a headline.**

Options through the brownfield frame:

- 🟢 `Senior engineer, leading AI adoption in production.`
- `Threading AI through production codebases.`
- `AI in production, not in slides.` (edgier, anti-hype)
- `Senior engineer. AI adoption in real codebases.`

**Subline:** `// senior engineer · ai integration · production systems`

**Intro (`$ cat intro.txt`) draft:**

```
10 years building production systems for teams with real users.
Now leading AI adoption at digital-masters: threading LLMs into
existing codebases, eval-gated rollouts, and the boring scaffolding
that lets non-technical teams trust probabilistic systems.

I work where the model meets the codebase.
```

**Page `<title>`:** `Florian Riquelme — Senior Engineer, AI Integration | digital-masters`

**Meta description:** ~155 chars, leads with "AI integration in
production codebases," names digital-masters, mentions Hamburg.

### Task 2 — Skills section restructure

Order:

1. **AI Integration** *(NEW, on top — verb is "integration," not "engineering")*
2. Backend — *the substrate that holds AI in production*
3. Frontend — *where the model meets the user*
4. DevOps — *cost ceilings, latency budgets, fallback chains*

Captions matter: classical skills aren't "secondary," they're *what
makes brownfield AI possible*.

**Decision needed: AI Integration toolbox content.**

Be honest: `shipped to prod` / `experimented with` / `read about`.

- LLM providers/models *(shipped):* _______________
- LLM providers/models *(experimented):* _______________
- Frameworks: _______________
- Agent / tool-use patterns: _______________
- MCP experience: _______________
- Eval tooling: _______________
- Observability / tracing: _______________
- RAG architectures shipped: _______________
- Prompt versioning / regression testing: _______________
- Cost / latency engineering: _______________
- Local/quantized model work (Ollama/vLLM): _______________

**Anti-patterns to avoid:**
- Don't list model names as "Skills." `Skill: GPT-4o` =
  `Skill: Dewalt Hammer`.
- No vague "AI-driven" / "40% productivity" claims without numbers.

### Task 3 — Reframe ddev-claude

(unchanged)

- Description leads with the *why*: secure, sandboxed environments for
  AI-assisted development; isolation from host; controlled tool access.
- Tags: `ai tooling / claude code / sandboxing / developer experience`
- 2–3 sentences on the problem it solves and who else benefits.

### Task 4 — sentry-triage living eval

**Replaces the original "case studies" task.**

Eval lives in `sentry-alert/evals/sentry-triage/` (README already
drafted). The portfolio surface renders results + key findings as
terminal output and links to the harness.

**Versions:**
- **v1:** 1 model (Haiku-3.5), 1 prompt, ~50 anonymized real cases
- **v2:** + Sonnet-3.5, GPT-4o-mini, GPT-4.1-mini comparison
- **v3:** + prompt variants
- **v4:** + deep-analysis tier + escalation correctness

**Pre-eval blockers:**
- Re-enable sentry-alert against a small project to collect real data
- Build the anonymizer (`tools/anonymize.ts`) — see eval README
- Hold-out 20% as regression set, frozen across versions

This is a long-running track. v1 ships when 50 cases are collected,
anonymized, and labeled — probably 2–3 weeks of calendar time.

### Task 5 — Blog integration

(unchanged)

- Surface latest 2–3 posts on the landing page
- The pinned manifesto (Task 7) is the obvious lead post

**Decision needed:** current blog state — count, topics, any AI posts?

### Task 6 — Failures / Patches page

A dedicated page, 3 short postmortems (~150 words each). Each ends
with concrete metric + transferable lesson.

**Source: sentry-alert's git log already contains three publishable
failures:**

1. **The duplicate-Slack spam.** `fix: prevent duplicate Slack messages
   from concurrent outbox processing` + `feat: issue-level dedup with
   event counter to prevent AI/Slack spam`. AI features amplifying
   existing infra flakiness; fix was outbox + event counter.
2. **The wrong-environment cost burn.** `feat: extract environment
   from Sentry webhook and filter non-prod/staging events`. AI was
   paying to classify noise; fix at ingest.
3. **The agent that ran out of turns.** `fix: increase agent limits
   to prevent error_max_turns on blind repo exploration`. Agent hit
   a wall on cold codebases; fix was budget + scoping.

Each is a real ~150-word postmortem with metric and lesson. Writes
itself from the commit messages.

### Task 7 — "Brownfield AI" manifesto post *(NEW)*

A pinned ~1500-word essay on the blog landing page. Six principles for
shipping autonomous AI in production codebases — adapted from
NachtSchicht's `CLAUDE.md` (with permission of the author, who is me).

This is the **position document**. It turns the site from a CV into
a stance.

Outline drafted in `MANIFESTO_OUTLINE.md` (this repo). Each principle:
opens with a concrete failure mode, states the principle, shows one
example from my actual work (NachtSchicht / sentry-alert /
digital-masters), ends with a transferable takeaway.

**Blocked by:** Task 9 (NachtSchicht must be public so the post can
link directly to its `CLAUDE.md`).

### Task 8 — NachtSchicht project card *(NEW)*

Add as a third project alongside ddev-claude and sentry-alert.

- Description: "Autonomous task queue for Claude Code with a trust
  protocol. Queue work, sleep, read the morning brief."
- Tags: `ai tooling / autonomous agents / claude code / trust protocol`
- 2–3 sentences on the problem it solves: how do you let an AI agent
  work overnight on real code without losing sleep over what it might
  do? Reversibility, ambiguity-halts, evidence trails.

**Blocked by:** Task 9.

### Task 9 — Open-source NachtSchicht *(NEW — gating task)*

Make NachtSchicht public. Detailed plan lives in
`~/Repos/mine/nachtschicht-repo/plans/open-source.md`.

Phases:
0. Verify the tool still runs end-to-end
1. Rewrite git history to personal email
2. Strip `DIFFLENS.md` and other unrelated artifacts
3. Add LICENSE (MIT)
4. Rewrite README for a public audience
5. Secrets scan (`gitleaks` / `trufflehog`)
6. Push to GitHub
7. Wire to portfolio (Tasks 7 + 8)

Estimate: 2–3 hours of careful work, plus whatever Phase 0 surfaces.

---

## Stretch — *only if Tasks 1–9 are done*

Codex's three technical bets, ranked by signal-per-effort:

- **Small (1–2d):** Static AI-Artifact Console — `/lab` page rendering
  checked-in JSON: prompt diffs, agent traces, eval snapshots.
  Mostly free if Task 4 is well-built.
- **Medium (4–7d):** "Ask my work" RAG search — build-time embeddings,
  edge function, citations.
- **Ambitious (1–2w):** Portfolio MCP server — `get_profile`,
  `list_projects`, `search_evals`, `get_failures`. Defer until after
  the job search starts.

---

## Parallelism map

```
Quick wins (1–2 evenings):
  Task 1   headline, intro, meta
  Task 2   skills reorder + AI Integration framing
  Task 3   ddev-claude reframe
  Task 5   blog on landing

Pre-req:
  Task 9   open-source NachtSchicht         [gates Tasks 7 + 8]

After Task 9:
  Task 7   Brownfield AI manifesto (pinned)
  Task 8   NachtSchicht project card

Independent short track:
  Task 6   failures page (from sentry-alert git log)

Long track (cooks in background):
  Task 4   sentry-triage living eval (v1 → v4)
```

---

## Workflow

1. Read this file
2. Skim current site code
3. Work tasks per parallelism map
4. For each task:
   - Resolve "Decision needed" in-session
   - Make the change
   - Show diff before commit
   - Commit `task(N): <description>`
5. Run site locally between tasks for sanity check

## Out of scope

- Visual redesign (terminal aesthetic stays)
- Adding sections beyond what's listed
- Blog post writing beyond the manifesto (separate effort)
- Moving frameworks (Astro stays)

## Done when

- Visitor reads "AI engineer in production codebases" within 3 seconds
- Skills section leads with **AI Integration** with brownfield framing
  visible in section captions
- Three OSS AI-tooling projects on the page: ddev-claude / sentry-alert
  / NachtSchicht — all public, all linked
- v1 of `/evals/sentry-triage` is shipped and rendered on-site
- Pinned manifesto post live on blog landing
- Failures page has at least 3 entries
- Recent blog posts surfaced on landing

## Anti-pattern check

Three patterns to avoid (all common in 2026 AI-engineer rebrands):

- **Demo zoo:** six toy chatbots. Not us — we have one eval, three
  tools, three failures.
- **Wrapper showcase:** "OpenAI API + Streamlit." Not us — we ship
  trust protocols, sandboxes, eval harnesses.
- **Certificate parade:** logos and badges. Not us — numbers with
  units and dates.

If any task starts drifting toward these, stop and reread the strategic
frame.

---

## Appendix — multi-AI brainstorm summary

| Provider | Key contribution | Unique insight |
|---|---|---|
| 🔴 Codex | Technical artifacts (eval console, RAG search, MCP server) | Make the *site itself* an AI artifact |
| 🟡 Gemini | Ecosystem patterns (Lab Notebook, Mistake Repo, unit-economics calculator) | "AI Engineer" = the new "Full-stack" — diluted |
| 🔵 Claude | Pattern, paradox, naming (Brownfield AI) | The site as a *position document*, not a CV |

**Convergence:** evals as differentiator, failure stories as
credibility, numbers with units beat logos.

**Synthesis:** Brownfield AI frame + three OSS artifacts + one living
eval + one pinned manifesto + a failures page. The kickoff's
incremental tasks deliver this, but no longer define it.
