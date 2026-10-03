# Findings buffer — issue 75

Capture is not authorization to implement broader fixes. Trial friction is in [FRICTION.md](FRICTION.md).

- **I01 — instruction version drift (confirmed):** README/CLAUDE describe Astro 5; package declares Astro ^7.3.3. Observed during baseline reads. Related preparatory finding in the private broader exploration buffer; no documentation refresh in this trial.
- **I02 — environment runtime drift (confirmed):** default Node 22.23.2 versus package >=24. Existing checks pass here but this is not supported-runtime qualification. See F02.
- **I03 — preview policy mismatch (confirmed):** TesterArmy 0.16.0 rejects tailnet HTTP; narrow reproducible patch required. See F05 and `patches/`.
- **I04 — exploration:** pending an authorized model. No claim that passing deterministic tests establishes broad coverage.

The prior shared buffer lives in another private workspace and is not published here. This file is the transferable collection for this trial; no unrelated context is copied.
- **I05 — remote push security notice (unverified):** GitHub reported one high-severity advisory on the default branch when this feature branch was pushed. The advisory content/state was not inspected and no change is authorized by this observation. Source notice links to [Dependabot alert 153](https://github.com/FlorianRiquelme/friquelme.dev/security/dependabot/153). Keep separate from trial correctness and review jointly.
