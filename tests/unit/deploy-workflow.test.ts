import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

// deploy.yml is the production release and rollback contract: the whole step list is asserted
// exactly, so reordering, adding or dropping a step or changing a condition fails here.
const file = fileURLToPath(new URL("../../.github/workflows/deploy.yml", import.meta.url));
const workflow = parse(readFileSync(file, "utf8"));
const steps = workflow.jobs.deploy.steps;
const GH_TOKEN = "${{ secrets.GITHUB_TOKEN }}";

describe("deploy workflow", () => {
  it("triggers on main pushes and manual dispatch with the permissions rollback needs", () => {
    expect(workflow.on).toEqual({"push":{"branches":["main"]},"workflow_dispatch":null});
    expect(workflow.permissions).toEqual({"id-token":"write","contents":"write","pull-requests":"write","issues":"write","actions":"read"});
    expect(workflow.concurrency).toEqual({"group":"deploy-production","cancel-in-progress":false});
  });

  it("has one production job whose env carries no GitHub token", () => {
    expect(Object.keys(workflow.jobs)).toEqual(["deploy"]);
    const job = workflow.jobs.deploy;
    expect(job["runs-on"]).toBe("ubuntu-latest");
    expect(job.environment).toBe("production");
    expect(job.env).toEqual({"S3_BUCKET_NAME":"${{ secrets.S3_BUCKET_NAME }}","CLOUDFRONT_DISTRIBUTION_ID":"${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }}"});
    expect(job.env).not.toHaveProperty("GH_TOKEN");
  });

  it("passes GH_TOKEN only to the good, incident and revert steps", () => {
    const withToken = steps.filter((step: { env?: Record<string, string> }) => step.env && "GH_TOKEN" in step.env);
    expect(withToken.map((step: { id: string }) => step.id)).toEqual(["good", "incident", "revert"]);
    for (const step of withToken) expect(step.env.GH_TOKEN).toBe(GH_TOKEN);
  });

  it("publishes dist with the production invalidation paths", () => {
    const publish = steps.find((step: { id?: string }) => step.id === "publish");
    expect(publish.run).toBe("scripts/publish-site.sh dist \"/\" \"/index.html\" \"/favicon.ico\" \"/favicon.svg\" \"/blog/*\"");
  });

  it("has exactly these steps in this order", () => {
    expect(steps).toEqual([
      {
        "uses": "actions/checkout@v7",
        "with": {
          "fetch-depth": 0
        }
      },
      {
        "uses": "pnpm/action-setup@v6"
      },
      {
        "uses": "actions/setup-node@v7",
        "with": {
          "node-version-file": ".nvmrc",
          "cache": "pnpm"
        }
      },
      {
        "run": "pnpm install --frozen-lockfile"
      },
      {
        "run": "pnpm run build"
      },
      {
        "uses": "aws-actions/configure-aws-credentials@v6",
        "with": {
          "role-to-assume": "${{ secrets.AWS_DEPLOY_ROLE_ARN }}",
          "aws-region": "us-east-1"
        }
      },
      {
        "name": "Publish site",
        "id": "publish",
        "run": "scripts/publish-site.sh dist \"/\" \"/index.html\" \"/favicon.ico\" \"/favicon.svg\" \"/blog/*\""
      },
      {
        "name": "Smoke test production",
        "id": "smoke",
        "if": "${{ !cancelled() && (steps.publish.outcome == 'success' || steps.publish.outcome == 'failure') }}",
        "continue-on-error": true,
        "run": "node scripts/smoke-production.mjs --base-url https://friquelme.dev --dist dist --report reports/smoke/deploy.json"
      },
      {
        "name": "Find last known-good deploy",
        "id": "good",
        "if": "${{ !cancelled() && steps.smoke.outcome == 'failure' }}",
        "continue-on-error": true,
        "env": {
          "GH_TOKEN": "${{ secrets.GITHUB_TOKEN }}"
        },
        "run": "sha=$(gh run list --workflow deploy.yml --branch main --limit 50 \\\n  --json databaseId,headSha,conclusion,status,headBranch,createdAt \\\n  | node scripts/last-good-deploy.mjs --exclude-run \"$GITHUB_RUN_ID\" --exclude-sha \"$GITHUB_SHA\")\necho \"sha=$sha\" >> \"$GITHUB_OUTPUT\"\n"
      },
      {
        "name": "Roll back to last known-good build",
        "id": "rollback",
        "if": "${{ !cancelled() && steps.smoke.outcome == 'failure' && steps.good.outputs.sha != '' }}",
        "continue-on-error": true,
        "run": "git worktree add \"$RUNNER_TEMP/good\" \"${{ steps.good.outputs.sha }}\"\npnpm -C \"$RUNNER_TEMP/good\" install --frozen-lockfile\npnpm -C \"$RUNNER_TEMP/good\" run build\nscripts/publish-site.sh \"$RUNNER_TEMP/good/dist\" \"/*\"\n"
      },
      {
        "name": "Smoke test after rollback",
        "id": "recheck",
        "if": "${{ !cancelled() && steps.smoke.outcome == 'failure' && steps.rollback.outcome == 'success' }}",
        "continue-on-error": true,
        "run": "node scripts/smoke-production.mjs --base-url https://friquelme.dev --dist \"$RUNNER_TEMP/good/dist\" --report reports/smoke/rollback.json"
      },
      {
        "name": "Open incident issue",
        "id": "incident",
        "if": "always() && steps.smoke.outcome == 'failure'",
        "env": {
          "GH_TOKEN": "${{ secrets.GITHUB_TOKEN }}",
          "GOOD_SHA": "${{ steps.good.outputs.sha }}",
          "ROLLBACK_OUTCOME": "${{ steps.rollback.outcome }}",
          "RECHECK_OUTCOME": "${{ steps.recheck.outcome }}"
        },
        "run": "bad7=\"${GITHUB_SHA::7}\"\nrun_url=\"$GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID\"\nif [ -z \"$GOOD_SHA\" ]; then\n  title=\"Production smoke failed for $bad7; no known-good deploy\"\n  rollback=\"no known-good deploy found, nothing was rolled back\"\nelif [ \"$ROLLBACK_OUTCOME\" != \"success\" ]; then\n  title=\"Production smoke failed for $bad7; rollback FAILED\"\n  rollback=\"rollback to ${GOOD_SHA::7} FAILED (see run log); production may still serve the broken build\"\nelse\n  title=\"Production smoke failed for $bad7; rolled back to ${GOOD_SHA::7}\"\n  rollback=\"published the build of ${GOOD_SHA::7}\"\nfi\nfailures() {\n  node -e 'try { const r = JSON.parse(require(\"fs\").readFileSync(process.argv[1], \"utf8\")); console.log(r.failures.join(\"\\n\") || \"(none)\"); } catch { console.log(\"(no report)\"); }' \"$1\"\n}\nif [ -n \"$GOOD_SHA\" ]; then range=$(git log --oneline \"$GOOD_SHA..$GITHUB_SHA\"); else range=$(git log --oneline -1 \"$GITHUB_SHA\"); fi\nfence='```'\n{\n  echo \"Run: $run_url\"\n  echo\n  echo \"Bad commit: \\`$GITHUB_SHA\\` $(git log -1 --format=%s \"$GITHUB_SHA\")\"\n  echo \"Last known-good commit: ${GOOD_SHA:-none}\"\n  echo \"Rollback: $rollback\"\n  echo \"Smoke after rollback: ${RECHECK_OUTCOME:-skipped}\"\n  echo\n  echo \"Smoke failures on the deploy:\"\n  echo \"$fence\"\n  failures reports/smoke/deploy.json\n  echo \"$fence\"\n  echo\n  echo \"Smoke failures after rollback:\"\n  echo \"$fence\"\n  failures reports/smoke/rollback.json\n  echo \"$fence\"\n  echo\n  echo \"Commits since the last known-good deploy:\"\n  echo \"$fence\"\n  echo \"$range\"\n  echo \"$fence\"\n  echo \"Only the commit of this run is reverted. If the range above lists more than one commit, check whether an earlier one caused the failure.\"\n  echo\n  echo \"A revert PR is opened by this run with GITHUB_TOKEN, so CI does not start on it. Close and reopen it, or push to it, with a user token to start the \\`site\\`, \\`infra\\` and \\`review-verdict\\` (or \\`review-verdict-signed\\` once signing is activated) checks.\"\n} > \"$RUNNER_TEMP/incident.md\"\nif ! gh label list --search agent-merge --json name --jq '.[].name' | grep -qx agent-merge; then\n  gh label create agent-merge --color B60205 --description \"Incident from an agent-merged change\"\nfi\nurl=$(gh issue create --label agent-merge --title \"$title\" --body-file \"$RUNNER_TEMP/incident.md\")\necho \"url=$url\" >> \"$GITHUB_OUTPUT\"\n"
      },
      {
        "name": "Open revert PR",
        "id": "revert",
        "if": "always() && steps.smoke.outcome == 'failure'",
        "continue-on-error": true,
        "env": {
          "GH_TOKEN": "${{ secrets.GITHUB_TOKEN }}",
          "ISSUE_URL": "${{ steps.incident.outputs.url }}"
        },
        "run": "subject=$(git log -1 --format=%s \"$GITHUB_SHA\")\nbranch=\"revert/deploy-${GITHUB_SHA::7}\"\nrun_url=\"$GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID\"\ngit config user.name \"github-actions[bot]\"\ngit config user.email \"41898282+github-actions[bot]@users.noreply.github.com\"\nif git checkout -b \"$branch\" origin/main \\\n  && git revert --no-edit \"$GITHUB_SHA\" \\\n  && git push origin \"$branch\" \\\n  && gh pr create --base main --head \"$branch\" --title \"Revert \\\"$subject\\\"\" \\\n    --body \"Reverts $GITHUB_SHA after the production smoke test failed. Incident: ${ISSUE_URL:-none}. Run: $run_url\"; then\n  exit 0\nfi\ngit revert --abort || true\nif [ -n \"$ISSUE_URL\" ]; then\n  gh issue comment \"$ISSUE_URL\" --body \"The automatic revert PR could not be created (conflict, or the commit touches .github/workflows which GITHUB_TOKEN cannot push). Revert $GITHUB_SHA manually. Run: $run_url\"\nfi\nexit 1\n"
      },
      {
        "uses": "actions/upload-artifact@v7",
        "if": "always()",
        "with": {
          "name": "smoke-reports",
          "path": "reports/smoke/",
          "if-no-files-found": "warn"
        }
      },
      {
        "name": "Fail the deploy",
        "if": "always() && steps.smoke.outcome == 'failure'",
        "run": "echo \"Production smoke failed for ${GITHUB_SHA::7}; rollback outcome: ${{ steps.rollback.outcome }}; incident: ${{ steps.incident.outputs.url }}\"\nexit 1\n"
      }
    ]);
  });
});
