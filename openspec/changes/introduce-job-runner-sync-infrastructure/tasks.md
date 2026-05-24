## 1. Job Contract Package

- [x] 1.1 Create `package/job` with `@rezics/job` package metadata, exports, `tsconfig.json`, and Bun/TypeScript test setup.
- [x] 1.2 Define shared command envelope types with `kind`, `lane`, `payload`, `idempotencyKey`, `source`, `tags`, and optional continuation metadata.
- [x] 1.3 Define lane constants for `search.sync.fast`, `search.sync.slow`, `history.ingest`, and `maintenance`.
- [x] 1.4 Define search command schemas for content, post, realm, entity, user, feedback, progress, delete/remove, patch, full sync, and fanout operations.
- [x] 1.5 Define history command schemas for `history.outbox.ingest`.
- [x] 1.6 Define maintenance command schemas for replay, drift repair, index rebuild, and fanout continuation.
- [x] 1.7 Implement idempotency key helpers for every command kind and logical target.
- [x] 1.8 Implement tag helper utilities for domain, effect, index/entity target, fanout, source type, and maintenance tags.
- [x] 1.9 Implement the internal HTTP enqueue client without importing service env modules.
- [x] 1.10 Add contract tests for command validation, lane selection, idempotency keys, and tag generation.
- [x] 1.11 Add an import/dependency convention check or targeted test proving `@rezics/job` does not import pg-boss, Elysia runtime, Prisma clients, Meilisearch clients, or env modules.

## 2. Job Runner Service Skeleton

- [x] 2.1 Create `package/job-runner` with `@rezics/job-runner` package metadata, Elysia/Bun scripts, build scripts, and exports.
- [x] 2.2 Add runtime env validation for `JOB_DATABASE_URL`, `SERVER_DATABASE_URL`, `HISTORY_DATABASE_URL`, `MEILI_HOST`, `MEILI_MASTER_KEY`, `JOB_RUNNER_INTERNAL_SECRET`, `SEQUIN_WEBHOOK_SECRET`, `PORT`, and `JOB_RUNNER_ROLE`.
- [x] 2.3 Implement Elysia app bootstrap with `/health` and `/ready` endpoints.
- [x] 2.4 Implement role-based startup for `JOB_RUNNER_ROLE=all`, `http`, and `worker`.
- [x] 2.5 Add CORS/internal-header policy appropriate for internal service usage only.
- [x] 2.6 Add graceful shutdown for HTTP server, pg-boss workers, and database clients.
- [x] 2.7 Add package README or development note explaining local startup and required env.

## 3. pg-boss Queue Setup

- [x] 3.1 Add `pg-boss` dependency only to `package/job-runner`.
- [x] 3.2 Implement `src/queue/boss.ts` to create and start the pg-boss instance using `JOB_DATABASE_URL`.
- [x] 3.3 Implement queue creation for all lanes before workers start.
- [x] 3.4 Configure `search.sync.slow` with debounce/coalescing policy using `policy: short`, singleton keys, retention, and delayed start behavior.
- [x] 3.5 Configure retry, retention, expiration, and dead-letter behavior for `search.sync.fast`, `history.ingest`, and `maintenance`.
- [x] 3.6 Treat `jobId: null` from duplicate singleton enqueue as a successful coalesced enqueue result.
- [x] 3.7 Add tests for lane creation options, singleton key behavior wrappers, and enqueue-result normalization.

## 4. Enqueue API

- [x] 4.1 Implement internal `POST /jobs/enqueue` endpoint that validates an `@rezics/job` command and enqueues it to the command lane.
- [x] 4.2 Implement optional batch enqueue endpoint for bounded batches of commands.
- [x] 4.3 Require `JOB_RUNNER_INTERNAL_SECRET` or equivalent internal auth for enqueue endpoints.
- [x] 4.4 Return normalized enqueue results including command kind, idempotency key, lane, created/coalesced status, and job id when present.
- [x] 4.5 Add endpoint tests for auth failure, schema failure, successful enqueue, and coalesced duplicate enqueue.

