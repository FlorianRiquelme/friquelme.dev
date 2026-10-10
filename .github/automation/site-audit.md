# Live site audit

You are running unattended in a fresh worktree of `FlorianRiquelme/friquelme.dev` off `main`. `gh` is authenticated as the repository owner. Read `AGENTS.md` and `CLAUDE.md` before changing code. Use `node scripts/pnpm.mjs <args>`, never npm or yarn.

Your job is to keep https://friquelme.dev healthy **without Florian being the bottleneck**. Triage every new finding yourself. Fix what is safely fixable, record what is noise, and escalate only real decisions. Florian's part should be merging a green PR or answering one question you have already narrowed down.

## Hard rules

- Never push to `main`, never merge, never force-push, never deploy, never run `cdk` or any AWS command.
- Never modify `infra/`, `.github/workflows/`, `.github/automation/*.md`, `package.json` dependencies or lockfiles. Findings that need those are escalated.
- Change `.github/automation/site-audit-baseline.json` only through a pull request.
- Never weaken, skip or delete a test to make verification pass.
- At most one comment per issue or PR per run.
- Silent run: when there are no fresh findings, no stale baseline entries and nothing to close, create nothing and comment nowhere.

## 1. Audit the live site

```bash
export PATH="$HOME/.local/bin:$PATH" NO_TELEMETRY=1 TMPDIR="${TMPDIR:-/tmp}"
command -v squirrel || curl -fsSL https://install.squirrelscan.com | bash
curl -fsS -o /dev/null https://friquelme.dev/ || exit 0   # site down is a different alarm; stop quietly
squirrel audit https://friquelme.dev -C full --offline -y --refresh --format json -o "$TMPDIR/site-audit.json"
node scripts/site-audit-diff.mjs "$TMPDIR/site-audit.json" > "$TMPDIR/site-audit-diff.json"
```

If the audit fails or `meta.totalPages` is 0, retry once. If it still fails, open or update the issue `site-audit: audit could not run` with the error output, then stop.

`fresh` lists findings the baseline does not cover, and `stale` lists baseline entries that no longer match anything. Fingerprints have the form `<rule> :: <item|page|(site)>`.

## 2. Load what is already in flight

```bash
gh issue list --label site-audit --state open --json number,title,body
gh pr list --label site-audit --state open --json number,title,body,headRefName
```

Every issue and PR this automation writes ends with a fingerprint block:

```
<!-- site-audit
fingerprints:
- <fingerprint>
-->
```

A fresh finding whose fingerprint appears in an open issue or PR is already handled, so skip it.

## 3. Close the loop on resolved work

- Look at each open issue **carrying a fingerprint block**. If none of its fingerprints appear in the current audit at all (fresh or baseline-covered), comment `No longer reported by the live audit on <YYYY-MM-DD>.` and close it. Leave issues without a block (human-written ones) open.
- For each stale baseline entry, remove it in the baseline PR (step 4b). If the entry is `tracked`, comment once on its issue that the live site no longer shows the finding, but do not close that issue.

## 4. Triage each fresh finding

Group fresh findings by rule. For each group, look at the live HTML (`curl -s <page>`) and the source that renders it, and the rule docs at `https://docs.squirrelscan.com/rules/<rule>`. Then pick exactly one outcome.

### 4a. Fix: real defect, safe to change

Use this when the cause is in `src/` (pages, components, layouts, content, `src/lib`) and the fix needs no design-direction, copy-voice or legal judgment. Follow DESIGN.md's named rules and hard bans.

1. Branch `site-audit/fix-<rule-slug>` from `main`.
2. Add or tighten a deterministic assertion that fails before your fix (unit, Astro Container, build or browser test). If no deterministic check is possible, say so in the PR.
3. Fix it. Run `node scripts/pnpm.mjs verify`; it must exit 0. On failure, diagnose and repair. If you cannot get it green, escalate instead (4c) and include the failure.
4. Open a ready-for-review PR (not draft) with label `site-audit`. The body covers the finding, evidence (the live HTML excerpt), root cause, the fix, the new assertion, and the verify result, followed by the fingerprint block. Write it so Florian can merge without re-deriving anything.

At most three fix PRs per run. Escalate the rest under 4c, noting they are fixable and queued.

### 4b. Baseline: false positive or accepted

Use this when the rule is wrong for this markup, or the finding is true but intended (an existing design decision or a hosting constraint). Add one entry per finding to `.github/automation/site-audit-baseline.json` with `verdict` and a one-sentence `reason` that names the evidence. Use a `<rule> :: *` wildcard only when a deterministic test already covers the real concern, and name that test.

All baseline changes from this run, including stale-entry removals, go into **one** PR from branch `site-audit/baseline`. If that PR is already open, push a commit to it instead of opening another. Label it `site-audit` and list each entry with its evidence. Run `node scripts/pnpm.mjs exec vitest run tests/unit/site-audit-diff.test.ts` before pushing.

### 4c. Escalate: needs Florian

Use this for anything touching legal, design direction, copy voice, `infra/` or CloudFront headers, or dependencies, plus fixes that failed verification. Open or update one issue per squirrelscan category, titled `site-audit: <Category>`, labelled `site-audit`. The body gives the findings, the evidence, **your recommendation**, and the options. Make it answerable with one reply. When the issue already exists, edit its body to add the new fingerprints and post one comment summarising what changed.

## 5. Finish

Print a short summary of the audit score, the fresh, stale and closed findings, and what you opened or updated, with links. Do not create a digest issue.
