// Export an allowlist of observable outcomes/accounting, excluding model turns,
// reasoning events, prompt/credential fields, command logs and raw AI traces.
// Free-form app/error text still requires manual privacy review before publishing.
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const id = process.argv[2];
if (!id || basename(id) !== id || id === '.' || id === '..') throw new Error('Pass one results run ID, not a path');
const source = resolve(root, 'results', id);
const summary = JSON.parse(await readFile(resolve(source, 'summary.json'), 'utf8'));
if (!summary.finishedAt) throw new Error('The run is still active; wait before exporting evidence');
const output = resolve(root, 'evidence', id);
await mkdir(output, { recursive: true });
const error = value => value ? { code: value.code, message: value.message } : null;
const cache = value => value ? {
  mode: value.mode, reason: value.reason,
  replayedActions: value.replayedActions, totalActions: value.totalActions,
} : null;
const runs = [];
for (const row of summary.runs) {
  const report = JSON.parse(await readFile(resolve(source, row.label, 'report.json'), 'utf8'));
  const run = report.run;
  const selected = run.results.filter(r => r.selected);
  const attempts = selected.flatMap(r => r.attempts);
  const agentSteps = attempts.flatMap(a => a.steps).filter(s => s.api.startsWith('agent.'));
  const calls = agentSteps.reduce((n, s) => n + (s.model?.calls ?? s.metrics?.modelCalls ?? 0), 0);
  runs.push({
    label: row.label, variant: row.variant, exitCode: row.exitCode, durationMs: row.durationMs,
    expectationMet: row.expectationMet, status: run.status, startedAt: run.startedAt, finishedAt: run.finishedAt,
    modelCalls: calls, modelTokens: run.usage.modelTokens,
    providerCachedInputTokens: run.usage.modelCachedTokens ?? null,
    estimatedCostUsd: run.usage.estimatedCostUsd ?? null,
    errors: run.errors.map(error),
    tests: selected.map(r => ({
      title: r.titlePath.join(' / '), status: r.status, firstAttempt: r.attempts[0]?.status ?? null,
      attempts: r.attempts.map(a => ({
        index: a.index, status: a.status, durationMs: a.durationMs, error: error(a.error),
        agentSteps: a.steps.filter(s => s.api.startsWith('agent.')).map(s => ({
          api: s.api, status: s.status, durationMs: s.durationMs,
          calls: s.model?.calls ?? s.metrics?.modelCalls ?? 0,
          inputTokens: s.model?.inputTokens ?? 0, outputTokens: s.model?.outputTokens ?? 0,
          tokenAccounting: s.model?.tokenAccounting ?? null,
          cache: cache(s.cache), visionInput: s.visionInput ?? false,
          visionDegraded: s.visionDegraded ?? null, error: error(s.error),
        })),
      })),
    })),
    ...(run.explore ? { exploration: {
      ended: run.explore.ended, budgets: run.explore.budgets,
      steps: run.explore.steps.map(s => ({ index: s.index, title: s.title, status: s.status, durationMs: s.durationMs })),
      findings: run.explore.findings.map(f => ({ id: f.id, kind: f.kind, severity: f.severity, title: f.title, path: f.path, expected: f.expected, actual: f.actual, reproduction: f.reproduction })),
    } } : {}),
  });
  if (['live-1', 'mobile-overlay', 'restored'].includes(row.label)) {
    const mobile = selected.find(r => r.file.endsWith('mobile.e2e.ts'));
    const shot = mobile?.attempts[0]?.artifacts.find(a => a.kind === 'screenshot');
    if (shot) await copyFile(resolve(source, row.label, 'artifacts', shot.path), resolve(output, `${row.label}-mobile.png`));
  }
  for (const finding of run.explore?.findings ?? []) {
    const shot = attempts.flatMap(a => a.artifacts).find(a => a.id === finding.artifactId && a.kind === 'screenshot');
    if (shot) await copyFile(resolve(source, row.label, 'artifacts', shot.path), resolve(output, `${row.label}-finding-${finding.index}.png`));
  }
}
await writeFile(resolve(output, 'summary.json'), JSON.stringify({
  id, startedAt: summary.startedAt, finishedAt: summary.finishedAt,
  runtime: summary.runtime, provider: summary.provider, model: summary.model,
  versions: summary.versions, retries: summary.retries, commit: summary.commit,
  sourceHash: summary.sourceHash, sourceUnchanged: summary.sourceUnchanged,
  note: 'Calls are summed from reported agent steps, including the exploration planner and charters. Provider prompt-cache tokens differ from action replay. Raw traces stay private. No reported USD price means unknown, not zero.',
  runs,
}, null, 2) + '\n');
console.log(`Review before publishing: ${output}`);