## 5. Sequin Webhook

- [x] 5.1 Add `sequin/sequin.yml` or equivalent config scaffold under `package/job-runner` for local/dev CDC routing.
- [x] 5.2 Implement `POST /webhooks/sequin` with shared-secret or bearer-token validation.
- [x] 5.3 Parse Sequin single-message and batched payload shapes if batching is enabled later, while configuring v1 for non-batched delivery.
- [x] 5.4 Preserve Sequin source metadata on commands: table, action, primary keys, idempotency key, commit LSN, commit index, and commit timestamp.
- [x] 5.5 Implement routing for `HistoryOutbox` insert to `history.outbox.ingest`.
- [x] 5.6 Implement routing for `Unit`, `UnitTranslation`, `UnitTag`, `UnitAlias`, attribution, realm membership, realm tag application, shelf membership, post, user, progress, and feedback table events to search commands.
- [x] 5.7 Ensure routing uses CDC only as invalidation/command routing and does not build Meili patches from CDC `changes`.
- [x] 5.8 Add webhook tests for authentication, unknown table handling, malformed payloads, delete payload primary-key handling, and duplicate Sequin delivery.
- [x] 5.9 Document logical replication prerequisites, publication ownership, replica identity expectations, and local dev behavior when CDC is unavailable.

## 6. Worker Dispatch

- [x] 6.1 Implement `src/worker.ts` to register workers for every lane and dispatch by command kind.
- [x] 6.2 Implement structured logging around job start, success, failure, retry, idempotency key, source metadata, and tags.
- [x] 6.3 Store handler output metadata where practical, including Meilisearch task uid and index name for search writes.
- [x] 6.4 Add unknown-command handling that fails the job with an actionable error.
- [x] 6.5 Add worker dispatch tests for each lane and command family.

## 7. Search Handler Infrastructure

- [x] 7.1 Configure `@rezics/search` in job-runner with a `SearchClient` and `setSearchPrismaClient` using the server Prisma client against `SERVER_DATABASE_URL`.
- [x] 7.2 Implement shared handler utilities for current-state reads, eligibility-aware sync/delete, Meili task metadata capture, and retryable error classification.
- [x] 7.3 Implement search content handlers for full sync, delete, metadata patch, tags, aliases, credits, subjects, translations, realm IDs, realm tag keys, and contained unit IDs.
- [x] 7.4 Implement post handlers for full sync, delete, field patch, author fanout, target fanout, realm ID/root target repair, and continuation cursor.
- [x] 7.5 Implement realm handlers for full sync, delete, metadata, translations, aliases, and member count.
- [x] 7.6 Implement entity handlers for full sync, delete, and aliases.
- [x] 7.7 Implement user handlers for full sync, delete, field patch, and posts-author fanout enqueue.
- [x] 7.8 Implement feedback handlers for full sync, delete, and resolution patch.
- [x] 7.9 Implement progress handlers for sync and remove using deterministic `(userId, unitId)` document ids.
- [x] 7.10 Add handler tests proving retries read current DB state rather than CDC event values.

## 8. Segmented Fanout

- [x] 8.1 Define a default fanout segment limit, cursor shape, and continuation command format.
- [x] 8.2 Update author, target, realm, and rebuild fanout handlers to stop at the segment limit and re-enqueue continuation when more records remain.
- [x] 8.3 Ensure continuation idempotency keys include the logical fanout target and cursor or segment identity.
- [x] 8.4 Add tests for fanout below limit, exactly at limit, above limit, and failed continuation retry.

## 9. History Ingestion

