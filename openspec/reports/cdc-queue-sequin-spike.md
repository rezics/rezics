# CDC Queue Sequin Spike Report

Date: 2026-05-16

## Goal

Validate the proposed CDC and queue stack before opening a formal OpenSpec implementation:

- Sequin Docker reads Postgres changes.
- Sequin sends selected table changes to a webhook sink.
- The webhook writes pg-boss jobs only.
- The worker consumes pg-boss jobs and would dispatch to existing `package/search/src/sync.ts` functions.
- No formal `package/job`, `package/job-worker`, or `package/cdc-router` implementation was added in the main worktree.

## Environment

Temporary worktree:

```powershell
git worktree add -b codex/experiment-cdc-queue-spike D:\Projects-ICS\rezics-cdc-queue-spike dev
```

Start commit:

```text
718111f7 chore: organize the reports into the openspec/reports directory
```

Local tool versions observed:

```text
Docker version 29.4.3
Docker Compose version v5.1.3
Bun 1.3.8
pg-boss 12.18.2
Sequin image: sequin/sequin:latest
```

The existing local Postgres on port `5432` was not modified. It reported:

```sql
SHOW wal_level;
-- replica
```

That means the current dev DB cannot be used as a logical replication source without a Postgres restart/config change. The spike therefore used an isolated Postgres container on port `55432` with `wal_level=logical`.

## Spike Topology

```text
rezics_spike_postgres (Postgres 16, :55432, wal_level=logical)
  -> publication rezics_spike_pub
  -> Sequin (:7376 UI/API)
  -> webhook http://host.docker.internal:4567/sequin/webhook
  -> pg-boss table in rezics_spike
  -> temporary Bun worker
```

Subscribed tables:

- `public.UnitTag`
- `public.UnitTranslation`
- `public.Post`
- `public.UserUnitProgress`

