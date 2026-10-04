import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Every workflow needs a contract test. A workflow counts as tested when some other test file names it
// by its literal path `.github/workflows/<name>`; this file never counts as coverage.
const root = fileURLToPath(new URL('../..', import.meta.url));
const self = fileURLToPath(import.meta.url);

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function untestedWorkflows(workflows: string[], sources: string[]) {
  return workflows.filter(name => {
    const reference = new RegExp(String.raw`\.github/workflows/${escape(name)}(?![\w.-])`);
    return !sources.some(source => reference.test(source));
  });
}

const filesUnder = (dir: string, extensions: string[]) =>
  readdirSync(join(root, dir), { recursive: true, encoding: 'utf8' })
    .filter(name => !name.split(/[\\/]/).includes('node_modules'))
    .filter(name => extensions.some(extension => name.endsWith(extension)))
    .map(name => join(root, dir, name));

const workflows = readdirSync(join(root, '.github/workflows'), { withFileTypes: true })
  .filter(entry => entry.isFile())
  .map(entry => entry.name);
const testFiles = [...filesUnder('tests', ['.ts', '.mjs']), ...filesUnder('infra/test', ['.ts'])]
  .filter(file => file !== self);

describe('untestedWorkflows', () => {
  it.each([
    ['a referenced file passes', ['ci.yml'], ["new URL('../../.github/workflows/ci.yml', import.meta.url)"], []],
    ['an unreferenced file is reported', ['untested.yml'], ["'.github/workflows/ci.yml'"], ['untested.yml']],
    ['a .yaml file is reported', ['release.yaml'], ["'.github/workflows/release.yml'"], ['release.yaml']],
    ['a reference to a different file does not count', ['deploy.yml'], ["'.github/workflows/ci.yml'"], ['deploy.yml']],
    ['ci.yml is not satisfied by ci.yml.bak', ['ci.yml'], ["'.github/workflows/ci.yml.bak'"], ['ci.yml']],
    ['a bare file name does not count', ['ci.yml'], ["readFileSync('ci.yml')"], ['ci.yml']],
    ['each source is searched', ['ci.yml', 'deploy.yml'], ['.github/workflows/ci.yml', '.github/workflows/deploy.yml'], []],
  ])('%s', (_, names, sources, expected) => {
    expect(untestedWorkflows(names, sources)).toEqual(expected);
  });
});

describe('workflows in the repository', () => {
  it('lists every workflow and searches every test file', () => {
    expect(workflows).toEqual(expect.arrayContaining(['ci.yml', 'deploy.yml', 'review-verdict.yml']));
    for (const file of ['ci-workflow', 'deploy-workflow', 'review-verdict-workflow']) {
      expect(testFiles).toContain(join(root, `tests/unit/${file}.test.ts`));
    }
    expect(testFiles).not.toContain(self);
  });

  it('has a test that reads each workflow', () => {
    const sources = testFiles.map(file => readFileSync(file, 'utf8'));
    const untested = untestedWorkflows(workflows, sources).map(name => `.github/workflows/${name}`);
    expect(untested, 'workflows without a test referencing .github/workflows/<name>').toEqual([]);
  });
});