- [x] 9.1 Implement `history.outbox.ingest` handler that reads `HistoryOutbox` from main DB by outbox id.
- [x] 9.2 Reuse or extract history insertion logic from the existing `HistoryOutboxConsumer` without requiring the history service poller.
- [x] 9.3 Mark outbox rows processing/processed/failed with attempt and error metadata in a concurrency-safe way.
- [x] 9.4 Preserve exact `HistoryOutbox.payload` semantics and avoid reconstructing history from current main DB state.
- [x] 9.5 Ensure duplicate ingest attempts are idempotent through `(unitId, sequence)` / structure event uniqueness and outbox state checks.
- [x] 9.6 Add tests for successful editorial revision ingest, structure event ingest, transient failure retry, duplicate command delivery, and missing outbox id.

## 10. History Service Cutover

- [x] 10.1 Add a history env flag that disables the existing outbox poller by default after queue cutover.
- [x] 10.2 Keep an explicit temporary fallback flag for the existing poller during migration.
- [x] 10.3 Update `package/history/src/index.ts` so default service startup serves APIs without polling when queue ingestion is enabled.
- [x] 10.4 Update docs to warn operators not to run the history poller and job-runner history worker as concurrent default owners.
- [x] 10.5 Add startup tests or targeted unit tests for poller enabled/disabled behavior.

## 11. Server Producer Migration

- [x] 11.1 Add server env for `JOB_RUNNER_BASE_URL` and job-runner internal secret without adding `JOB_DATABASE_URL`.
- [x] 11.2 Add a server-side job enqueue boundary that uses the `@rezics/job` HTTP client.
- [x] 11.3 Migrate `unit-alias-record` runtime Meili side effects to enqueue content/entity/realm alias jobs.
- [x] 11.4 Migrate tag and tag-vote runtime Meili side effects to enqueue content tag jobs.
- [x] 11.5 Migrate unit translation runtime Meili side effects to enqueue content translation, realm translation, and posts-target jobs.
- [x] 11.6 Migrate unit/book/content metadata runtime Meili side effects to enqueue content sync or metadata jobs.
- [x] 11.7 Migrate post runtime Meili side effects to enqueue post sync/delete/field patch and content sync jobs.
- [x] 11.8 Migrate realm runtime Meili side effects to enqueue realm sync/metadata/member count and content realm jobs.
- [x] 11.9 Migrate shelf runtime Meili side effects to enqueue contained-unit content jobs.
- [x] 11.10 Migrate credit, subject, and batch attribution runtime Meili side effects to enqueue content credit/subject jobs.
- [x] 11.11 Migrate entity runtime Meili side effects to enqueue entity sync/delete jobs.
- [x] 11.12 Migrate user runtime Meili side effects to enqueue user sync/delete/field patch and posts-author fanout jobs.
- [x] 11.13 Migrate feedback runtime Meili side effects to enqueue feedback sync/resolution/delete jobs.
- [x] 11.14 Migrate progress runtime Meili side effects to enqueue progress sync/remove jobs.
- [x] 11.15 Leave search read APIs and explicit root/admin sync endpoints working during migration.
- [x] 11.16 Add tests for representative migrated server services proving they enqueue expected commands and do not call Meili wrappers directly.

## 12. Runtime Callsite Audit

- [x] 12.1 Use `rg` to inventory all `sync*ToMeili`, `patch*ToMeili`, and `delete*FromMeili` runtime callsites in `package/server`.
- [x] 12.2 Classify every callsite as runtime mutation, admin explicit sync, search read support, seed/factory/local script, or test mock.
- [x] 12.3 Migrate all runtime mutation callsites and record any intentional exceptions in code comments or docs.
- [x] 12.4 Add a convention check or targeted script that fails on new runtime server Meili side-effect imports outside approved locations.
- [x] 12.5 Run the audit after migration and update tasks or docs with the final exception list.

## 13. Seed, Factory, and Local Script Boundary

