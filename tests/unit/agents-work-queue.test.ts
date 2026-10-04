import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));
const agents = readFileSync(`${root}AGENTS.md`, 'utf8');
const start = agents.indexOf('## Work queue');
const section = agents.slice(start, agents.indexOf('\n## ', start + 1));
const form = parse(readFileSync(`${root}.github/ISSUE_TEMPLATE/agent-task.yml`, 'utf8'));
const field = (label: string) => form.body.find((f: { attributes: { label: string } }) => f.attributes.label === label);

describe('AGENTS.md work queue', () => {
  it('names every queue label in backticks and no longer mentions needs-triage', () => {
    expect(section).not.toContain('needs-triage');
    for (const label of ['needs-refinement', 'refining', 'agent-ready', 'agent-working', 'parked', 'needs-florian', 'split', 'agent-merge']) {
      expect(section, label).toContain(`\`${label}\``);
    }
  });

  it('definition-of-ready headings are fields of the agent-task form, with matching dropdown values', () => {
    const headings = [...new Set([...section.matchAll(/`### ([^`]+)`/g)].map((m) => m[1]))];
    expect(headings).toEqual(['What', 'Done when', 'Dependencies', 'Kind', 'Risk tier', 'Verification', 'Time box']);
    const labels = form.body.map((f: { attributes: { label: string } }) => f.attributes.label);
    for (const heading of headings) expect(labels, heading).toContain(heading);
    expect(field('Kind').attributes.options).toEqual(['frontend', 'backend', 'infra', 'content', 'deps']);
    expect(field('Risk tier').attributes.options).toEqual(['mechanical', 'clear', 'spike']);
    expect(section).toContain('(frontend, backend, infra, content or deps)');
    expect(section).toContain('(mechanical, clear or spike)');
  });

  it('no file in the repository still mentions needs-triage', () => {
    const files = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' })
      .split('\0')
      .filter((f) => f && !/^(node_modules|dist|\.git|reports)\//.test(f) && !f.endsWith('agents-work-queue.test.ts'));
    const hits = files.filter((f) => {
      try { return readFileSync(`${root}${f}`, 'utf8').includes('needs-triage'); } catch { return false; }
    });
    expect(hits).toEqual([]);
  });
});
