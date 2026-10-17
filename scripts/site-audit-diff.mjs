#!/usr/bin/env node
// Compares a squirrelscan JSON report with the committed baseline so the scheduled
// site audit acts only on findings nobody has triaged yet.
// Usage: node scripts/site-audit-diff.mjs <report.json> [baseline.json]
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const BASELINE_PATH = '.github/automation/site-audit-baseline.json';

const relative = (url) => {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
};

/** One finding per item, per affected page, or per site-level check. Passing checks are dropped. */
export function findingsOf(report) {
  const findings = [];
  for (const issue of report.issues ?? []) {
    for (const check of issue.checks ?? []) {
      if (check.status === 'pass') continue;
      const base = {
        rule: issue.ruleId,
        category: issue.category,
        severity: issue.severity,
        message: check.message,
      };
      const subjects = check.items?.length
        ? check.items.map((item) => ({ key: item.id, pages: item.sourcePages ?? check.affectedPages ?? [] }))
        : check.affectedPages?.length
          ? check.affectedPages.map((page) => ({ key: relative(page), pages: [page] }))
          : [{ key: '(site)', pages: [] }];
      for (const { key, pages } of subjects) {
        findings.push({ fingerprint: `${issue.ruleId} :: ${key}`, ...base, pages: pages.map(relative) });
      }
    }
  }
  return findings;
}

const covers = (entry, finding) =>
  entry.fingerprint === finding.fingerprint || entry.fingerprint === `${finding.rule} :: *`;

/**
 * @typedef {{ fingerprint: string, verdict: string, reason: string, issue?: number }} BaselineEntry
 * `fresh`: findings no baseline entry covers. `stale`: baseline entries that matched nothing.
 * @param {{ known?: BaselineEntry[] }} baseline
 */
export function diffFindings(report, baseline) {
  const findings = findingsOf(report);
  const known = baseline.known ?? [];
  return {
    fresh: findings.filter((f) => !known.some((entry) => covers(entry, f))),
    stale: known.filter((entry) => !findings.some((f) => covers(entry, f))),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [reportPath, baselinePath = BASELINE_PATH] = process.argv.slice(2);
  if (!reportPath) {
    console.error('usage: node scripts/site-audit-diff.mjs <report.json> [baseline.json]');
    process.exit(64);
  }
  const report = JSON.parse(readFileSync(reportPath, 'utf8'));
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
  console.log(JSON.stringify(diffFindings(report, baseline), null, 2));
}
