# Assessment — completed manual trial

**Adapt: use scripted journeys and live visual checks as a manual adjunct; retain deterministic contracts and review exploration findings.** This trial demonstrates useful visual detection and action replay, but does not establish reduced maintenance, broad coverage or suitability as a required CI gate. No adoption gate or production change is proposed.

## AI execution

Run [`2026-10-03T11-53-58.002Z-matrix-ebeece37`](evidence/2026-10-03T11-53-58.002Z-matrix-ebeece37/summary.json), 2026-10-03 11:53:58–11:59:06 UTC. Provider: TesterArmy ChatGPT subscription adapter (`chatgpt.responses`); model: `gpt-6-luna`, with no explicit reasoning override. Node 22.23.2; e2e 0.16.0 plus the committed URL patch; web engine 0.11.2; Playwright 1.63.0; Chromium/headless shell 153.0.8010.12 (revision 1243). All dependency pins are in the exported summary and separate lockfile. One whole-test retry is explicit; exploration has none.

Times include runner/pnpm overhead. Calls include reported agent steps; exploration includes planner calls. Tokens are provider-reported total input/output, including provider-cached input. **USD cost is unavailable for every subscription run, not zero.** Subscription allowance consumption is not converted into dollars.

| Run | First attempts → final verdict | Seconds | Calls | Tokens |
| --- | --- | ---: | ---: | ---: |
| live-1 | Both pass → both pass | 25.089 | 5 | 27,933 |
| live-2 | Both pass → both pass | 22.697 | 5 | 27,972 |
| live-3 | Both pass → both pass | 26.804 | 5 | 27,891 |
| cache-warmup | Both pass → both pass | 23.824 | 5 | 27,814 |
| cache-1 | Both pass → both pass | 13.534 | 1 | 2,275 |
| cache-2 | Both pass → both pass | 12.409 | 1 | 2,278 |
| cache-3 | Both pass → both pass | 13.490 | 1 | 2,273 |
| wrong-link | Journey fails → fails again on retry | 31.093 | 4 | 21,934 |
| mobile-overlay | Visual check fails → fails again on retry | 18.277 | 2 | 4,733 |
| restored | Both pass → both pass | 21.357 | 5 | 27,826 |
| exploration | One issue reported → failed, no retry | 97.854 | 16 | 133,195 |

Healthy live, warm-up, cached and restored tests all pass their first attempt; there are no hidden first-attempt failures in those rows. Each negative run selects only its relevant test. Both failures are `ASSERTION_FAILED`, not provider/engine failures. The matrix runner returns success because expected healthy/fault outcomes match; exploration's finding is retained for review rather than interpreted as a passing site check.

Each cached journey replays **one action in each of its two `agent.act` steps**, with `cache.mode=self-finalized`, no model calls, and subsequent exact outcome assertions. Warm-up records misses (`no-entry`). Each cached mobile assertion still makes one live model call with `visionInput=true` and no vision degradation. Provider prompt caching is separate from action replay. Median live runtime is 25.089s versus 13.490s cached (~46% lower); calls drop 5→1 and tokens about 28,000→2,300. Three runs per mode provide an initial signal only.

## Controlled defects and restoration

- **Wrong destination:** the pinned link points to `/blog/brownfield-ai/`. The exact `href` contract fails on the initial attempt and retry, before the second agent action. This demonstrates the value of a deterministic guard; it is **not agent diagnosis** of the broken destination.
- **Mobile obstruction:** an opaque aria-hidden overlay hides the pinned title. DOM visibility passes, then the live visual assertion fails on both attempts with `visionInput=true`. The reported explanation says the title is not visible/readable. The [selected screenshot](evidence/2026-10-03T11-53-58.002Z-matrix-ebeece37/mobile-overlay-mobile.png) corroborates the obstruction.
- **Restoration:** both healthy tests pass afterward; [healthy](evidence/2026-10-03T11-53-58.002Z-matrix-ebeece37/live-1-mobile.png) and [restored](evidence/2026-10-03T11-53-58.002Z-matrix-ebeece37/restored-mobile.png) screenshots show the title. Variants transform HTTP responses in memory. The original built blog HTML hash remains identical (`sourceUnchanged=true`); no deliberate defect is in source or build files.

