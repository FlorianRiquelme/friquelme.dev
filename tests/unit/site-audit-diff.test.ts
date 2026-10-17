import { describe, it, expect } from 'vitest';
import { diffFindings, findingsOf } from '../../scripts/site-audit-diff.mjs';

const report = {
  issues: [
    {
      ruleId: 'a11y/color-contrast',
      category: 'Accessibility',
      severity: 'warning',
      checks: [
        {
          status: 'warn',
          message: '2 potential color contrast issue(s)',
          affectedPages: ['https://friquelme.dev/'],
          items: [
            { id: 'a with class "known" may have low contrast', sourcePages: ['https://friquelme.dev/'] },
            { id: 'a with class "fresh" may have low contrast', sourcePages: ['https://friquelme.dev/blog/'] },
          ],
        },
      ],
    },
    {
      ruleId: 'content/date-agreement',
      category: 'Content',
      severity: 'warning',
      checks: [
        { status: 'warn', message: 'no visible date', affectedPages: ['https://friquelme.dev/blog/a/'] },
        { status: 'warn', message: 'no visible date', affectedPages: ['https://friquelme.dev/blog/b/'] },
      ],
    },
    {
      ruleId: 'security/csp',
      category: 'Security',
      severity: 'warning',
      checks: [{ status: 'warn', message: "CSP allows 'unsafe-inline'", affectedPages: [] }],
    },
    {
      ruleId: 'core/meta-title',
      category: 'Core SEO',
      severity: 'error',
      checks: [{ status: 'pass', message: 'ok', affectedPages: [] }],
    },
  ],
};

describe('findingsOf', () => {
  it('fingerprints one finding per item, per page, or per site-level check, and skips passing checks', () => {
    expect(findingsOf(report).map((f) => f.fingerprint)).toEqual([
      'a11y/color-contrast :: a with class "known" may have low contrast',
      'a11y/color-contrast :: a with class "fresh" may have low contrast',
      'content/date-agreement :: /blog/a/',
      'content/date-agreement :: /blog/b/',
      'security/csp :: (site)',
    ]);
  });

  it('carries category, severity, message and site-relative pages', () => {
    expect(findingsOf(report)[1]).toEqual({
      fingerprint: 'a11y/color-contrast :: a with class "fresh" may have low contrast',
      rule: 'a11y/color-contrast',
      category: 'Accessibility',
      severity: 'warning',
      message: '2 potential color contrast issue(s)',
      pages: ['/blog/'],
    });
  });
});

describe('diffFindings', () => {
  const baseline = {
    known: [
      { fingerprint: 'a11y/color-contrast :: a with class "known" may have low contrast', verdict: 'false-positive', reason: 'r' },
      { fingerprint: 'content/date-agreement :: *', verdict: 'false-positive', reason: 'r' },
      { fingerprint: 'perf/dom-size :: /blog/gone/', verdict: 'accepted', reason: 'r' },
    ],
  };

  it('reports only findings no baseline entry covers, with rule wildcards', () => {
    const { fresh } = diffFindings(report, baseline);
    expect(fresh.map((f) => f.fingerprint)).toEqual([
      'a11y/color-contrast :: a with class "fresh" may have low contrast',
      'security/csp :: (site)',
    ]);
  });

  it('lists baseline entries that no longer match anything as stale', () => {
    expect(diffFindings(report, baseline).stale.map((e) => e.fingerprint)).toEqual([
      'perf/dom-size :: /blog/gone/',
    ]);
  });

  it('treats everything as fresh against an empty baseline', () => {
    expect(diffFindings(report, { known: [] }).fresh).toHaveLength(5);
  });
});
