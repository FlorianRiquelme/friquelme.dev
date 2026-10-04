import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';

// The queue dispatcher reads the exact heading `### Done when` that this form renders, and refuses
// issues without it. The form must keep it mandatory and must not label issues `agent-ready` itself.
const load = (name: string) => parse(readFileSync(fileURLToPath(new URL(`../../.github/ISSUE_TEMPLATE/${name}`, import.meta.url)), 'utf8'));

describe('issue templates', () => {
  it('agent-task form requires What and Done when, in order, and adds no labels', () => {
    expect(load('agent-task.yml')).toEqual({
      name: 'Agent task',
      description: 'A task an agent can work to completion, with checkable acceptance examples.',
      title: '',
      labels: [],
      body: [
        { type: 'textarea', id: 'what', attributes: { label: 'What', description: 'What to change and why.' }, validations: { required: true } },
        {
          type: 'textarea', id: 'done-when',
          attributes: { label: 'Done when', description: 'Concrete, checkable acceptance examples. The worker turns each one into a test or an observable check.' },
          validations: { required: true },
        },
        { type: 'textarea', id: 'context', attributes: { label: 'Context', description: 'Links, constraints, files.' }, validations: { required: false } },
      ],
    });
  });

  it('keeps blank issues enabled so agents can open issues with gh', () => {
    expect(load('config.yml')).toEqual({ blank_issues_enabled: true });
  });
});
