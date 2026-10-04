# Independent review checklist

You are the independent reviewer for a pull request in this repository. You did not write the change. Review the pushed head commit you were given, in your own worktree. Never edit the implementer's tree. Read `AGENTS.md` and `VERIFICATION.md` first.

## 1. Acceptance

- Does the diff do what the task asks, and nothing it shouldn't? Check every acceptance example against the code.
- Did the implementer read the task's "Done when" criteria and meet each one? A spike's deliverable must be on its issue or PR.

## 2. Test quality

Every test added or changed must protect real behaviour. **Prove it with a mutation**: make the smallest edit to the production code the test claims to cover, run that test file, and confirm it goes red. Then restore the file. Do this in your copy, one mutation at a time.

Classify each test:

- **Meaningful**: goes red under a plausible bug in the code it covers.
- **Weak**: stays green under a plausible bug. Name the bug.
- **Tautological** (always blocking): it asserts what the test itself constructs, re-implements the production logic to compute its expectation, compares a constant with itself, only checks that mocks were called, or cannot fail when the feature is removed.

Look specifically for:

- fixture or expectation edits where the old and the new input give the same output, so the test no longer discriminates;
- `?? default` / `|| default` / optional parameters whose missing-value path no test exercises;
- CLI entry points (`if (process.argv[1] === …)`, `main()`) that no test runs through a subprocess;
- assertions inside `if` / loops that pass vacuously when nothing matches; require a positive guard (at least one match);
- `toContain` / partial matches where an exact match is possible, especially for security headers and contracts;
- production changes (code, config, content, automation prompts) that no test would catch being removed or malformed;
- claims in the PR description that rest on a script or manual run that is not part of the gate.

## 3. Verification honesty

- Rerun `node scripts/pnpm.mjs verify` on the head. When `infra/` or deploy behaviour changed, also run `node scripts/pnpm.mjs verify:infra`; it needs the root install and `-C infra install --frozen-lockfile` first. Report exit codes; a run whose failure is hidden behind `| tail` or `echo $?` does not count.
- Check every claim in the PR description against a command you or the transcript actually ran.
- Flag weakened, skipped, retried or focused tests, and regenerated baselines.

## 4. Output

Return one comment in exactly this format. The implementer posts it unedited, so it must stand on its own:

```
Review verdict: PASS | FAIL
Reviewed head: <full sha>
Reviewer: <agent/model>, fresh context, own worktree (not the implementer)

| Test (file:line) | Mutation | Red? | Verdict |
...   (or one row "none: no tests added or changed | N/A | N/A | N/A")

Findings (blocking first): file:line — failure — expected behaviour
Commands run: <command> → <exit code>
```

FAIL if any finding is blocking: a tautological or weak test protecting changed behaviour, an untested production change that a deterministic test could cover, a failing or unrun gate, or an unbacked claim. Non-blocking suggestions are listed separately.
