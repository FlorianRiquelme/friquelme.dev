import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function browserTests(suites) {
  requireCondition(Array.isArray(suites), 'Browser report has no suites');
  return suites.flatMap(suite => [
    ...(suite.specs ?? []).flatMap(spec => spec.tests ?? []),
    ...browserTests(suite.suites ?? []),
  ]);
}

export async function checkTestResults(format, path, exitCode, expectedProjects = []) {
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
  requireCondition(format === 'playwright', `Unknown report format: ${format}`);
  requireCondition(Array.isArray(report.errors) && report.errors.length === 0, 'Browser run has operational errors');
  const tests = browserTests(report.suites);
  requireCondition(tests.length > 0, 'Browser report executed no tests');
  requireCondition(report.stats?.expected === tests.length && report.stats.skipped === 0 && report.stats.unexpected === 0 && report.stats.flaky === 0, 'Browser counts indicate failed, skipped or flaky tests');
  requireCondition(tests.every(test => test.expectedStatus === 'passed' && test.status === 'expected' && test.results?.length === 1 && test.results[0].status === 'passed' && test.results[0].retry === 0 && test.results[0].errors?.length === 0), 'Browser attempts lack an unretried successful verdict');
  for (const project of expectedProjects) requireCondition(tests.some(test => test.projectName === project), `Browser project did not execute: ${project}`);
  return { tests: tests.length, projects: [...new Set(tests.map(test => test.projectName))] };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    console.log(JSON.stringify(await checkTestResults(process.argv[2], process.argv[3], Number(process.argv[4] ?? 0))));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
