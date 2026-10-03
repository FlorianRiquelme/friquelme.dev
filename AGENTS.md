# Website agent instructions

Read `CLAUDE.md` for project conventions and `VERIFICATION.md` for coverage and commands. These are repository instructions; machine-wide harness settings remain centrally managed.

## Deterministic verification first

Encode mechanically decidable requirements in deterministic tests, scripts and CI. Prefer exact assertions over LLM judgments. Use agent review for remaining judgment and to challenge missing contracts; never substitute a model verdict for an available deterministic check.

Use `node scripts/pnpm.mjs install --frozen-lockfile` and `node scripts/pnpm.mjs verify`. This launcher selects the repository's already installed Node version from the current runtime or fnm/nvm store, then runs pinned pnpm from the package root. Use Node from `.nvmrc` before other commands. `.npmrc` rejects unsupported engines. Resolve routine setup and test failures yourself within the task. Do not hand Florian a startup checklist or ask him to run checks, start a server, investigate dependency peers or interpret ordinary command output.

`pnpm verify` builds the site and runs the deterministic site suites. `pnpm verify:infra` runs the existing infrastructure checks without deploying. Missing reports, errors, empty suites, skipped tests and focused tests are unsuccessful verification. CI runs the same site command. TesterArmy is the browser runner; browser tests stay deterministic, with no agents or model calls in the gate. Browser failures retain screenshots, traces and exact test names under `reports/browser/`.

Before pinning a new dependency, inspect its actual peer requirements. Before coding against an external API or report, inspect the actual data or installed types. Execute package commands with the tool's working directory explicitly set to the package root. Use the existing preview script; it selects the permitted host and shuts down its server. Do not recreate these resolutions per task.

## Implementation and review

1. State the requested behavior as acceptance examples; add or update exact regression assertions for changed behavior.
2. Implement the change and run verification. Diagnose failures and repair routine reversible problems; rerun affected checks, then the required gate.
3. Review the diff against acceptance and repository conventions. Challenge assertions that could pass on deliberately broken behavior. If another agent reviews the change, give it the repository-qualified task URL, exact base/head and acceptance examples.
4. Address concrete review findings before claiming completion. A review in another session must be passed explicitly to the implementer; include location, failure and expected behavior. Repeat review of affected code after correction.
5. Return the result, commands, report location and remaining uncertainty. A passing build alone does not establish functioning interactions. Keep incidental broader findings in a buffer instead of silently expanding scope.

Never weaken assertions, increase retries, skip a failing case or regenerate a visual baseline solely to make verification green. Changes to an acceptance contract require the task's actual intended behavior and an explanation in the review. A successful deterministic gate is evidence of the documented coverage, not permission to merge or deploy. Production publishes on merge to `main`; infrastructure changes/deploys require separate authority.
