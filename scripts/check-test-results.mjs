import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { browserTargets } from './browser-targets.mjs';

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function steps(parent) {
  return (parent.steps ?? []).flatMap(step => [step, ...steps(step)]);
}

function browserResults(report, expectedTargets) {
  requireCondition(report?.schemaVersion === 'report-1' && report.run?.specVersion === '0.1', 'Browser report is not a TesterArmy report-1 document');
  const { run } = report;
  requireCondition(run.status === 'passed' && run.exitCode === 0, `Browser run did not pass (${run.status}, ${run.exitCode})`);
  requireCondition(Array.isArray(run.errors) && run.errors.length === 0, 'Browser run has operational errors');
  requireCondition(run.explore === undefined, 'Exploration is not deterministic browser evidence');
  const results = run.results;
  requireCondition(Array.isArray(results) && results.length > 0, 'Browser report executed no tests');
  const { summary } = run;
  requireCondition([summary?.discovered, summary?.selected, summary?.executed, summary?.passed].every(count => count === results.length) && summary.failed === 0 && summary.flaky === 0 && summary.skipped === 0, 'Browser counts indicate unselected, failed, skipped or flaky tests');
  requireCondition(results.every(result => result.kind === 'test' && result.selected === true && result.status === 'passed' && result.attempts?.length === 1), 'Browser results lack an unretried successful verdict');
  const attempts = results.map(result => result.attempts[0]);
  requireCondition(attempts.every(attempt => attempt.index === 0 && attempt.status === 'passed' && attempt.error === undefined && attempt.secondaryErrors?.length === 0 && attempt.cleanup === 'complete'), 'Browser attempts lack a clean successful verdict');
  requireCondition(run.usage?.modelTokens === 0 && attempts.flatMap(steps).every(step => step.model === undefined && !step.api.startsWith('agent.')), 'Browser run used a model');
  const targets = (run.targets ?? []).map(target => target.id).sort();
  requireCondition(JSON.stringify(targets) === JSON.stringify([...expectedTargets].sort()), `Browser targets differ from the required profiles: ${targets.join(', ')}`);
  const testIds = [...new Set(results.map(result => result.testId))].sort();
  for (const target of expectedTargets) {
    const executed = results.filter(result => result.targetId === target).map(result => result.testId).sort();
    requireCondition(executed.length > 0, `Browser target did not execute: ${target}`);
    requireCondition(JSON.stringify(executed) === JSON.stringify(testIds), `Browser target did not execute every test exactly once: ${target}`);
  }
  return { tests: results.length, targets };
}

export async function checkTestResults(format, path, exitCode, expectedTargets = []) {
  requireCondition(exitCode === 0, `Test process exited unsuccessfully (${exitCode})`);
  const report = JSON.parse(await readFile(path, 'utf8'));
  if (format === 'vitest') {
    requireCondition(report.success === true, 'Vitest did not report success');
    requireCondition(Number.isInteger(report.numTotalTests) && report.numTotalTests > 0, 'Vitest executed no tests');
    requireCondition(report.numPassedTests === report.numTotalTests && report.numFailedTests === 0 && report.numPendingTests === 0 && report.numTodoTests === 0, 'Vitest has failed, skipped or todo tests');
    requireCondition(report.numFailedTestSuites === 0 && report.numPendingTestSuites === 0, 'Vitest has failed or skipped suites');
    requireCondition(Array.isArray(report.testResults) && report.testResults.length > 0, 'Vitest has no per-file evidence');
    const assertions = report.testResults.flatMap(result => result.assertionResults ?? []);
    requireCondition(assertions.length === report.numTotalTests && assertions.every(assertion => assertion.status === 'passed'), 'Vitest counts and actual assertions disagree');
    requireCondition(report.testResults.every(result => result.status === 'passed'), 'Vitest file execution was unsuccessful');
    requireCondition(report.snapshot?.failure === false && report.snapshot.unmatched === 0, 'Vitest snapshot validation failed');
    return { tests: assertions.length };
  }
  requireCondition(format === 'testerarmy', `Unknown report format: ${format}`);
  return browserResults(report, expectedTargets);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    console.log(JSON.stringify(await checkTestResults(process.argv[2], process.argv[3], Number(process.argv[4] ?? 0), browserTargets.map(target => target.name))));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
