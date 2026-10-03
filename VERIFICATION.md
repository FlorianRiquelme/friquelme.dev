# Website verification

Deterministic tests are the default delivery gate. Known requirements are encoded as exact assertions and run without model calls or provider credentials. Agents own execution, diagnosis and routine remediation. This document supplies context for those actions; it is not a human checklist.

## Commands

Use `node scripts/pnpm.mjs <pnpm arguments>` for local commands. The launcher selects the installed Node version declared in `.nvmrc` from the current runtime or standard fnm/nvm stores and sets the package working directory without an LLM decision. It fails clearly if that runtime is unavailable; the agent owns remediation. CI already selects `.nvmrc` with setup-node. Use the pinned pnpm. Install root dependencies with `pnpm install --frozen-lockfile` and browser binaries with `pnpm exec playwright install chromium firefox webkit`. CI installs browser system dependencies as well. On a host already carrying a Node 24 installation, select that runtime in the command environment rather than tolerating an engine mismatch.

- `pnpm verify` runs type checks, unit/component tests, build, generated-output/HTTP tests, browser tests and verification-report regression tests. It stops on a failure and writes `reports/verification/summary.json` with stage outcomes. Each invocation deletes prior reports before running, so stale success cannot certify a new attempt.
- `pnpm verify:infra` runs type checks and the existing CDK assertion tests, validates their report and writes `reports/verification-infra/summary.json`. Empty, skipped, focused and unsuccessful runs fail this gate too. Install `infra/` dependencies with its frozen lockfile first. It makes no AWS calls.
- `pnpm test:build` builds once and runs output and HTTP checks. `pnpm test:dist` checks an already built site.
- `pnpm test:browser` builds once and runs the browser suite. `pnpm exec playwright test --project=mobile-chromium` is a focused rerun against an existing build.
- `pnpm test:mutation` remains the existing focused mutation suite for SEO/CSP. It supplements the ordinary gate and is appropriate when changing those contracts.

## Coverage

| Surface | Deterministic evidence |
| --- | --- |
| Every published HTML page | Sitemap-derived cases; one visible H1, exact canonical/OG URL, valid structured data, real image loading, no browser exceptions/local 4xx assets, no horizontal overflow, automated WCAG A/AA rules |
| Homepage | Section navigation, actual project destinations, contact mail link, terminal completion with ordinary motion and content availability with reduced motion |
| Navigation | Homepage → blog → exact pinned article → back; mobile opening/closing, Escape, focus cycling/restoration and body scroll unlock; desktop keyboard activation |
| Every article | Table of contents target navigation, related and adjacent article links, article schema/body, Open Graph image format/dimensions |
| Build/link graph | Internal page, anchor and asset existence across every sitemap page; nonempty unique sitemap covering every built HTML page, exact RSS article membership and LLM discovery links |
| HTTP surfaces | Homepage/blog and generated images served with correct status/types; discovery/feed endpoints |
| Domain/components/security | Existing unit, Astro Container and SEO/CSP tests retained |
| Infrastructure | Existing CDK assertions and TypeScript checks retained in the separate infra gate |
| Verification itself | Missing/malformed/empty reports, skipped tests, process/report disagreement and browser operational errors cannot return successful verification; interruptions preserve their signal and stop descendant processes |

Browser cases run at 1280px in Chromium, Firefox and WebKit, and at 390px in Chromium and WebKit, plus a 320px Chromium reflow case. All discoverable sitemap pages receive the same page contracts, so newly published posts are included automatically. Browser engines emulate these viewports; this is not a physical-device certification.

Browser execution uses one worker and Vitest uses at most two to bound memory on shared hosts and CI. Generated reports are excluded from type-check input. Engine and peer incompatibilities are installation errors. No retry is used to turn a flaky first attempt into success. Focused test execution is forbidden in CI and ordinary runs. Skipped or empty suites invalidate the gate. Assertions can be added as features evolve; the suite does not claim exhaustive defect coverage.

## Failure handling and review

Inspect the failing stage and its JSON report, screenshot or trace, reproduce the exact behavior and fix the cause. Use `scripts/preview.mjs` for a preview: on agent-server it binds the tailnet interface, elsewhere loopback; the caller owns shutdown. Ports 14321/14322 are reserved for the HTTP/browser suites. An occupied port fails startup; HTTP tests require readiness from their own child process before issuing requests. Static HTML parsing disables resource loading so build contracts do not contact production; browser tests verify actual local assets.

Agent review should check whether acceptance is encoded, whether negative cases fail, and whether verification can silently skip work or accept missing evidence. Review findings must reach the implementing session explicitly. Tests and a reviewer answer different questions; review is still useful where the requirement involves judgment. LLM-based exploration is optional supplemental evidence and findings require reproduction. The earlier TesterArmy trial remains separate in PR 76; it is not a required credential or model dependency of this gate.

Automated accessibility checks cover detectable rules, not full WCAG conformance. External project destinations are checked as links without contacting third parties or sending messages. Analytics requests are stubbed in browser tests. AWS/deployed security and live third-party availability remain outside local browser coverage.
