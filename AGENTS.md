# Website agent instructions

Read `CLAUDE.md` for project conventions and `VERIFICATION.md` for coverage and commands. These are repository instructions; machine-wide harness settings remain centrally managed.

## Deterministic verification first

Encode mechanically decidable requirements in deterministic tests, scripts and CI. Prefer exact assertions over LLM judgments. Use agent review for remaining judgment and to challenge missing contracts; never substitute a model verdict for an available deterministic check.

Use `node scripts/pnpm.mjs install --frozen-lockfile` and `node scripts/pnpm.mjs verify`. Infrastructure has its own package: `node scripts/pnpm.mjs -C infra install --frozen-lockfile`, then `node scripts/pnpm.mjs verify:infra` (a plain install inside `infra/` installs the root package instead). This launcher selects the repository's already installed Node version from the current runtime or fnm/nvm store, then runs pinned pnpm from the package root. Use Node from `.nvmrc` before other commands. `.npmrc` rejects unsupported engines. Resolve routine setup and test failures yourself within the task. Do not hand Florian a startup checklist or ask him to run checks, start a server, investigate dependency peers or interpret ordinary command output.

`pnpm verify` builds the site and runs the deterministic site suites. `pnpm verify:infra` runs the existing infrastructure checks without deploying. Missing reports, errors, empty suites, skipped tests and focused tests are unsuccessful verification. CI runs the same site command. TesterArmy is the browser runner; browser tests stay deterministic, with no agents or model calls in the gate. Browser failures retain screenshots, traces and exact test names under `reports/browser/`.

Before pinning a new dependency, inspect its actual peer requirements. Before coding against an external API or report, inspect the actual data or installed types. Execute package commands with the tool's working directory explicitly set to the package root. Use the existing preview script; it selects the permitted host and shuts down its server. Do not recreate these resolutions per task.

## Implementation and review

1. State the requested behavior as acceptance examples; add or update exact regression assertions for changed behavior.
2. Implement the change and run verification. Diagnose failures and repair routine reversible problems; rerun affected checks, then the required gate.
3. Push the branch and open the PR, then run an **independent review**. This is mandatory for every change to code, tests, config or automation, including spikes. The reviewer is a separate agent with fresh context, not the implementer reviewing its own diff. Give it the repository-qualified task URL, the exact base and head commit, the acceptance examples and [`REVIEW.md`](REVIEW.md), which is its checklist and output format. It reviews the pushed head; do not edit or mutation-test that tree while it runs. Mutation-test a copy, not the live file.
4. Fix every blocking finding, push, and re-review the affected code on the new head. A review in another session must be passed explicitly to the implementer; include location, failure and expected behavior. Post the final verdict as a PR comment: reviewer, reviewed head SHA, PASS/FAIL, and how each finding was resolved. A PR without a PASS verdict on its current head is not done.
5. Return the result, commands, report location and remaining uncertainty. A passing build alone does not establish functioning interactions. When porting tests, map each old assertion to its new form before the first run and flag every downgrade. After `git rm`/`git mv`, commit with explicit paths or check `git diff --cached --stat` so staged deletions do not leak into an unrelated commit. Keep incidental broader findings in a buffer instead of silently expanding scope.

Never weaken assertions, increase retries, skip a failing case or regenerate a visual baseline solely to make verification green. Changes to an acceptance contract require the task's actual intended behavior and an explanation in the review. A successful deterministic gate is evidence of the documented coverage, not by itself permission to merge.

## Merge and deploy

This is a personal repository. Florian has authorised agents to merge and deploy their own PRs here without waiting for him, so we learn how agent-owned delivery feels and which guardrails it needs. Breakage is acceptable; hiding it is not.

- Merge (squash) only when CI is green on the head commit, `pnpm verify` and `pnpm verify:infra` passed locally, and the PR has an independent review PASS verdict for that exact head. Never self-approve, merge red, skip or disable a check, or force-push `main`.
- Merging publishes the site through `deploy.yml`. Watch that run to completion and check the changed pages on https://friquelme.dev. CDK changes are not deployed by CI: after merge, deploy them with `node scripts/pnpm.mjs -C infra cdk deploy` when AWS credentials are available on the host (otherwise report the deploy as pending), then check production the same way.
- If production breaks, fix forward or revert immediately. Record what broke and why in the PR and in an issue labelled `agent-merge`, so the incident becomes a guardrail.
- Spikes and investigations whose output is a write-up deliver it on their issue or PR, not in a gitignored or scratch file.
