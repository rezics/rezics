---
title: Repair History Sync
status: done
created: 2026-06-13
completed: 2026-06-13
supersededBy:
tags: [history, job-runner, server, app]
---

## Why

History sync currently depends on a brittle CDC shape: main mutations write
`HistoryOutbox`, but Sequin delivery can be routed to no job if the webhook table
name is schema-qualified. Missed delivery also has no automatic worker-side
fallback, so pending outbox rows can sit forever unless an admin explicitly
replays them.

The fix should make ingestion robust against realistic Sequin payloads, keep
pending rows recoverable without reintroducing history-service polling, and clean
up app-facing history behavior that makes a working backend look broken.

## Durable constraints & decisions

- `(test)` Sequin routing must treat `HistoryOutbox`, `public.HistoryOutbox`, and
  quoted schema-qualified variants as the same table while preserving the source
  table string for diagnostics.
- `(test)` The history worker must be able to process pending retry-ready rows
  even when no explicit CDC job was delivered.
- `(comment)` Job-runner remains the only runtime ingestion owner; the history
  HTTP service must not grow an in-process outbox poller.
- `(test)` App-facing raw revision content and structure payload reads require
  owner/admin authority; public metadata/compare reads stay available for public
  units.
- `(test)` Book history compare links must compare an earlier revision to a later
  revision, never a revision against itself.

## Tasks

## 1. CDC and worker recovery

- [x] 1.1 Normalize Sequin table names in `package/job-runner/src/sequin/router.ts`
      and cover schema-qualified payloads in router tests.
- [x] 1.2 Add a queue command/handler for retry-ready pending history batch
      ingestion, keeping explicit outbox-id ingestion unchanged.
- [x] 1.3 Add a worker test proving batch ingestion delegates to
      `HistoryOutboxConsumer.consumeBatch`.

## 2. App-facing server proxy

- [x] 2.1 Enforce raw payload authority in `history-proxy.api.ts` for revision
      content and structure payload reads.
- [x] 2.2 Add proxy tests for public metadata allowed but raw payload denied.

## 3. Book history UI behavior

- [x] 3.1 Fix latest revision compare targets so the UI never navigates to
      `base === target`.
- [x] 3.2 Surface structure timeline query errors instead of silently showing an
      empty state.

## 4. Verification

- [x] 4.1 Run targeted tests for job-runner history routing/handlers, history
      outbox/revision services, server history proxy, and app history compare.

## Out of scope

- A full generic Unit history feature.
- A visual redesign of the book history page.
- A historical backfill of already-missed development data.
