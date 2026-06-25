#!/usr/bin/env bun
/**
 * One-shot ranking Meili backfill / full-sync.
 *
 * Enqueues a `ranking.fullSync` job into the job-runner queue; it is consumed
 * by the dedicated `ranking-worker` lane and dispatched to the ranking
 * service's `/ranking/command`, which repopulates ranking fields on the Meili
 * `content`/`posts` documents. Run after ranking-relevant schema or
 * index-settings changes. Idempotent — safe to re-run.
 *
 * Reaches the internal job-runner enqueue endpoint, so run it from the host or
 * through an SSH tunnel to `rezics-job-runner-web:3005`.
 *
 * Env:
 *   JOB_RUNNER_BASE_URL         (default http://127.0.0.1:3005)
 *   JOB_RUNNER_INTERNAL_SECRET  (required)
 *   RANKING_FULL_SYNC_RANK_KIND (optional: content | post | comment)
 */
import { createRankingCommand, RANKING_COMMAND_KINDS } from "@rezics/contract/job";

const baseUrl = process.env.JOB_RUNNER_BASE_URL ?? "http://127.0.0.1:3005";
const secret = process.env.JOB_RUNNER_INTERNAL_SECRET;
if (!secret) {
  console.error("JOB_RUNNER_INTERNAL_SECRET is required");
  process.exit(2);
}

const rankKind = process.env.RANKING_FULL_SYNC_RANK_KIND as
  | "content"
  | "post"
  | "comment"
  | undefined;

const command = createRankingCommand(
  RANKING_COMMAND_KINDS.fullSync,
  rankKind ? { rankKind } : {},
  { type: "server" },
);

const response = await fetch(`${baseUrl}/contract/jobs/enqueue`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-internal-secret": secret,
  },
  body: JSON.stringify(command),
});

if (!response.ok) {
  console.error(
    `ranking full-sync enqueue failed: ${response.status} ${await response.text()}`,
  );
  process.exit(1);
}

console.log("ranking full-sync enqueued:", await response.json());
