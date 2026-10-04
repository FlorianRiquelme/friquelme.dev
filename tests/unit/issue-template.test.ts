import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';

// The refiner's definition-of-ready lint reads the exact `### <label>` headings this form renders.
// The form files `needs-refinement` itself and must never label issues `agent-ready`.
const load = (name: string) => parse(readFileSync(fileURLToPath(new URL(`../../.github/ISSUE_TEMPLATE/${name}`, import.meta.url)), 'utf8'));

describe('issue templates', () => {
  it('agent-task form files needs-refinement, requires only What, and lists the definition-of-ready fields in order', () => {
    const optional = { required: false };
    expect(load('agent-task.yml')).toEqual({
      name: 'Agent task',
      description: 'A request for the agent queue. The refiner turns it into ready tickets; only What is required.',
      title: '',
      labels: ['needs-refinement'],
      body: [
        { type: 'textarea', id: 'what', attributes: { label: 'What', description: 'What to change and why, in your own words.' }, validations: { required: true } },
        {
          type: 'textarea', id: 'done-when',
          attributes: { label: 'Done when', description: 'Checkable acceptance examples, one per line starting with "- ". The refiner completes them if you leave this empty.' },
          validations: optional,
        },
        {
          type: 'textarea', id: 'dependencies',
          attributes: { label: 'Dependencies', description: '"None", or one line per blocker: "- blocked by #N".' },
          validations: optional,
        },
        { type: 'dropdown', id: 'kind', attributes: { label: 'Kind', options: ['frontend', 'backend', 'infra', 'content', 'deps'] }, validations: optional },
        {
          type: 'dropdown', id: 'risk-tier',
          attributes: {
            label: 'Risk tier',
            description: 'mechanical (queued directly), clear (written spec), spike (time-boxed research ending in a recommendation).',
            options: ['mechanical', 'clear', 'spike'],
          },
          validations: optional,
        },
        {
          type: 'textarea', id: 'verification',
          attributes: { label: 'Verification', description: 'How the worker proves it works (tests, browser suites, preview, production check).' },
          validations: optional,
        },
        { type: 'input', id: 'time-box', attributes: { label: 'Time box', description: 'Spikes only, for example "2h".' }, validations: optional },
        { type: 'textarea', id: 'context', attributes: { label: 'Context', description: 'Links, constraints, files.' }, validations: optional },
      ],
    });
  });

  it('keeps blank issues enabled so agents can open issues with gh', () => {
    expect(load('config.yml')).toEqual({ blank_issues_enabled: true });
  });
});
