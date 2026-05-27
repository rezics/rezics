## 1. Ranking Service Scaffold

- [ ] 1.1 Create `package/ranking` workspace package with Bun/TypeScript ESM config, Elysia entrypoint, health endpoint, env validation, and package scripts.
- [ ] 1.2 Add `package/ranking/prisma/schema.prisma`, Prisma client output, migration setup, and `RANKING_DATABASE_URL` env documentation.
- [ ] 1.3 Add ranking database models for Unit rank projections, signal buckets, formula version metadata, and serving patch status.
- [ ] 1.4 Wire `@rezics/ranking` into root workspace/dev orchestration without changing existing server/auth/reaction startup behavior.

## 2. Job Contract and Queue Routing

- [ ] 2.1 Add ranking lane constants and `ranking.invalidate`, `ranking.recompute`, `ranking.patchServing`, `ranking.fullSync`, and `ranking.viewBucketFlush` command schemas to `package/job`.
- [ ] 2.2 Add stable ranking idempotency key helpers in `package/job/src/idempotency.ts`.
- [ ] 2.3 Extend job-runner queue creation/policy code to create and process the ranking lane.
- [ ] 2.4 Add job-runner CDC routing from main DB ranking-relevant tables (`Unit`, `Post`, `ScoreEntry`, `ScoreAggregate`, `UserUnitProgress`, `UnitRealm`) to ranking commands.
- [ ] 2.5 Extend Sequin config and parser/routing tests for a reaction database source that watches `ReactionSummary`.
- [ ] 2.6 Route `ReactionSummary` insert/update/delete messages to `ranking.invalidate` by `targetId`.

## 3. Ranking Computation

- [ ] 3.1 Implement ranking command handlers in `package/ranking` for invalidation, recompute, patch-serving, full-sync segments, and view-bucket flush.
- [ ] 3.2 Implement current-state readers for main DB signals needed by v1 formulas: Unit eligibility, Post reply metadata, Score aggregates, progress aggregates, and realm membership.
- [ ] 3.3 Add a reaction-service summary client for ranking recompute, including batch summary fetch and failure handling.
- [ ] 3.4 Implement versioned v1 formulas for content, post, and comment rank kinds with numeric hot/top/trending/quality outputs.
- [ ] 3.5 Implement sibling-scoped comment ranking using parent/root scope data without flattening whole comment trees.
- [ ] 3.6 Implement bucketed view/read signal ingestion structures without per-event Meili patching.

## 4. Meilisearch Projection Updates

- [ ] 4.1 Add ranking fields to `package/contract` content and post Meili document schemas.
- [ ] 4.2 Add ranking sort options to content and post search option schemas while preserving existing relevance and temporal sorts.
- [ ] 4.3 Add ranking fields and sortable attributes to `package/search/src/schema.ts` for `content` and `posts`.
- [ ] 4.4 Update `buildContentDocument` and `buildPostDocument` to emit default numeric ranking fields.
- [ ] 4.5 Add `package/search` partial patch helpers for content ranking fields, post ranking fields, and comment ranking fields.
- [ ] 4.6 Wire ranking service patch-serving handlers to update Meili documents from stored rank projections.

## 5. APIs and Operations

- [ ] 5.1 Add ranking health/readiness endpoints.
- [ ] 5.2 Add internal/admin endpoint or command path to inspect projections by `unitId`.
- [ ] 5.3 Add internal/admin endpoint or command path to recompute one Unit.
- [ ] 5.4 Add bounded full-sync/repair command flow with cursor continuation.
- [ ] 5.5 Add operational logging for ranking source metadata, formula version, Meili patch result, and retryable failures.

## 6. Tests and Verification

- [ ] 6.1 Add unit tests for ranking formula outputs and default numeric score behavior.
- [ ] 6.2 Add job command schema and idempotency tests for `ranking.*` commands.
- [ ] 6.3 Add job-runner routing tests for main DB ranking invalidations and reaction DB `ReactionSummary` invalidations.
- [ ] 6.4 Add search schema/document-builder tests for new ranking fields and sortable attributes.
- [ ] 6.5 Add ranking handler tests for recompute, projection upsert, and Meili patch payloads.
- [ ] 6.6 Run targeted package tests for `package/job`, `package/job-runner`, `package/search`, `package/contract`, and `package/ranking`.
- [ ] 6.7 Run repo convention checks and TypeScript/build checks affected by new workspace exports.

## 7. Migration and Rollout

- [ ] 7.1 Add ranking database migration instructions and local `.env.example` entries.
- [ ] 7.2 Add Meili settings migration/backfill steps for new sortable ranking fields.
- [ ] 7.3 Add ranking full-sync/backfill command documentation.
- [ ] 7.4 Verify existing list queries continue to work without ranking fields populated.
- [ ] 7.5 Document rollback: disable ranking CDC routing and stop using ranking sorts while leaving additive fields in place.
