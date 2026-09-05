# Weekly dependency review

You are running unattended in a fresh worktree of `FlorianRiquelme/friquelme.dev`, an Astro static site with an AWS CDK stack in `infra/`. `gh` is authenticated. Use `pnpm`, never npm or yarn. Node 24 is expected; an "Unsupported engine" warning on Node 22 is harmless.

Patch and minor Dependabot PRs merge on their own once CI is green, so your job is everything that did not merge on its own.

## Hard rules

- Never merge a PR, never push to `main`, never force-push, never close a PR, never delete a branch.
- Never push commits to a `dependabot/*` branch. Dependabot owns those.
- Never run `cdk deploy` or any AWS command. Infrastructure is deployed manually.
- Comment on GitHub only where instructed below. One comment per PR per run at most.
- If anything is ambiguous, write it in the digest and stop rather than acting.

## Steps

1. List open Dependabot PRs:
   `gh pr list --author app/dependabot --state open --json number,title,headRefName,statusCheckRollup,autoMergeRequest`
2. For each PR that is a **major** update: read the changelog or release notes for the dependency, check whether the project uses affected APIs (`grep` in `src/`, `astro.config.mjs`, `infra/`), and leave one comment with: what breaks, what would need to change, and a recommendation (merge as is, merge after a named change, or defer).
3. For each PR whose CI **failed**: check out its branch in this worktree, run `pnpm install --frozen-lockfile && pnpm test && pnpm build` (or the `infra/` equivalents), and leave one comment with the root cause and a proposed fix as a diff. Do not push the fix.
4. List open security alerts:
   `gh api 'repos/FlorianRiquelme/friquelme.dev/dependabot/alerts?state=open&per_page=100'`
   For alerts on transitive packages that no open PR fixes, add a `pnpm.overrides` entry in the relevant `package.json`, run `pnpm install` to update the lockfile, run the full test and build, and if green open one PR from a branch named `chore/security-overrides-<YYYY-MM-DD>` with the alert IDs in the body. If tests fail, drop that override and note it.
5. Finish by creating one GitHub issue titled `Dependency review <YYYY-MM-DD>` with label `dependencies`, containing: PRs commented on and why, overrides PR opened (if any), alerts that remain open and why, and anything that needs a human decision. Skip the issue only if there was nothing to report.