## Exploration review

The bounded mobile exploration (390×844, three-step maximum, 180-second ceiling) completed two charters: Blog listing and Homepage navigation. It reported one severity-3 issue, “Mobile menu blocks access to pinned essay link,” and exited 1. **Reject this finding as a false positive.** Its [finding screenshot](evidence/2026-10-03T11-53-58.002Z-matrix-ebeece37/exploration-finding-0.png) shows the intentionally open modal navigation, which should intercept clicks on background content. A Luna helper independently reproduced the normal pointer flow at 390×844: open Toggle menu, click its Blog link, reach exact `/blog/`, observe closed dialog/`aria-expanded=false`, and see the pinned link. The existing deterministic mobile control also exercises that flow. No site fix follows from this finding.

The report says `ended=time` although runner wall time is 97.854s (reported run time about 94.97s). Installed `e2e/dist/explore/body.js` explains this: it reserves 60 seconds for closing assessment and requires at least 45 seconds for a new charter, so stops starting charters below 105 seconds remaining. This is budget behavior, not evidence of a broken timeout. The three-minute ceiling does not promise three minutes of browsing or three completed charters. Exploration consumed 16 calls/133,195 tokens and did not finish article-reading coverage. Treat discovered issues as leads requiring corroboration; a pass would likewise establish only no qualifying findings in the bounded run.

## Deterministic comparison and supervision

Focused control run `2026-10-03T11-10-22.461Z-control-97dbac27`: healthy and restored desktop/mobile pass; wrong-link desktop fails initial+retry (mobile passes); overlay mobile fails initial+retry (desktop passes). Runtimes: healthy 5.769s, wrong-link 19.790s, overlay 8.080s, restored 5.509s. Control makes zero model requests. Final runner validation `2026-10-03T11-24-02.318Z-control-de376633` validates the same outcomes. Selected control evidence remains under its original IDs.

Playwright is faster, requires no provider setup and is sufficient for these stable route contracts. Its mobile geometry/hit test catches this overlay, so this sample does not prove uniquely added defect coverage. Vision does establish pixel-based title assessment beyond DOM visibility, and could help with visual defects a hit test misses; that broader benefit remains unmeasured. No maintenance reduction is established. Action prose still needs exact assertions, and replay does not make live visual judgments deterministic.

Human interventions after the initial task/Luna preference: **two onboarding interactions**, provider selection and device-login completion. No per-test intervention or correction was needed during the matrix. The agent needed dependency, URL-policy and reporting corrections during setup, then evidence review to reject the exploration finding; see [friction](FRICTION.md). The same Luna helper independently reviewed the actual AI reports/screenshots and reproduced the menu behavior. Its internal transcript remains a capture gap.

## Validation and limits

Existing checks pass: 145 site tests, 6 infra tests, build, Astro check (0 errors/14 pre-existing hints), infra TypeScript, trial type checking/discovery. Site/infra CI passed on the executed `f0a9a8d` head using repository Node 24. Local trial execution remains Node 22.23.2, below the site's declared >=24; local supported-runtime qualification is not claimed. Existing build warnings about optional icons and MDX directives predate this trial. Static fixtures do not test deployed CDN/CSP headers or actual mobile devices.

Historical unsuccessful attempts are retained: initial control lacked reporter evidence; the no-model probe was blocked by `MODEL_UNAVAILABLE` before its test body; a temporary deterministic e2e API probe passed two cases and was removed. These do not count as AI successes. Full reports/traces stay in the retrievable private archive; public evidence is an allowlisted, reviewed selection, not a complete execution transcript.
