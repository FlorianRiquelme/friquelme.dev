# TesterArmy trial — friquelme.dev issue 75

Local/manual experiment for [issue 75](https://github.com/FlorianRiquelme/friquelme.dev/issues/75). The ChatGPT-subscription trial is **complete**: three live and three cached healthy runs, both controlled failures/retries, restoration and reviewed exploration; see [ASSESSMENT.md](ASSESSMENT.md). Nothing here installs a CI gate or changes the shipped website.

Follow-up: the site's required browser gate now runs deterministic TesterArmy tests from the repository root (`tests/e2e/`, see [VERIFICATION.md](../../VERIFICATION.md)), without agents, models or credentials. This directory remains the optional model-backed supplement. Its runner (`scripts/run.mjs`) does not validate `explore` outcomes: an exploration that errors or writes no report is not rejected, so review exploration reports directly rather than relying on the runner's exit status.

## Acceptance examples (declared before implementation)

- At 1280×900, follow the homepage header's blog link to exactly `/blog/`, then the pinned “designing for the operator” essay to exactly `/blog/designing-for-the-operator/`. Verify the article title and first section heading. Check the actual pinned `href` so an agent cannot compensate for the wrong destination.
- At 390×844, the pinned essay title is readable, horizontally unclipped and unobscured. The agent check uses `vision: true`; DOM visibility alone does not meet this requirement.
- Wrong-link response variant: only the pinned link points to `/blog/brownfield-ai/`; the exact link check must fail. Mobile-overlay response variant: an opaque, aria-hidden fixed rectangle covers the title; DOM visibility still passes and the visual assertion must fail.
- Restore healthy responses and rerun. The server transforms response bytes in memory; production source and `dist` are never patched for defects.

## Reproduce

Use pnpm 10.25.0 and the repository's Node version (`.nvmrc`, currently 24). The implementation machine initially ran Node 22.23.2; that limitation is recorded in the assessment. All direct dependencies are exact pins, with transitive dependencies/integrity recorded in the separate lockfile: e2e 0.16.0, web engine 0.11.2, Playwright 1.63.0, AI SDK 7.0.127, OpenAI provider 4.0.83, TypeScript 6.0.3, Node types 24.10.1.

From repository root:

```sh
pnpm install --frozen-lockfile
pnpm build
cd trials/testerarmy
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm exec tsc --noEmit
E2E_TELEMETRY_DISABLED=1 pnpm exec e2e list
pnpm trial control
```

The default fixture URL is `http://100.84.161.116:14375`. Each runner starts and stops its own server, bound only to that tailnet IP. `TRIAL_PORT=14377 pnpm trial control` selects another port. Browsers run locally; this is a responsive Chromium viewport experiment, not actual iOS/device coverage. External network resources are still those referenced by the built public site.

No upstream initializer is run, so no skills/MCP/harness configuration is written. e2e's default HTTP URL policy conflicts with the machine preview rule. The committed pnpm patch permits **only** `100.84.161.116` in `normalizeBaseUrl`; it does not change global loopback detection, credentials, navigation, judgments or cache eligibility. The explicit app environment is `test`. This makes results those of **0.16.0 plus the committed URL patch**, not unmodified upstream.

## Provider setup

Do not read/import personal Codex/Claude harness credentials. This trial used its own supported device login, approved by Florian, and `gpt-6-luna`. A ChatGPT subscription removes the separate API-key requirement, but the tool still needs authentication. On a new machine, configure one authorized provider:

```sh
# ChatGPT subscription: its own supported login, completed by the human.
E2E_TELEMETRY_DISABLED=1 pnpm exec e2e login openai --device
E2E_TELEMETRY_DISABLED=1 pnpm exec e2e models openai
export TRIAL_PROVIDER=chatgpt
export TRIAL_MODEL=gpt-6-luna # used in this trial; confirm account availability

# Alternative: securely export OPENAI_API_KEY in the launching environment.
export TRIAL_PROVIDER=openai
export TRIAL_MODEL='<an authorized image/tool-capable model ID>'
```

The subscription uses `~/.config/e2e/oauth.json` (or XDG config location), outside git. No hosted signup is needed. The model is deliberately not defaulted: select one available to the approved account. A different provider requires explicit choice and adapting the config. Package docs: [subscriptions](https://e2e.tester.army/docs/subscriptions), [models](https://e2e.tester.army/docs/models).

After login:

```sh
pnpm trial matrix
# Or just the bounded exploration:
pnpm trial explore
```

`matrix` runs three healthy live cases, a separate cache warm-up, three healthy cache-enabled cases, both defects live, restoration live, and a three-step/180-second exploration at 390×844. Inspect actual `step.cache` outcomes; enabling cache is not evidence that replay occurred. AI assertions still run live. Retries are explicitly **one whole-test retry**; report first attempts separately. e2e also has up to five SDK retries for transient provider failures, bounded by the step deadline. Exploration disables cache/test retries. Agent calls have a ten-action/ten-model-call ceiling per step, judgment timeout 60 seconds and test deadline 180 seconds. Exploration has no statistical coverage claim.

Every invocation creates `results/<timestamp>-<mode>-<uuid>/`, with commands, timings, full reports, screenshots, traces and AI trace. The cache stays at `.e2e/cache/` independently of unique output directories. `.trial.lock` prevents concurrent runners sharing the port/cache; after a hard kill, verify the old processes are stopped before removing that lock. The runner rejects missing reports and distinguishes expected product assertions from provider/engine errors. For detailed usage, inspect `summary.json` and per-step metrics; absent cost data means unknown, not zero. Raw results/AI traces are git-ignored and must stay private. Export a finished run's allowlisted outcomes, accounting and selected public-site screenshots, then review before publishing:

```sh
pnpm export:evidence '<timestamp>-matrix-<uuid>'
```

The exporter excludes model turns, reasoning events, prompt/credential fields and command logs. Free-form errors and finding descriptions still require manual privacy review; exporting is not a redaction guarantee. The actual trial's reviewed selection contains public-site outcomes and is linked from the assessment.

## Review evidence and session record

- [Assessment](ASSESSMENT.md), [friction](FRICTION.md), [findings buffer](FINDINGS.md), [sanitized execution record](evidence/EXECUTION.md).
- [Session access and capture limits](SESSION.md) documents the durable private record and access from agent-server. Raw logs include private context and must stay private.
- Existing checks: `pnpm test`, `pnpm test:infra`, `pnpm exec astro check`, `pnpm -C infra exec tsc --noEmit`, `pnpm build`. The independent trial is excluded from the root Astro TypeScript project so required site CI does not acquire its model/browser dependencies.

Sources used: installed package documentation and declarations, [quickstart](https://e2e.tester.army/docs/quickstart), [cache](https://e2e.tester.army/docs/cache), [agent assertions](https://e2e.tester.army/docs/reference/agent), [exploration](https://e2e.tester.army/docs/explore). Cache verification must establish the intended result; a passing exploration means no qualifying issue was found in the bounded exploration.
