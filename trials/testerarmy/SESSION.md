# Implementation session access

Primary session: `01a10169-da27-7a90-b7c0-19935563a698`, Codex in the issue-75 Orca worktree on agent-server. Base commit `46c31e2`; task branch `FlorianRiquelme/trial-testerarmy-e2e-for-website-verification-an`. One Luna helper (`/root/upstream_review`) did upstream inspection and implemented the focused control. Its dispatch, messages and completion are in the root rollout; its separate internal transcript/session identifier was not exposed or located. Do not call the parent record complete subagent capture.

Before implementation, at approximately 11:01 UTC on 2026-10-03, native log access was identified and a private snapshot established. The log started at 10:57:56; its earlier records are included. Orca session search is disabled; it was not enabled automatically.

## Private durable archive

On **agent-server**, as the `agent` user:

```
/home/agent/.local/share/friquelme-trials/issue-75/01a10169-da27-7a90-b7c0-19935563a698/
  rollout.private.jsonl       native execution snapshot (private context included)
  observable-review.jsonl     sanitized observable export, still private for review
  capture-metadata.json       capture timestamp, omissions and native source path
  refresh-capture.py          small allowlist exporter/snapshot refresher
  results/                   original trial attempts, reports/screenshots/traces
```

This location survives removal of the worktree. Access through the existing SSH/tailnet connection to agent-server, or read the files from a later agent running as `agent`. No public artifact upload is involved. The directory is mode 0700 and raw log/export mode 0600. The human can privately copy it with existing SSH/SFTP access. Raw log and AI traces must never be committed to the public repository. The native source is also recorded in metadata, under the account's `home/sessions/2026/10/03/rollout-...jsonl`.

Refresh the snapshot after resuming/finishing the session:

```sh
python3 /home/agent/.local/share/friquelme-trials/issue-75/01a10169-da27-7a90-b7c0-19935563a698/refresh-capture.py
```

The archive is ordinary local disk storage, not an immutable/remote backup. There is no configured automatic expiry or backup guarantee; it lasts until deleted or machine/account storage is lost. Exact snapshot coverage is `lastNativeTimestamp` in metadata. A still-active session's final response and later actions are outside the snapshot until refreshed. A subsequent implementation session should append its session ID/archive and commit linkage here; keep the earlier archive.

## Capture coverage

Native JSONL supplies observable user/assistant messages, tool calls/results and timestamps, alongside private harness material. The sanitized private export allowlists task user text, assistant messages and tool records; it excludes reasoning/encrypted reasoning, system/developer instructions, initial AGENTS/environment context, instruction-file/private-context/capture reads. Raw tool outputs may already have been truncated by configured tool budgets. Subagent internal tool turns are a gap. No complete-capture claim is made.

The public [execution record](evidence/EXECUTION.md) is a manually reviewed, reconstructed selection of these events and results; it is **not** a verbatim full transcript. [FRICTION.md](FRICTION.md) preserves material unsuccessful attempts and distinguishes observations from diagnoses. Full private observable export is available for reviewing omitted routine execution details; omissions are explicit. The review export has no private reasoning or harness prompts. The private broader findings buffer remains in another workspace; this trial's transferable findings are [FINDINGS.md](FINDINGS.md).
