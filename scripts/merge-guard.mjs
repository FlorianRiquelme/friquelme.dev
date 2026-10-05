import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { evaluate, publicKeyFromPem, TRUSTED_ASSOCIATIONS } from './review-verdict.mjs';

// Merges a PR only when both local gates passed on its current head in a clean tree and the head has
// a PASS review verdict. Run it from the worktree that ran `verify` and `verify:infra`.
const SUMMARIES = ['reports/verification/summary.json', 'reports/verification-infra/summary.json'];

function checkSummary(file, text, headSha) {
  let summary;
  try { summary = JSON.parse(text); } catch { return [`${file}: does not parse as JSON`]; }
  const git = summary?.git ?? {};
  const failures = [];
  if (summary?.status !== 'passed') failures.push(`${file}: status is ${JSON.stringify(summary?.status)}, not "passed"`);
  for (const key of ['headAtStart', 'headAtEnd']) {
    if (git[key] !== headSha) failures.push(`${file}: git.${key} is ${JSON.stringify(git[key])}, not the PR head ${headSha}`);
  }
  for (const key of ['cleanAtStart', 'cleanAtEnd']) {
    if (git[key] !== true) failures.push(`${file}: git.${key} is ${JSON.stringify(git[key])}, not true`);
  }
  return failures;
}

const isBot = user => user?.type === 'Bot' || String(user?.login ?? '').endsWith('[bot]');

// Every inline review thread a bot started needs a written reply from a trusted human. The reply's
// content is not judged; GitHub points every reply's in_reply_to_id at the thread's root.
function unansweredBotThreads(comments) {
  const answered = new Set(comments
    .filter(c => c.in_reply_to_id != null && !isBot(c.user) && TRUSTED_ASSOCIATIONS.includes(c.author_association))
    .map(c => c.in_reply_to_id));
  return comments
    .filter(c => c.in_reply_to_id == null && isBot(c.user) && !answered.has(c.id))
    .map(c => `unanswered bot review comment from ${c.user.login} on ${c.path}: ${c.html_url}`);
}

function gh(args) {
  const result = spawnSync('gh', args, { encoding: 'utf8' });
  if (result.error) throw new Error(`gh ${args.join(' ')}: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`gh ${args.join(' ')} exited ${result.status}: ${result.stderr.trim()}`);
  return result.stdout;
}

// The key comes from the PR's base branch on GitHub, never from the worktree, so a PR cannot drop or swap it.
// A 404 means signing is not activated; any other failure is a refusal.
function baseKey(ref) {
  const path = `repos/{owner}/{repo}/contents/.github/review-verdict-key.pub?ref=${encodeURIComponent(ref)}`;
  const result = spawnSync('gh', ['api', '-H', 'Accept: application/vnd.github.raw', path], { encoding: 'utf8' });
  if (result.error) throw new Error(`gh api ${path}: ${result.error.message}`);
  if (result.status === 0) return publicKeyFromPem(result.stdout, `${ref}:.github/review-verdict-key.pub`);
  // A missing ref also answers 404 but with "No commit found for the ref", which stays a refusal.
  if (/Not Found \(HTTP 404\)/.test(result.stderr)) return null;
  throw new Error(`gh api ${path} exited ${result.status}: ${result.stderr.trim()}`);
}

function main(argv) {
  if (argv.length !== 1 || !/^[1-9]\d*$/.test(argv[0])) {
    console.error('usage: node scripts/merge-guard.mjs <pr-number>');
    return 2;
  }
  const pr = argv[0];
  const refuse = failures => {
    for (const failure of failures) console.error(`merge-guard: refusing to merge #${pr}: ${failure}`);
    return 1;
  };
  try {
    const { headRefOid: headSha, state } = JSON.parse(gh(['pr', 'view', pr, '--json', 'headRefOid,state']));
    if (state !== 'OPEN') return refuse([`PR state is ${state}, not OPEN`]);
    const failures = [];
    for (const file of SUMMARIES) {
      let text;
      try { text = readFileSync(resolve(file), 'utf8'); } catch (error) {
        failures.push(`${file}: cannot be read (${error.code ?? error.message})`);
        continue;
      }
      failures.push(...checkSummary(file, text, headSha));
    }
    // --slurp wraps the pages in one outer array, so every page's comments are evaluated together.
    const pages = JSON.parse(gh(['api', '--paginate', '--slurp', `repos/{owner}/{repo}/issues/${pr}/comments`]));
    const { user, base } = JSON.parse(gh(['api', `repos/{owner}/{repo}/pulls/${pr}`]));
    const verdict = evaluate({ headSha, comments: pages.flat(), publicKey: baseKey(base.ref), repo: base.repo.full_name, pr, prAuthor: user?.login });
    if (verdict.state !== 'success') failures.push(`review verdict: ${verdict.description}`);
    const reviewPages = JSON.parse(gh(['api', '--paginate', '--slurp', `repos/{owner}/{repo}/pulls/${pr}/comments`]));
    failures.push(...unansweredBotThreads(reviewPages.flat()));
    if (failures.length) return refuse(failures);
    const merge = spawnSync('gh', ['pr', 'merge', pr, '--squash', '--match-head-commit', headSha], { stdio: 'inherit' });
    if (merge.error) throw merge.error;
    return merge.status ?? 1;
  } catch (error) {
    return refuse([error.message]);
  }
}

process.exitCode = main(process.argv.slice(2));
