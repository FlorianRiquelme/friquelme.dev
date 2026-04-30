# Brownfield AI — Manifesto Post Outline

> Working draft. Final post lives at `src/blog/brownfield-ai.mdx`,
> pinned on the blog landing. Target length: 1200–1700 words.
> Goal: turn friquelme.dev from CV into position document.

---

## Working titles (pick one)

1. **Brownfield AI** *(short, ownable, the title carries the thesis)*
2. **Six Principles for Shipping Autonomous AI in Production**
3. **The Trust Protocol: Notes from a Brownfield AI Engineer**
4. **Threading the Model Through the Codebase**

I'd lead with **"Brownfield AI"** as the title, with a sharper subtitle
underneath:

> *Six principles for shipping autonomous AI inside real codebases —
> not greenfield labs.*

## Audience

- Hiring engineers / engineering managers at AI-enabled companies
  (not AI-native research labs)
- Senior engineers thinking about their own AI repositioning
- Recruiters scanning for signal beyond keyword match

Not the audience: ML researchers, prompt-engineering hobbyists, people
looking for a tutorial.

## Tone

Terminal-aesthetic, but the writing is the focus. Short paragraphs.
Strong opinions. Concrete examples from my actual work. No hedging.
No "AI-driven." No model-name lists.

If a reader can't quote one principle back from memory after reading
once, the post failed.

---

## Structure

### Lead (≈150 words)

Open with a scene. Suggested:

> It's 2 AM. An autonomous agent has been working on a refactor in your
> codebase for three hours. You're asleep. In the morning, you'll read
> a summary and decide whether to merge.
>
> What does the system have to *do* — and *not do* — to make that
> sentence one you'd accept?
>
> This is the brownfield AI question. Not "can the model write code?"
> (it can). Not "can it run tests?" (it can). The question is: *can it
> work safely inside a real codebase, with real users, without me
> losing trust?*

Pivot into: most AI-engineer content is about greenfield — clean
slates, fresh repos, demo problems. Most actual AI engineering
happens in brownfield: 10-year-old codebases, non-technical teams,
real P&L. These aren't the same job. This post is six principles I
work by, drawn from three tools I've built and use every day.

### Set up the three tools (≈100 words)

Brief intro to the artifacts the post will draw on:

- **NachtSchicht** *(github.com/...)* — autonomous task queue for
  Claude Code with a trust protocol. The principles are codified in
  its `CLAUDE.md`.
- **sentry-alert** *(github.com/...)* — LLM-driven Sentry triage with
  cost-aware 2-tier diagnosis and a feedback loop. See the eval
  harness at `evals/sentry-triage/`.
- **ddev-claude** *(github.com/...)* — sandboxed dev environments for
  AI coding assistants.

Three different surfaces, same six principles. Here they are.

---

## Principle 1 — The Morning Brief Is the Product

**Failure mode it prevents:** AI silently does work and you don't know
what changed.

**Concrete example.** NachtSchicht's morning brief is structured: what
changed, what was verified, what failed, what was rolled back, what
needs human judgment. *Ambiguity gets its own section, never silence.*
Compare to: "agent ran successfully ✓" — which tells you nothing.

**The principle.** The artifact your team reads — the brief, the
report, the alert — is what you actually shipped. Not the automation.
Not the model call. The legible, trustworthy *output that humans use*.

**Transferable lesson.** Every AI feature has a "brief." For an alert
classifier it's the Slack message. For a RAG system it's the cited
answer. Make the brief the product, not the byproduct.

**Closing line.** *If the brief isn't the contract, you don't have a
system. You have a vibe.*

---

## Principle 2 — Rigor Scales with Blast Radius

**Failure mode it prevents:** uniform strictness — either too slow on
small things, or too reckless on big things.

**Concrete example.** sentry-alert runs a 2-tier diagnosis pipeline:
cheap Haiku triage classifies incoming Sentry events; only flagged
cases escalate to deep analysis. Cost dropped 80%+ without losing
recall on production-breaking issues. This is risk-proportional
verification: a typo fix doesn't deserve the same proof burden as a
schema migration.

**The principle.** Match verification intensity to the scope of impact.
Classify automatically; don't make the user choose.

**Transferable lesson.** "Always run all tests" is the wrong answer.
"Never run tests" is the wrong answer. *Classify first.* The
sophistication of an AI system is mostly in its routing.

**Closing line.** *Uniform strictness is wrong in both directions.*

---

## Principle 3 — Ambiguity Halts, It Does Not Improvise

**Failure mode it prevents:** scope drift. The agent guesses, gets it
wrong, and you discover at 9 AM.

**Concrete example.** NachtSchicht stops and queues a question for
morning when scope is unclear, instead of proceeding on a guess. One
wrong improvisation costs more than a hundred halted ambiguities.

**The principle.** Where scope is unclear, halt and document. Never
resolve ambiguity by acting.

**Transferable lesson.** This is the hardest principle to internalize
because LLMs are *built* to fill gaps. Their default failure mode is
plausible-sounding wrong answers. The discipline is recognizing the
gap and refusing to fill it.

**Closing line.** *A thousand correct decisions build trust slowly.
One wrong improvisation destroys it fast.*

---

## Principle 4 — Reversibility Is Architecture, Not a Feature

