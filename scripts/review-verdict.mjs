import { createPublicKey, verify } from 'node:crypto';
import { appendFileSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export const STATUS_CONTEXT = 'review-verdict';
// Posted instead of STATUS_CONTEXT once a key is loaded; code from before signing existed never posts it.
export const SIGNED_STATUS_CONTEXT = 'review-verdict-signed';
export const TRUSTED_ASSOCIATIONS = ['OWNER', 'MEMBER', 'COLLABORATOR'];

export const PUBLIC_KEY_FILE = '.github/review-verdict-key.pub';
const SIGNATURE = /^<!-- review-verdict-signature: ([A-Za-z0-9+/]{86}==) -->$/;
const DEPENDABOT = 'dependabot[bot]';

export const signedPayload = ({ repo, pr, verdict, sha }) => `review-verdict:v1:${repo}:${pr}:${verdict}:${sha}`;

export function publicKeyFromPem(pem, source = 'review verdict key') {
  const key = createPublicKey(pem);
  if (key.asymmetricKeyType !== 'ed25519') throw new Error(`${source}: not an Ed25519 public key`);
  return key;
}

// Null when no key file exists (signing not activated); any other problem throws so the check fails closed.
export function loadPublicKey(file = PUBLIC_KEY_FILE) {
  let pem;
  try { pem = readFileSync(resolve(file), 'utf8'); } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
  return publicKeyFromPem(pem, file);
}

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
  const signature = SIGNATURE.exec(lines[3] ?? '')?.[1] ?? null;
  return { verdict, sha, signature };
}

const limit = text => (text.length > 140 ? `${text.slice(0, 139)}…` : text);

function verifies(publicKey, payload, signature) {
  if (!signature) return false;
  try { return verify(null, Buffer.from(payload, 'utf8'), publicKey, Buffer.from(signature, 'base64')); } catch { return false; }
}

/** @param {{ headSha: string, comments: any[], publicKey?: import('node:crypto').KeyObject | null, repo?: string, pr?: string | number, prAuthor?: string }} input */
export function evaluate({ headSha, comments, publicKey = null, repo, pr, prAuthor }) {
  const sha7 = headSha.slice(0, 7);
  const signed = Boolean(publicKey) && prAuthor !== DEPENDABOT;
  const matching = comments
    .filter(comment => comment.user?.type !== 'Bot')
    .filter(comment => TRUSTED_ASSOCIATIONS.includes(comment.author_association))
    .map(comment => ({ comment, parsed: parseVerdict(comment.body) }))
    .filter(({ parsed }) => parsed && parsed.sha === headSha)
    .filter(({ parsed }) => !signed || verifies(publicKey, signedPayload({ repo, pr, verdict: parsed.verdict, sha: parsed.sha }), parsed.signature))
    .sort((a, b) => {
      const byTime = Date.parse(a.comment.created_at) - Date.parse(b.comment.created_at);
      return byTime || a.comment.id - b.comment.id;
    });
  const latest = matching.at(-1);
  if (!latest) return { state: 'failure', description: limit(`No ${signed ? 'signed ' : ''}PASS verdict for head ${sha7}`), targetUrl: null };
  const { comment, parsed } = latest;
  if (parsed.verdict === 'PASS') {
    return { state: 'success', description: limit(`${signed ? 'Signed PASS' : 'PASS'} for ${sha7} by ${comment.user?.login}`), targetUrl: comment.html_url };
  }
  return { state: 'failure', description: limit(`Latest verdict for ${sha7} is FAIL`), targetUrl: comment.html_url };
}

// A non-success state must not look like a passed review: the job stays green, so it says so.
export const warningCommand = ({ state, description }) => (state === 'success' ? null : `::warning title=${STATUS_CONTEXT}::${description}`);

export const summaryLine = ({ state, description }, headSha) => `review-verdict: ${state} for ${headSha.slice(0, 7)} (${description})\n`;

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
    const post = (context, state, description, targetUrl) => call(`${api}/repos/${repo}/statuses/${headSha}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state, context, description, target_url: targetUrl ?? pull.html_url }),
    });
    let publicKey;
    try { publicKey = loadPublicKey(); } catch (error) {
      await post(SIGNED_STATUS_CONTEXT, 'failure', 'Review verdict key does not load', null);
      throw error;
    }
    const { state, description, targetUrl } = evaluate({ headSha, comments, publicKey, repo, pr, prAuthor: pull.user?.login });
    await post(publicKey ? SIGNED_STATUS_CONTEXT : STATUS_CONTEXT, state, description, targetUrl);
    console.log(`review-verdict: ${state} on ${headSha} (${description})`);
    const result = { state, description };
    const warning = warningCommand(result);
    if (warning) {
      console.log(warning);
      if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summaryLine(result, headSha));
    }
    return 0;
  } catch (error) {
    console.error(`review-verdict: ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = await main();
}
