# Assessment — incomplete AI evaluation

**Adapt provisionally; do not adopt as a required CI check.** The setup is reviewable and the deterministic control detects both deliberate defects. TesterArmy's runtime, cache reliability, visual sensitivity, model costs, and exploration value remain unevaluated until Florian selects and authenticates a provider. No successful AI run is claimed.

## Observed evidence

Control run `2026-10-03T11-10-22.461Z-control-97dbac27`, Node 22.23.2, Playwright 1.63.0, Chromium/headless shell 153.0.8010.12 (Playwright revision 1243). One retry explicitly configured:

| Variant | First attempts | Final verdict | Evidence |
| --- | --- | --- | --- |
| Healthy | Desktop + mobile passed | 2 passed | Selected screenshots and control report |
| Wrong article link | Desktop failed exact URL; mobile passed | Desktop failed again on retry | Expected operator article, received `/blog/brownfield-ai/` |
| Mobile overlay | Desktop passed; mobile title hit-test failed | Mobile failed again on retry | Title point `(132, 489)` covered despite DOM visibility passing |
| Restored healthy | Desktop + mobile passed | 2 passed | No fixture/source changes on disk; identical built blog HTML hash |

Wall times including pnpm startup: healthy 5.769s, wrong-link 19.790s, mobile-overlay 8.080s, restored 5.509s. Model calls/tokens/cost: control makes no model requests; model evaluation unavailable. Full traces and reports are retained privately; compact sanitized report and selected public-site screenshots are in `evidence/`.

The no-model diagnostic `2026-10-03T11-11-47.010Z-probe-9c5c4b88` reached browser initialization but failed with run-level `MODEL_UNAVAILABLE`. This is configuration blockage, not a site defect or an AI judgment. Fixture acquisition interrupted the test before its body; no test retry was exercised. See its sanitized summary and private report.

## Comparison and limits

The focused Playwright flow uses stable accessible labels and exact URLs. It runs cheaply without provider setup and catches the selected navigation defect reliably in this one bounded sample. Its mobile geometry/hit test detects this overlay but cannot judge general text contrast, typography or readability, and can miss a pointer-events-none visual obstruction. Those are possible useful additions from vision, **not demonstrated benefits yet**. Agent action prose still needs exact assertions and link checks to prevent recovery concealing a defect; cached actions would still leave live visual judgments nondeterministic.

No maintenance reduction has been measured. Initial setup needed a manual provider decision, dependency corrections, a tailnet HTTP policy patch, reporting corrections, and session evidence handling; see friction. Routine investigative reads are not counted as defects. One Luna helper implemented the deterministic control after read-only upstream inspection; no separate independent verifier claim is made.

Pending acceptance: three live runs, cache warm-up plus three actual cache-enabled runs with observed replay outcomes, model/provider/call/token/cost data, agent detection of both defects, healthy restoration in TesterArmy, and one bounded exploration reviewed against screenshots. Do not infer these results from passing deterministic controls or collected test names. The minimum framework exploration deadline is three minutes; a passing exploration would indicate no qualifying findings within its limited run only.

Existing checks passed: site 145 tests, infra 6 tests, build, Astro check (0 errors, 14 pre-existing hints), infra TypeScript. Initial default Node was below the site's declared >=24; supported-runtime qualification remains separate. Existing build warnings about the absent optional icon directory and MDX directives were present before trial implementation. The unrelated instruction/framework version drift is recorded for joint review in `FINDINGS.md`.

A temporary deterministic e2e API probe (`2026-10-03T11-21-13.394Z-api-probe`) also passed 2 tests: exact runtime selectors, URL/href assertions, viewport change and screenshot APIs against the healthy fixture. Its temporary test file was removed after validation. This establishes browser-engine integration without claiming any model behavior. Static fixture responses do not test the deployed CDN, production CSP headers or real mobile browsers.

Final runner validation `2026-10-03T11-24-02.318Z-control-de376633`: all four expected outcomes validated with the stricter report checks; source hash unchanged. Earlier evidence selections are retained under their original run IDs.