The Sequin documentation confirms Docker Compose is the quickstart path and supports a Meilisearch sink, but for this project the spike deliberately used a webhook sink instead of the direct Meilisearch sink because our search documents are multi-table projections. Reference: [Sequin Meilisearch quickstart](https://sequinstream.com/docs/quickstart/meilisearch).

## Relevant Config Snippets

Sequin config shape used in the spike:

```yaml
databases:
  - name: rezics_spike
    hostname: spike_postgres
    port: 5432
    database: rezics_spike
    username: postgres
    password: postgres
    slot:
      name: rezics_spike_slot
      create_if_not_exists: true
    publication:
      name: rezics_spike_pub
      create_if_not_exists: false

http_endpoints:
  - name: local_webhook
    url: http://host.docker.internal:4567/sequin/webhook

sinks:
  - name: rezics_search_projection_webhook
    database: rezics_spike
    source:
      include_tables:
        - public.UnitTag
        - public.UnitTranslation
        - public.Post
        - public.UserUnitProgress
    actions:
      - insert
      - update
      - delete
    initial_backfill: true
    batch_size: 1
    destination:
      type: webhook
      http_endpoint: local_webhook
      batch: false
```

pg-boss queue setup that worked:

```ts
await boss.createQueue('search.slow.v2', {
  policy: 'short',
  retentionSeconds: 86_400,
  deleteAfterSeconds: 3_600,
});

await boss.send('search.slow.v2', command, {
  singletonKey: command.idempotencyKey,
  startAfter: command.debounceKey ? new Date(Date.now() + 10_000) : undefined,
  retryLimit: 3,
  retryDelay: 5,
});
```

## Commands Run

Start stack:

```powershell
docker compose -f spike\cdc-queue\docker-compose.yml up -d
```

Start temporary webhook/worker:

```powershell
bun run spike/cdc-queue/webhook-and-worker.ts
```

Generate CDC events:

```powershell
docker exec rezics_spike_postgres psql -U postgres -d rezics_spike -v ON_ERROR_STOP=1 -c 'INSERT INTO "UnitTag" ("unitId", "tagUnitId", score) VALUES (''unit-2'', ''tag-a'', 1); UPDATE "UnitTag" SET score = 2 WHERE "unitId" = ''unit-2'' AND "tagUnitId" = ''tag-a''; UPDATE "UnitTag" SET score = 3 WHERE "unitId" = ''unit-2'' AND "tagUnitId" = ''tag-a''; INSERT INTO "UnitTranslation" ("unitId", language, title, subtitle) VALUES (''unit-2'', ''en'', ''Second Title'', ''Sub''); UPDATE "UnitTranslation" SET title = ''Second Title Updated'' WHERE "unitId" = ''unit-2'' AND language = ''en''; INSERT INTO "Post" ("unitId", "authorUserId", "targetUnitId", body) VALUES (''post-2'', ''user-2'', ''unit-2'', ''hello''); UPDATE "Post" SET body = ''hello updated'' WHERE "unitId" = ''post-2''; INSERT INTO "UserUnitProgress" ("userId", "unitId", progress, status) VALUES (''user-2'', ''unit-2'', 0.25, ''reading''); UPDATE "UserUnitProgress" SET "isDeleted" = true WHERE "userId" = ''user-2'' AND "unitId" = ''unit-2''; DELETE FROM "Post" WHERE "unitId" = ''post-2'';'
```

Verify pg-boss rows:

```powershell
docker exec rezics_spike_postgres psql -U postgres -d rezics_spike -c 'SELECT state, count(*) FROM pgboss.job WHERE name = ''search.slow.v2'' GROUP BY state ORDER BY state;'
```

Retry test:

```powershell
Stop-Process -Id <temporary-bun-pid> -Force
docker exec rezics_spike_postgres psql -U postgres -d rezics_spike -v ON_ERROR_STOP=1 -c 'INSERT INTO "UnitTag" ("unitId", "tagUnitId", score) VALUES (''unit-3'', ''tag-b'', 1); UPDATE "UnitTag" SET score = 2 WHERE "unitId" = ''unit-3'' AND "tagUnitId" = ''tag-b'';'
```

## Sequin Message Shape

Observed webhook body for insert/update:

```json
{
  "record": {
    "unitId": "unit-3",
    "tagUnitId": "tag-b",
    "score": 1
  },
  "metadata": {
    "table_name": "UnitTag",
    "commit_timestamp": "2026-05-16T01:02:24.444904Z",
    "commit_idx": 0,
    "commit_lsn": 27635224,
    "idempotency_key": "Mjc2MzUyMjQ6MA==",
    "record_pks": ["unit-3", "tag-b"],
    "database_name": "rezics_spike"
  },
  "action": "insert",
  "changes": null
}
```

Observed delete payload:

```json
{
  "record": {
    "unitId": "post-2",
    "authorUserId": null,
    "targetUnitId": null,
    "body": null
  },
  "metadata": {
    "table_name": "Post",
    "commit_idx": 9,
    "record_pks": ["post-2"]
  },
  "action": "delete",
  "changes": null
}
```

Delete records preserved primary key fields and set most non-key fields to `null`. This is sufficient for delete jobs keyed by PK, but not sufficient for delete handlers that need related fields unless they query the database or keep prior projection state.

Updates in this config delivered the post-update `record`, but `changes` was `{}`. Do not rely on `changes` for routing in v1.

## Ordering Findings

All events in a single SQL transaction shared the same `commit_lsn` and had incrementing `commit_idx`.

However, webhook delivery order was not strictly `commit_idx` order in the observed run. Example from one transaction:

```text
delivered commit_idx: 0, 5, 3, 7, 4, 6, 1, 8, 2, 9
```

This is acceptable if the router enqueues idempotent "sync current projection from DB" jobs, which is exactly the right model for Meilisearch. It is risky for incremental patch logic that depends on event order or before/after values.

Recommendation: Treat Sequin CDC events as invalidation signals, not authoritative ordered patches, for complex indexes.

## pg-boss Debounce / Idempotency Findings

With `policy: 'short'`, `singletonKey`, and `startAfter`, pg-boss provided the desired slow-window behavior.

Observed batch:

```text
10 CDC webhook events
12 enqueue attempts
7 actual pg-boss jobs created
7 completed jobs
```

Duplicate singleton enqueue attempts returned `jobId: null`, for example:

```json
{
  "jobId": null,
  "command": {
    "kind": "search.content.patchTags",
    "unitId": "unit-3"
  }
}
```

Final verification:

```text
state      | count
-----------+------
completed  | 7
```

This is a good fit for "slow queue" pressure relief. The formal enqueue helper should:

- Use stable `singletonKey` per logical projection target.
- Use `startAfter` for slow/debounce queues.
- Treat `jobId: null` as "merged into an existing pending job", not an error.
- Count created jobs separately from enqueue attempts.

## Retry Findings

When the webhook was stopped, Sequin logged delivery failures and kept the messages:

```text
Req.TransportError: connection refused
Failed to deliver messages to sink: [http_endpoint]: POST to webhook endpoint failed
message_count=2
messages_failed_count=1
```

After restarting the webhook, Sequin redelivered the two pending UnitTag messages. pg-boss created one debounced job:

```text
received: 2
enqueued attempts: 2
handled: 1
pg-boss: completed search.content.patchTags:unit-3 count=1
```

This is production-promising. We still need to configure and document Sequin retry/backoff/dead-letter behavior explicitly for production.

## Worker Reuse Notes

Existing `package/search/src/sync.ts` already exposes the functions the worker needs:

```text
syncSingleContent
patchContentTags
patchContentTranslations
patchPostsTarget
syncSinglePost
patchPostFields
syncProgress
removeProgress
syncSingleRealm
patchRealmTranslations
patchRealmMetadata
patchUserFields
patchFeedbackResolution
```

For v1, the worker should mostly dispatch to these idempotent functions. Prefer full sync/current-state patch functions over event-delta mutation.

## Integration Friction

Sequin:

- The correct Docker image is `sequin/sequin:latest`, not `sequinstream/sequin:latest`.
- The container expected its own internal Postgres config via `PG_HOSTNAME`, `PG_PORT`, `PG_DATABASE`, `PG_USERNAME`, and `PG_PASSWORD`.
- `SECRET_KEY_BASE` and `VAULT_KEY` are required for this Docker setup.
- The UI was reachable at `http://127.0.0.1:7376`, and `sequin.yml` config application worked.
- Existing local dev Postgres was not immediately usable for CDC because `wal_level=replica`.

pg-boss:

- Bun ESM import for `pg-boss@12.18.2` must use `import { PgBoss } from 'pg-boss'`.
- Named queues must be created before workers start: `await boss.createQueue(name, options)`.
- `boss.work()` handler receives an array of jobs in v12.
- The initial wrong worker callback marked jobs failed; after fixing it, the corrected queue completed jobs normally.

## Backfill Findings

`initial_backfill: true` started successfully and Sequin booted table producer workers. In this spike, the source tables were empty when the sink was created, so non-empty backfill behavior was not fully proven.

Follow-up needed before implementation:

- Seed rows before sink creation.
- Create a fresh sink/slot.
- Confirm backfill event shape and ordering.
- Confirm whether backfill events have a distinct action/metadata marker that the router can use.

## Direct Meilisearch Sink Candidates

Do not use direct Sequin Meilisearch sink for complex v1 indexes:

- content documents combine units, translations, tags, realms, attributions, type-specific rows, shelves, and visibility rules.
- post documents need target/user/root-context fanout.
- progress documents include user-specific keys and delete/soft-delete semantics.

Possible later direct-sink candidates:

- A simple single-table audit/debug index.
- A future feedback-only index if the document is truly one table or has a simple transform.
- Possibly progress only if it remains one-row-to-one-document and soft-delete handling is proven with direct sink delete semantics.

For the current search projection, route through:

```text
Sequin -> cdc-router webhook -> @rezics/job -> @rezics/job-worker -> @rezics/search -> Meilisearch
```

## Recommended Design Decision

Proceed with Sequin + pg-boss for the proposal.

Use Sequin webhook mode for v1, not direct Meilisearch sink and not Sequin Stream. Webhook mode is simpler for a local TS/Bun/Elysia runtime, already provides retry on sink failure, and keeps routing logic in our codebase. Sequin Stream may be worth revisiting only if we need pull-based consumption, partition control, or a non-HTTP runtime boundary.

Use pg-boss slow queues with `policy: 'short'`, `singletonKey`, and `startAfter` for burst smoothing. This fits the user's slow-window requirement.

Use tags as first-class job metadata for admin/searchability:

```text
domain:search
feature:meili
entity:unit
entity:post
entity:progress
effect:external-io
effect:fanout
```

V1 CDC routing should enqueue idempotent projection jobs:

```text
UnitTag insert/update/delete -> search.content.patchTags(unitId)
UnitTranslation insert/update/delete -> search.content.patchTranslations(unitId), search.posts.patchTarget(unitId)
Post insert/update -> search.post.sync(unitId)
Post delete -> search.post.delete(unitId)
UserUnitProgress insert/update -> search.progress.sync(userId, unitId)
UserUnitProgress update isDeleted=true/delete -> search.progress.remove(userId, unitId)
```

## Blockers / Open Questions

- Production/dev Postgres must run with logical replication enabled.
- Need a non-empty backfill test before implementing the router contract.
- Need to decide Sequin config ownership: likely `package/cdc-router/sequin/`.
- Need to define production retry/dead-letter monitoring for both Sequin and pg-boss.
- Need to ensure cdc-router validates Sequin signatures/secrets or otherwise restricts the webhook endpoint.
- Need to confirm whether Sequin can include richer `changes` data if we ever need it. V1 should not depend on it.

## Final Recommendation

Open an OpenSpec proposal for the three-package layout:

- `package/job`
- `package/job-worker`
- `package/cdc-router`

The spike supports the stack choice. The architecture should explicitly model CDC as invalidation/event routing, not ordered mutation replay. That keeps Meilisearch projection correctness anchored in current database state and lets the slow queue absorb write bursts safely.
