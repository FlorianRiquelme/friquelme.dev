import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function pickLastGood(runs, { excludeRunId, excludeSha } = {}) {
  return runs
    .filter(run => run.status === 'completed' && run.conclusion === 'success' && run.headBranch === 'main'
      && String(run.databaseId) !== String(excludeRunId) && run.headSha !== excludeSha)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0] ?? null;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const arg = name => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
  const run = pickLastGood(JSON.parse(readFileSync(0, 'utf8')), { excludeRunId: arg('--exclude-run'), excludeSha: arg('--exclude-sha') });
  if (!run) { console.error('no known-good deploy found'); process.exit(1); }
  console.log(run.headSha);
}
