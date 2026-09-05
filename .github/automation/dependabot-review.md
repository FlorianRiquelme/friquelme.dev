# Daily dependency review

You are running unattended in a fresh worktree of `FlorianRiquelme/friquelme.dev`, an Astro static site with an AWS CDK stack in `infra/`. `gh` is authenticated as the repository owner. Use `pnpm`, never npm or yarn. Node 24 is expected; an "Unsupported engine" warning on Node 22 is harmless.

You are the only gate on dependency updates. Nothing merges unless you merge it, and a merge to `main` triggers a production deploy to AWS. Treat every merge as a release.

## Hard rules

- Merge **only** pull requests authored by `dependabot[bot]`. Never merge a PR opened by anyone else, including PRs opened by earlier runs of this automation.
- Merge only when every check in the next section passes. If any check is inconclusive, leave the PR open and say why in a comment.
- Never push to `main`, never force-push, never push to a `dependabot/*` branch, never close a PR, never delete a branch.
- Never modify branch protection, rulesets, or anything under `.github/`.
- Never run `cdk deploy` or any AWS command. Infrastructure is deployed by hand.
- At most one comment per pull request per run.
- If anything is ambiguous, write it in the digest issue and stop rather than acting.

## Per-PR checks, all required before merging

Start from `gh pr list --author app/dependabot --state open --json number,title,headRefName,statusCheckRollup,mergeable`.

1. **Scope.** `gh pr diff <n> --name-only` must list only `package.json`, `pnpm-lock.yaml`, `infra/package.json`, `infra/pnpm-lock.yaml`, or a workflow file where the only change is an action version pin. Anything else: do not merge, comment.
2. **CI.** Both the `site` and `infra` checks are SUCCESS on the current head. Never merge with a check pending, failed, or missing.
3. **Advisories.** The incoming version must carry no open advisory:
   `gh api "/advisories?ecosystem=npm&affects=<package>@<new-version>&per_page=100" --jq '[.[] | select(.withdrawn_at==null)] | map(.ghsa_id) | join(",")'`
   A non-empty result means do not merge. Comment with the advisory IDs. Report it even when the bump still reduces the advisory count, because merging would ship a known-vulnerable version.
4. **Local verification.** Check out the PR branch in this worktree and run `pnpm install --frozen-lockfile && pnpm test && pnpm build`. When the PR touches `infra/`, also run `pnpm -C infra install --frozen-lockfile && pnpm -C infra test`. Every command must exit zero. A green CI check does not excuse you from this.
5. **Breaking changes, majors only.** Read the release notes. Grep `src/`, `astro.config.mjs`, `tests/`, and `infra/` for each documented breaking change. Merge a major only when nothing in this codebase touches one. Otherwise comment with what would have to change and leave it open.

Merge with `gh pr merge <n> --squash`. Merge one pull request at a time. After each merge the other open lockfiles are stale, so re-check mergeability; for any that became conflicted, post `@dependabot rebase` and leave them for tomorrow's run rather than resolving conflicts yourself.

## Security alerts

List open alerts with `gh api 'repos/FlorianRiquelme/friquelme.dev/dependabot/alerts?state=open&per_page=100'`.

For alerts on transitive packages that no open Dependabot PR fixes, add a `pnpm.overrides` entry in the relevant `package.json`. Keep every override that is already there; removing one reintroduces the vulnerability it was added for. Prefer a bounded range in the existing style, such as `"tar@<7.5.21": ">=7.5.21"`, over an exact pin. Run `pnpm install`, then the full test and build. If green, open one pull request from branch `chore/security-overrides-<YYYY-MM-DD>` listing the alert IDs each override closes. **Never merge that pull request**; a human reviews it.

If such a branch from an earlier run is still open, push follow-up commits addressing its review comments instead of opening a second one.

## Digest

Create one issue titled `Dependency review <YYYY-MM-DD>` with label `dependencies` **only when something needs a human**: a PR you could not merge, an advisory with no available fix, a failed verification, or an overrides PR awaiting review. List what you merged in that issue for context.

If everything merged cleanly and nothing is outstanding, create no issue and post no comments.
