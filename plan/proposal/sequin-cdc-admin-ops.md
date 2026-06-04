---
title: Sequin CDC Admin Ops
status: active
created: 2026-06-04
completed:
supersededBy:
tags: [admin, cdc, sequin, job-runner, history, repair, diagnostic]
---

## Why

Rezics already has the right admin package entry points for operational status:
`/status/cdc`, `/status/history`, `/status/queue`, and `/repair`. The current
implementation is useful as a read-only health dashboard, but it does not yet
cover the recovery path described in
`plan/report/sequin-source-db-recovery-report.md`: source DB / Sequin drift can
leave `HistoryOutbox` rows pending while no `history.ingest` pg-boss job exists
and no history revision is written.

Make the admin package a reliable CDC operations console. It should diagnose
which link in the source DB -> Sequin -> job-runner -> history chain is broken,
surface precise next actions, and provide bounded repair actions for missed
outbox rows without exposing browser-side access to Sequin, Postgres, or
job-runner secrets.

## Durable constraints & decisions

- (type) CDC status must distinguish source database CDC state, Sequin service
  state, job-runner ingress/worker state, queue state, and HistoryOutbox state.
  A single `available/degraded/unavailable/unknown` badge is not enough for the
  focused `/status/cdc` page.
- (type) Routed CDC tables must have one code-owned manifest shared by Sequin
  status, local source verification/repair, and tests. The manifest must include
  every table handled by `package/job-runner/src/sequin/router.ts`, including
  `ContentStructureNode` when that route remains active.
- (test) Publication coverage tests must fail when the Sequin config/status
  table list and the router-handled table list drift apart.
- (test) A nonzero `HistoryOutbox.pending` count with no corresponding
  `history.outbox.ingest` queue activity must degrade the admin status because
  this is the incident signature from the recovery report.
- (test) Failed pg-boss job retry and missed `HistoryOutbox` row replay are
  separate repair scopes. Retrying a failed queue job must not be presented as
  repairing source outbox rows.
- (type) Missed history replay targets are source `HistoryOutbox.id` values,
  not pg-boss `lane:id` values. Replays enqueue
  `createHistoryOutboxIngestCommand(outboxId)` so idempotency remains
  `history.outbox.ingest:<outboxId>`.
- (test) Repair start must operate on the intended target set, not silently on
  dry-run samples. If a dry-run response is sample-limited, the contract/UI must
  either require explicit selected targets or start by dry-run id with a bounded
  server-side target snapshot.
- (comment) The browser only calls main server admin APIs. Main server owns
  bounded reads, repair orchestration, internal job-runner calls, and audit
  logging; admin UI must not call Sequin, Postgres, Meilisearch, or job-runner
  admin endpoints directly.
- (comment) Production slot recreation and active-slot termination are not
  normal admin repair actions. Any future production slot operation needs an
  explicit deployment adapter, typed confirmation, LSN snapshot, and privileged
  audit entry.

## 1. CDC Manifest and Drift Detection

- [ ] 1.1 Add a shared source-CDC table manifest in a code-owned package or
  module that can be imported by server diagnostics and local service tooling.
- [ ] 1.2 Update `package/server/src/diagnostic/system-status.service.ts` to use
  the shared manifest instead of its local `ROUTED_SEQUIN_TABLES`.
- [ ] 1.3 Update `tool/src/commands/service/source.ts` to use the same manifest
  instead of its local `TRACKED_TABLES`, while keeping local repair behavior
  scoped to development.
- [ ] 1.4 Reconcile `package/job-runner/sequin/sequin.yml` with
  `package/job-runner/src/sequin/router.ts`, including `ContentStructureNode`
  if that route remains active.
- [ ] 1.5 Add tests that compare router-handled source tables, the shared
  manifest, and the checked-in Sequin YAML source table list.
- [ ] 1.6 Update the recovery report or operations docs only where needed to
  point operators at the code-owned manifest as the source of truth.

## 2. Diagnostic Model

- [ ] 2.1 Extend `package/server/src/diagnostic/status.types.ts` and
  `package/api/src/diagnostic/status.types.ts` with richer CDC fields:
  publication extra tables, slot active PID, restart/confirmed LSNs,
  walsender count, WAL sender settings, and oldest pending outbox age.
- [ ] 2.2 Update `getCdcStatus` to query `max_replication_slots`,
  `max_wal_senders`, `pg_stat_replication`, and publication extra tables.
