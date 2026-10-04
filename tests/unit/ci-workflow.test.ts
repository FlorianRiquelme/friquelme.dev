import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';

// ci.yml produces the `site` and `infra` checks that the main ruleset requires. Each job's step
// list is asserted exactly, except that `uses` is compared by action name so Dependabot's
// GitHub Actions version bumps do not break this test.
const file = fileURLToPath(new URL('../../.github/workflows/ci.yml', import.meta.url));
const workflow = parse(readFileSync(file, 'utf8'));

type Step = { uses?: string; run?: string; if?: string; with?: Record<string, unknown> };

function withoutVersions(steps: Step[]): Step[] {
  return steps.map((step) => (step.uses === undefined ? step : { ...step, uses: step.uses.split('@')[0] }));
}

function runs(steps: Step[]): string[] {
  return steps.filter((step) => step.run !== undefined).map((step) => step.run as string);
}

function uploads(steps: Step[]): Step[] {
  return withoutVersions(steps).filter((step) => step.uses === 'actions/upload-artifact');
}

const setupSteps = [
  { uses: 'actions/checkout' },
  { uses: 'pnpm/action-setup' },
];

const siteUpload = {
  uses: 'actions/upload-artifact',
  if: 'always()',
  with: { name: 'website-verification', path: 'reports/', 'retention-days': 7, 'if-no-files-found': 'error' },
};

const infraUpload = {
  uses: 'actions/upload-artifact',
  if: 'always()',
  with: {
    name: 'infrastructure-verification',
    path: 'reports/verification-infra/',
    'retention-days': 7,
    'if-no-files-found': 'error',
  },
};

describe('ci workflow', () => {
  it('runs on pull requests and manual dispatch with read-only contents', () => {
    expect(workflow.on).toEqual({ pull_request: null, workflow_dispatch: null });
    expect(workflow.permissions).toEqual({ contents: 'read' });
  });

  it('cancels superseded runs per ref', () => {
    expect(workflow.concurrency).toEqual({ group: 'ci-${{ github.ref }}', 'cancel-in-progress': true });
  });

  it('has exactly the site and infra jobs the ruleset requires', () => {
    expect(Object.keys(workflow.jobs)).toEqual(['site', 'infra']);
    for (const job of Object.values(workflow.jobs) as Record<string, unknown>[]) {
      expect(Object.keys(job)).toEqual(['runs-on', 'steps']);
      expect(job['runs-on']).toBe('ubuntu-latest');
    }
  });

  it('site installs, installs the browsers and runs pnpm verify, in that order', () => {
    expect(runs(workflow.jobs.site.steps)).toEqual([
      'pnpm install --frozen-lockfile',
      'pnpm exec playwright install --with-deps chromium firefox webkit',
      'pnpm verify',
    ]);
  });

  it('infra installs both packages and runs pnpm verify:infra, in that order', () => {
    expect(runs(workflow.jobs.infra.steps)).toEqual([
      'pnpm install --frozen-lockfile',
      'pnpm -C infra install --frozen-lockfile',
      'pnpm verify:infra',
    ]);
  });

  it('site uploads its reports even on failure and fails when none exist', () => {
    expect(uploads(workflow.jobs.site.steps)).toEqual([siteUpload]);
  });

  it('infra uploads its reports even on failure and fails when none exist', () => {
    expect(uploads(workflow.jobs.infra.steps)).toEqual([infraUpload]);
  });

  it('site has exactly these steps in this order', () => {
    expect(withoutVersions(workflow.jobs.site.steps)).toEqual([
      ...setupSteps,
      { uses: 'actions/setup-node', with: { 'node-version-file': '.nvmrc', cache: 'pnpm' } },
      { run: 'pnpm install --frozen-lockfile' },
      { run: 'pnpm exec playwright install --with-deps chromium firefox webkit' },
      { run: 'pnpm verify' },
      siteUpload,
    ]);
  });

  it('infra has exactly these steps in this order', () => {
    expect(withoutVersions(workflow.jobs.infra.steps)).toEqual([
      ...setupSteps,
      {
        uses: 'actions/setup-node',
        with: {
          'node-version-file': '.nvmrc',
          cache: 'pnpm',
          'cache-dependency-path': 'pnpm-lock.yaml\ninfra/pnpm-lock.yaml\n',
        },
      },
      { run: 'pnpm install --frozen-lockfile' },
      { run: 'pnpm -C infra install --frozen-lockfile' },
      { run: 'pnpm verify:infra' },
      infraUpload,
    ]);
  });
});
