import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Gates run in parallel worktrees, so every preview port must come from freePort() or E2E_PREVIEW_PORT.
// A numeric literal handed to startPreview(), to preview.mjs argv or bound to a PORT constant brings collisions back.
const root = fileURLToPath(new URL('../..', import.meta.url));
const self = fileURLToPath(import.meta.url);
const number = String.raw`['"\x60]?(\d[\d_]*)`;
const patterns = [
  new RegExp(String.raw`startPreview\(\s*(?:(?:String|Number)\(\s*)?${number}`, 'g'),
  new RegExp(String.raw`preview\.mjs['"\x60]?(?:\s*,\s*|\s+)(?:(?:String|Number)\(\s*)?${number}`, 'g'),
  new RegExp(String.raw`\b(?:const|let|var)\s+[A-Z_]*PORT\s*=\s*${number}`, 'g'),
];

function fixedPorts(source: string) {
  const found: { line: number; text: string }[] = [];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      if (Number(match[1].replaceAll('_', '')) === 0) continue;
      found.push({ line: source.slice(0, match.index).split('\n').length, text: match[0] });
    }
  }
  return found.sort((a, b) => a.line - b.line);
}

const filesUnder = (dir: string, extension: string) =>
  readdirSync(join(root, dir), { recursive: true, encoding: 'utf8' })
    .filter(name => name.endsWith(extension))
    .map(name => join(root, dir, name));

const scanned = [join(root, 'e2e.config.ts'), ...filesUnder('scripts', '.mjs'), ...filesUnder('tests', '.ts')]
  .filter(file => file !== self);

describe('fixedPorts', () => {
  it.each([
    ['const PORT = 14321;', 1],
    ['let PREVIEW_PORT = 4_321;', 1],
    ["const PORT = '4321';", 1],
    ['server = startPreview(4321);', 1],
    ['startPreview( String(4321) )', 1],
    ["args: ['scripts/preview.mjs', '4321']", 1],
    ["spawn(node, [\n  'scripts/preview.mjs',\n  String(4321),\n])", 1],
    ['node scripts/preview.mjs 4321', 1],
    ['let PORT = 0;', 0],
    ['const PORT = await freePort();', 0],
    ['server = startPreview(PORT);', 0],
    ["args: ['scripts/preview.mjs', String(port)]", 0],
  ])('finds fixed ports in %j: %i', (source, count) => {
    expect(fixedPorts(source)).toHaveLength(count);
  });

  it('reports the line of each fixed port', () => {
    expect(fixedPorts('import x;\n\nconst PORT = 14321;\n')).toEqual([{ line: 3, text: 'const PORT = 14321' }]);
  });
});

describe('preview ports in the repository', () => {
  it('scans the gate config, scripts and tests', () => {
    expect(scanned.length).toBeGreaterThanOrEqual(10);
    for (const file of ['e2e.config.ts', 'scripts/preview.mjs', 'tests/build/preview.test.ts', 'tests/build/smoke-contracts.test.ts']) {
      expect(scanned).toContain(join(root, file));
    }
  });

  it('allocates every preview port instead of fixing one', () => {
    const findings = scanned.flatMap(file =>
      fixedPorts(readFileSync(file, 'utf8')).map(({ line, text }) => `${relative(root, file)}:${line}: ${text}`));
    expect(findings).toEqual([]);
  });
});