- [ ] 2.3 Update `getHistoryOutboxStatus` to expose pending age buckets, recent
  pending rows, retry-ready failed rows, and a degraded state for suspicious
  pending backlog.
- [ ] 2.4 Correlate HistoryOutbox status with queue status enough to identify
  `pending outbox but no history.ingest work` as a distinct warning.
- [ ] 2.5 Add server diagnostic tests for slot missing, slot inactive, lag high,
  walsender pressure, publication table drift, pending outbox backlog, and
  failed queue jobs.
- [ ] 2.6 Keep diagnostic responses safe: no database URLs, secrets, SQL text
  with credentials, or raw error messages that could leak tokens.

## 3. Admin Status UI

- [ ] 3.1 Update `package/admin/src/system-health/pages/StatusCdcPage.tsx` so
  the focused CDC page renders source DB CDC, Sequin service, job-runner
  ingress/worker, and relevant queue/history signals together.
- [ ] 3.2 Update `CdcPanel` in
  `package/admin/src/system-health/components/StatusPanels.tsx` to show slot
  existence/active state, LSNs, lag, WAL sender pressure, missing/extra
  publication tables, and operator-oriented next actions.
- [ ] 3.3 Remove or avoid duplicate Sequin rows in services/system summary
  rendering so status counts and panels do not double-count the same service.
- [ ] 3.4 Add focused admin UI states for the recovery report scenarios:
  healthy, Sequin down, slot missing, publication drift, pending outbox missed
  by CDC, failed history job, and queue down.
- [ ] 3.5 Add Storybook or component-level coverage for the focused status
  panels using safe fixture summaries.

## 4. Repair Contract and API

- [ ] 4.1 Split `AdminRepairJobScope` so failed pg-boss job retry and
  HistoryOutbox replay are separate scopes, for example `queue-failed-job` and
  `history-outbox-replay`.
- [ ] 4.2 Update `package/contract/src/admin/repair-job.ts` so dry-run can
  distinguish `affectedCount`, bounded `sampleTargets`, and the exact target
  set used by `start`.
- [ ] 4.3 Add a repair dry-run for missed `HistoryOutbox` rows that can filter
  by status, age, unit id, limit, and explicit outbox ids.
- [ ] 4.4 Implement start for HistoryOutbox replay by enqueueing
  `createHistoryOutboxIngestCommand(outboxId)` through `serverJobProducer`.
- [ ] 4.5 Preserve existing failed job retry/cancel behavior under the renamed
  queue failed-job scope.
- [ ] 4.6 Add privileged audit entries for dry-run/start/retry/cancel with
  scope, target count, reason, correlation id, and safe operation summaries.
- [ ] 4.7 Add server repair tests for missed outbox replay, idempotent enqueue
  coalescing, sample-limited dry-runs, explicit target selection, and failed
  job retry after the scope rename.

## 5. Admin Repair UI

- [ ] 5.1 Update `package/admin/src/repair/pages/RepairJobsPage.tsx` to show
  separate repair cards for queue failed jobs and HistoryOutbox replay.
- [ ] 5.2 Make sample-limited dry-run behavior explicit in the UI and prevent
  accidentally repairing only the first sample when the operator intended all
  affected targets.
- [ ] 5.3 Add target controls for HistoryOutbox replay: status filter, age
  threshold, optional unit id, explicit ids, and max enqueue count.
- [ ] 5.4 Link `/status/cdc`, `/status/history`, and `/status/queue` warnings
  to prefilled repair scope/search state where safe.
- [ ] 5.5 Keep destructive or deployment-level Sequin controls out of the first
  UI pass; show runbook guidance and Sequin UI links instead.

## 6. Validation

- [ ] 6.1 Run targeted tests for diagnostic status, repair job service, job
  command creation, and admin status/repair components.
- [ ] 6.2 Run `bun run check:convention` after API/domain changes.
- [ ] 6.3 Run `bun run check:tokens` if admin JSX class changes touch styling.
- [ ] 6.4 Manually verify in admin after `bun run dev`: `/status`,
  `/status/cdc`, `/status/history`, `/status/queue`, and `/repair` for healthy
  and degraded fixture/local scenarios.

## Out of scope

- Building a direct Sequin management console in the browser.
- Production replication slot drop/recreate automation.
- Replacing the Sequin UI; admin should deep-link to it when configured.
- General Meilisearch, ranking, or search rebuild redesign beyond repair links
  needed after CDC recovery.
- Moving admin package information architecture away from the existing
  System Health and Repair pages.
