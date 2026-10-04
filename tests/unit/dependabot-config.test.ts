import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';

// dependabot.yml decides which updates arrive and when the daily Dependabot review automation
// sees them, so the whole document is pinned: losing /infra or the grouping must turn this red.
const file = fileURLToPath(new URL('../../.github/dependabot.yml', import.meta.url));
const config = parse(readFileSync(file, 'utf8'));

const schedule = { interval: 'weekly', day: 'monday', time: '06:00', timezone: 'Europe/Berlin' };
const groups = { 'minor-and-patch': { 'update-types': ['minor', 'patch'] } };

describe('dependabot config', () => {
  it('updates root npm, infra npm and GitHub Actions weekly on Monday morning, grouping npm minor and patch', () => {
    expect(config).toEqual({
      version: 2,
      updates: [
        { 'package-ecosystem': 'npm', directory: '/', schedule, groups },
        { 'package-ecosystem': 'npm', directory: '/infra', schedule, groups },
        { 'package-ecosystem': 'github-actions', directory: '/', schedule },
      ],
    });
  });
});
