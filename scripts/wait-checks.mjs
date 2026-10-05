import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const USAGE = 'usage: node scripts/wait-checks.mjs <pr-number> [--checks site,infra] [--timeout-seconds 1800] [--interval-seconds 15]';

// Exit codes: 0 all required checks passed, 1 a required check failed, 3 timeout, 2 usage or gh error.
export function parseArgs(argv) {
  const opts = { pr: null, checks: ['site', 'infra'], timeout: 1800, interval: 15 };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--checks' || arg === '--timeout-seconds' || arg === '--interval-seconds') {
      const value = argv[++i];
      if (value === undefined) return null;
      if (arg === '--checks') {
        opts.checks = value.split(',').map(name => name.trim()).filter(Boolean);
        if (!opts.checks.length) return null;
      } else {
        const seconds = Number(value);
        if (!Number.isFinite(seconds) || seconds < 0) return null;
        if (arg === '--timeout-seconds') opts.timeout = seconds; else opts.interval = seconds;
      }
    } else if (/^\d+$/.test(arg) && opts.pr === null) {
      opts.pr = arg;
    } else {
      return null;
    }
  }
  return opts.pr === null ? null : opts;
}

// One poll: 'error' for an unexpected gh failure, otherwise the verdict for the required checks.
export function evaluate(checks, required) {
  const failed = [];
  const pending = [];
  for (const name of required) {
    const found = checks.filter(check => check.name === name);
    if (!found.length) { pending.push(name); continue; }
    const bad = found.find(check => check.bucket === 'fail' || check.bucket === 'cancel');
    if (bad) failed.push(`${name} (${bad.state})`);
    else if (!found.every(check => check.bucket === 'pass')) pending.push(name);
  }
  return { failed, pending };
}

const sleep = seconds => new Promise(resolve => setTimeout(resolve, seconds * 1000));

async function main(argv) {
  const opts = parseArgs(argv);
  if (!opts) { console.error(USAGE); return 2; }
  const deadline = Date.now() + opts.timeout * 1000;
  let pending = opts.checks;
  for (;;) {
    const run = spawnSync('gh', ['pr', 'checks', opts.pr, '--json', 'name,state,bucket'], { encoding: 'utf8' });
    let checks = [];
    if (run.error || (run.status !== 0 && !/no checks reported/i.test(run.stderr))) {
      console.error(`wait-checks: gh failed: ${run.error?.message ?? run.stderr.trim()}`);
      return 2;
    }
    if (run.status === 0) {
      try { checks = JSON.parse(run.stdout); } catch {
        console.error(`wait-checks: gh returned invalid JSON: ${run.stdout.slice(0, 200)}`);
        return 2;
      }
    }
    const result = evaluate(checks, opts.checks);
    if (result.failed.length) {
      console.error(`wait-checks: failed: ${result.failed.join(', ')}`);
      return 1;
    }
    pending = result.pending;
    if (!pending.length) { console.log(`wait-checks: passed: ${opts.checks.join(', ')}`); return 0; }
    const remaining = (deadline - Date.now()) / 1000;
    if (remaining <= 0) break;
    // A poll after the deadline could report a pass that came too late, so the capped sleep ends the wait.
    if (opts.interval >= remaining) { await sleep(remaining); break; }
    await sleep(opts.interval);
  }
  console.error(`wait-checks: timeout after ${opts.timeout}s, still pending: ${pending.join(', ')}`);
  return 3;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main(process.argv.slice(2));
}