**Failure mode it prevents:** "I'll add safety later." (You won't.)

**Concrete example.** ddev-claude exists because running Claude Code
against a real codebase without a sandbox is a bad idea — not because
the model is malicious, but because *you can't undo a `rm -rf` from a
plausible-sounding tool call*. Sandboxing isn't a safety feature; it's
the structural foundation that makes the rest of the work
psychologically viable.

**The principle.** Every action the system takes must be reversible by
default. Irreversible operations require explicit human
pre-authorization.

**Transferable lesson.** Brownfield AI lives or dies on this. The
reason senior engineers can use Claude Code on production codebases
*at all* is that branches, commits, and PRs make most actions
reversible. Build for the same property in your own AI features.

**Closing line.** *Can the developer undo this with one command? If
not, it needs pre-authorization or a different approach.*

---

## Principle 5 — Evidence Compounds into Trust

**Failure mode it prevents:** "trust me, the AI handled it."

**Concrete example.** Both NachtSchicht and sentry-alert log every
attempt: what was tried, what was checked, what failed, what was
retried, the final state. sentry-alert tracks per-call cost and a
feedback signal from end users. Over time this trail becomes the
system's reputation: tasks completed, merge rate, rejection rate. The
system *earns* autonomy empirically — it isn't granted upfront.

**The principle.** Every run produces an immutable evidence trail. Over
time, trust accrues. Without the trail, every run starts from zero.

**Transferable lesson.** The first six months of any production AI
system are about trust acquisition, not feature shipping. If you don't
have an evidence trail, every stakeholder meeting becomes a relitigation.

**Closing line.** *No trail, no trust. No trust, no autonomy.*

---

## Principle 6 — One-Word UX

**Failure mode it prevents:** every AI feature requires a manual.

**Concrete example.** NachtSchicht's interface is `nacht`. One command.
Not because only one command exists — but because bare `nacht` always
*tells you what to do next* by detecting your current state and
surfacing the 1–3 relevant actions. Subcommands exist; the router
*surfaces* them, doesn't *replace* them.

**The principle.** Simplicity comes from never needing to choose, not
from having fewer choices. The interface should guide, not gate.

**Transferable lesson.** AI features are notorious for surfacing too
much capability. The right move is contextual disclosure — show the
right action for the current state, hide the rest. Same principle as
good CLI design, just with state inference doing the routing.

**Closing line.** *The user should always know what to do next without
reading the docs.*

---

## Closing (≈150 words)

Naming-the-discipline paragraph:

> These six principles aren't unique to me. Anyone shipping AI in
> production codebases hits them eventually. What's missing is the
> *name*. Greenfield AI gets the magazine covers; brownfield AI ships
> the products. The discipline deserves a label.
>
> Brownfield AI is the work of taking an existing codebase, an existing
> team, and an existing P&L, and threading LLMs through them without
> breaking trust. It's mostly *not* AI work. It's eval design, change
> management, sandbox engineering, evidence trails, and the boring
> scaffolding that lets non-technical teams trust probabilistic
> systems.
>
> If you're hiring for that — that's the work I want to do.

CTA / signature line:

> *I'm a senior engineer leading AI adoption at digital-masters
> (Hamburg). If your team is shipping AI to real users and could use a
> brownfield AI engineer, the contact form is two scrolls down.*

---

## Distribution / cross-posting

After publish:
- LinkedIn post linking to the manifesto with the lead paragraph as
  the hook
- Mastodon / Bluesky / X with one principle per thread reply
- Hacker News? Risk: HN tone leans cynical on AI manifestos. Skip
  unless I have a sharper title.
- Submit to *Hacker Newsletter* / *TLDR AI* via reader submission
  (they often pick personal essays with strong opinions)

## Length / pacing budget

| Section | Words |
|---|---|
| Lead | 150 |
| Three-tools intro | 100 |
| Principles 1–6 | 6 × ~150 = 900 |
| Closing | 150 |
| **Total** | **~1300** |

Trim aggressively. Every word should be earning its place. If a
sentence sounds like it could be in any AI blog post, cut it.

## Failure modes for the post itself

- ❌ Too academic — reads like a paper. Fix: keep examples concrete,
  use "you," cut hedge words.
- ❌ Too self-promotional — every paragraph plugs my tools. Fix: lead
  with the principle and the failure mode, *then* the example.
- ❌ Too generic — could apply to any "responsible AI" post. Fix: each
  principle should name a specific failure I've actually seen.
- ❌ Too long — wall of text. Fix: short paragraphs, hard breaks
  between principles, terminal-styled callouts where the design
  permits.

## Open questions before drafting the full post

- Final title? (Recommendation: **Brownfield AI**)
- Are the three tools' GitHub URLs all public when this lands?
  (Task 9 must complete first.)
- Do I want to name the digital-masters case study explicitly, or
  keep it generic? (Recommendation: name it — already on the about
  page, no new exposure.)
- Hero image? Or terminal-styled pull quote? Or just text?
  (Recommendation: terminal-styled pull quote of one principle.)
- Comments / discussion link? (Recommendation: link to a GitHub
  Discussions thread on NachtSchicht — keeps engagement on a public
  surface, drives traffic to the tool.)

## Status

- [x] Outline drafted
- [ ] Final title selected
- [ ] First draft written
- [ ] Self-edit pass (cut 20%)
- [ ] One trusted reader review
- [ ] Final polish + terminal-style typography in post
- [ ] Publish + pin on blog landing
- [ ] LinkedIn / Mastodon distribution