- [x] 13.1 Verify existing seed/factory Meili sync paths continue to call `@rezics/search` directly.
- [x] 13.2 Ensure seed/factory flows do not require `JOB_RUNNER_BASE_URL`, `JOB_DATABASE_URL`, or Sequin env.
- [x] 13.3 Update seed/factory docs to state that setup sync is direct and runtime sync is queued.
- [x] 13.4 Add a targeted test or smoke script showing factory targeted sync works with job-runner env absent.

## 14. Maintenance Jobs

- [x] 14.1 Implement `maintenance.search.driftRepair` for explicit content, post, realm, entity, user, feedback, and progress targets.
- [x] 14.2 Implement `maintenance.search.rebuildIndex` for each Meilisearch index currently managed by the server.
- [x] 14.3 Support batch/cursor rebuild execution and continuation re-enqueue for large indexes.
- [x] 14.4 Decide and implement rebuild mode for v1: direct delete+sync or temporary index + swap per index.
- [x] 14.5 Implement replay by source metadata or logical target that enqueues current-state jobs rather than applying archived CDC payloads.
- [x] 14.6 Add tests for rebuild command validation, rebuild batching, drift repair, and replay command behavior.

## 15. Admin and Observability

- [x] 15.1 Implement queue counts by lane and state.
- [x] 15.2 Implement failed job list and single failed job inspection.
- [x] 15.3 Implement retry failed job(s) operation.
- [x] 15.4 Implement discard/cancel failed job(s) operation.
- [x] 15.5 Include command kind, lane, idempotency key, tags, source metadata, attempt count, last error, timestamps, and Meili task metadata in admin output.
- [x] 15.6 Add auth checks for all admin endpoints using internal secret or root authority as appropriate.
- [x] 15.7 Add endpoint tests for counts, inspect, retry, discard/cancel, and unauthorized access.

## 16. Development Orchestration and Deployment Docs

- [x] 16.1 Add `bun --filter=@rezics/job-runner run dev` and build scripts.
- [x] 16.2 Update root dev orchestration so job-runner can be started in local development when needed.
- [x] 16.3 Add `.env.example` values for job-runner and server producer env.
- [x] 16.4 Document local Sequin/Postgres logical replication setup and no-CDC fallback expectations.
- [x] 16.5 Document production deployment roles, health checks, queue database backup expectations, and operational runbooks.
- [x] 16.6 Update `docs/guide/content-authority-history.md` with queued history ingestion behavior.

## 17. Backward Compatibility and Rollout

- [x] 17.1 Introduce feature flags or env switches needed for staged server producer migration.
- [x] 17.2 Support temporary dual path only where required during migration and remove it from final runtime defaults.
- [ ] 17.3 Run queued search handlers in shadow or targeted mode for low-risk domains before broad cutover.
- [ ] 17.4 Cut over history ingestion after verifying `history.outbox.ingest` jobs process existing pending rows.
- [ ] 17.5 Run targeted drift repair or rebuild jobs after major cutover steps.
- [x] 17.6 Document rollback steps for server producers, history poller fallback, and search drift repair.

## 18. Tests and Validation

- [x] 18.1 Run targeted tests for `package/job`.
- [x] 18.2 Run targeted tests for `package/job-runner`.
- [x] 18.3 Run affected `package/server` service tests after producer migration.
- [x] 18.4 Run affected `package/history` tests after poller cutover changes.
- [x] 18.5 Run affected `package/search` tests after handler or helper changes.
- [x] 18.6 Run `bun run check:convention`.
- [x] 18.7 Run `bun run format:check` or format changed files with Biome.
- [ ] 18.8 Run TypeScript/build checks for `@rezics/job`, `@rezics/job-runner`, `@rezics/server`, `@rezics/history`, and `@rezics/search`.
- [x] 18.9 Run `openspec validate introduce-job-runner-sync-infrastructure --strict`.
- [ ] 18.10 Manually verify local job-runner health, enqueue API, Sequin webhook auth failure, one search job, and one history ingest job in a local environment.
