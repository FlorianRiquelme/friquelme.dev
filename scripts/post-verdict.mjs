import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseVerdict } from './review-verdict.mjs';

// The text of the last assistant entry that has a text block, text blocks joined in order; null when none.
export function lastAssistantText(jsonl) {
  let text = null;
  for (const line of jsonl.split('\n')) {
    if (!line.trim()) continue;
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    if (entry?.type !== 'assistant' || !Array.isArray(entry.message?.content)) continue;
    const blocks = entry.message.content.filter(block => block?.type === 'text' && typeof block.text === 'string');
    if (blocks.length) text = blocks.map(block => block.text).join('');
  }
  return text;
}

function main([pr, transcript]) {
  if (!pr || !transcript || !/^\d+$/.test(pr)) {
    console.error('usage: node scripts/post-verdict.mjs <pr-number> <transcript.jsonl>');
    return 2;
  }
  let jsonl;
  try { jsonl = readFileSync(resolve(transcript), 'utf8'); } catch (error) {
    console.error(`post-verdict: cannot read ${transcript}: ${error.message}`);
    return 2;
  }
  const text = lastAssistantText(jsonl);
  if (text === null) {
    console.error('post-verdict: transcript has no assistant text message');
    return 2;
  }
  if (text.includes('&lt;!--')) {
    console.error('post-verdict: refusing: the text contains "&lt;!--", so the input was escaped and is not a raw transcript');
    return 1;
  }
  const parsed = parseVerdict(text);
  if (!parsed) {
    console.error('post-verdict: refusing: the last assistant message is not a valid verdict (marker, "Review verdict:" and "Reviewed head:" lines must open it)');
    return 1;
  }
  const view = spawnSync('gh', ['pr', 'view', pr, '--json', 'headRefOid'], { encoding: 'utf8' });
  let head;
  try { head = JSON.parse(view.stdout).headRefOid; } catch { head = undefined; }
  if (view.status !== 0 || !head) {
    console.error(`post-verdict: cannot read the head of PR ${pr}: ${view.stderr}`);
    return 1;
  }
  if (parsed.sha !== head) {
    console.error(`post-verdict: refusing: verdict is for ${parsed.sha}, PR ${pr} head is ${head}`);
    return 1;
  }
  const dir = mkdtempSync(join(tmpdir(), 'post-verdict-'));
  try {
    const file = join(dir, 'verdict.md');
    writeFileSync(file, text);
    const post = spawnSync('gh', ['pr', 'comment', pr, '--body-file', file], { stdio: 'inherit' });
    return post.status ?? 1;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = main(process.argv.slice(2));
}
