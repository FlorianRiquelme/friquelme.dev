import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export const STATUS_CONTEXT = 'review-verdict';
export const TRUSTED_ASSOCIATIONS = ['OWNER', 'MEMBER', 'COLLABORATOR'];

const MARKER = /^<!-- review-verdict: (PASS|FAIL) sha=([0-9a-f]{40}) -->$/;

// The marker counts only as the comment's first line, directly followed by the visible verdict and
// head lines, so a verdict quoted further down (in a code fence, say) never counts.
export function parseVerdict(body) {
  const lines = String(body ?? '').split(/\r?\n/);
  if (lines.filter(line => MARKER.test(line)).length !== 1) return null;
  const marker = MARKER.exec(lines[0]);
  if (!marker) return null;
  const [, verdict, sha] = marker;
  if (lines[1]?.trimEnd() !== `Review verdict: ${verdict}`) return null;
  if (lines[2]?.trimEnd() !== `Reviewed head: ${sha}`) return null;
  return { verdict, sha };
}

const limit = text => (text.length > 140 ? `${text.slice(0, 139)}…` : text);

export function evaluate({ headSha, comments }) {
  const sha7 = headSha.slice(0, 7);
  const matching = comments
    .filter(comment => TRUSTED_ASSOCIATIONS.includes(comment.author_association))
    .map(comment => ({ comment, parsed: parseVerdict(comment.body) }))
    .filter(({ parsed }) => parsed && parsed.sha === headSha)
    .sort((a, b) => {
      const byTime = Date.parse(a.comment.created_at) - Date.parse(b.comment.created_at);
      return byTime || a.comment.id - b.comment.id;
    });
  const latest = matching.at(-1);
  if (!latest) return { state: 'failure', description: limit(`No PASS verdict for head ${sha7}`), targetUrl: null };
  const { comment, parsed } = latest;
  if (parsed.verdict === 'PASS') {
    return { state: 'success', description: limit(`PASS for ${sha7} by ${comment.user?.login}`), targetUrl: comment.html_url };
  }
  return { state: 'failure', description: limit(`Latest verdict for ${sha7} is FAIL`), targetUrl: comment.html_url };
}

async function main() {
  const { GITHUB_TOKEN: token, GITHUB_REPOSITORY: repo, PR_NUMBER: pr } = process.env;
  const api = process.env.GITHUB_API_URL || 'https://api.github.com';
  const missing = ['GITHUB_TOKEN', 'GITHUB_REPOSITORY', 'PR_NUMBER'].filter(name => !process.env[name]);
  if (missing.length) {
    console.error(`review-verdict: missing env ${missing.join(', ')}`);
    return 2;
  }
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'review-verdict-gate',
  };
  const call = async (url, init) => {
    const response = await fetch(url, { ...init, headers: { ...headers, ...init?.headers } });
    if (!response.ok) throw new Error(`${response.status} ${init?.method ?? 'GET'} ${url}`);
    return response.json();
  };

  try {
    const pull = await call(`${api}/repos/${repo}/pulls/${pr}`);
    const headSha = pull.head.sha;
    const comments = [];
    for (let page = 1; ; page++) {
      const batch = await call(`${api}/repos/${repo}/issues/${pr}/comments?per_page=100&page=${page}`);
      comments.push(...batch);
      if (batch.length < 100) break;
    }
    const { state, description, targetUrl } = evaluate({ headSha, comments });
    await call(`${api}/repos/${repo}/statuses/${headSha}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state, context: STATUS_CONTEXT, description, target_url: targetUrl ?? pull.html_url }),
    });
    console.log(`review-verdict: ${state} on ${headSha} (${description})`);
    return 0;
  } catch (error) {
    console.error(`review-verdict: ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = await main();
}
