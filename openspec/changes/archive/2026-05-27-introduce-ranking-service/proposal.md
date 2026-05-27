## Why

Rezics list and discovery surfaces are served from Meilisearch, but there is no canonical ranking infrastructure that can turn reactions, comments, scores, progress, and future view signals into sortable fields on those indexes. This blocks durable hot/trending/top ordering for books, posts, realm feeds, and threaded comments, and it becomes more urgent now that reactions already live in a separate service whose data changes must reach ranking through CDC and the queue rather than main-server coupling.

## What Changes

- Add a new `@rezics/ranking` package as an Elysia + PostgreSQL service that owns Unit-based rank projections keyed by `unitId`, scope, and rank kind.
- Add ranking job commands in `@rezics/job` and a dedicated ranking queue lane so CDC and runtime producers can enqueue `ranking.*` invalidations without importing ranking runtime code.
- Extend the job-runner CDC routing model so main-database changes and reaction-database `ReactionSummary` changes enqueue ranking invalidations.
- Add ranking projection tables for hot/top/trending/quality scores, formula versioning, signal snapshots, and repair/debug metadata.
- Patch Meilisearch `content` and `posts` documents with precomputed ranking fields so list queries can use Meili `filter + sort` for hot/trending/top ordering.
- Support comment hot ranking as sibling-level ranking on `posts`, not whole-tree flattening.
- Define a future-safe signal path for high-frequency view/read signals through bucketed aggregation instead of one Meili patch per view.
- Preserve backward compatibility for existing list queries: current `createdAt`, `updatedAt`, `publishedAt`, and `replyCount` sorts remain available; new ranking sorts are additive.

## Capabilities

### New Capabilities

- `unit-ranking`: Unit-based ranking service, ranking commands, projection ownership, score formulas, CDC invalidation, repair, and Meili patch responsibilities.

### Modified Capabilities

- `job-runner-sync-infrastructure`: Add ranking lanes/commands and route CDC invalidations from main DB and reaction DB sources.
- `content-index`: Add content ranking fields to Meilisearch content documents and sortable attributes.
- `post-search-index`: Add post/comment ranking fields to Meilisearch post documents and sortable attributes.
- `reaction-summary`: Define `ReactionSummary` changes as ranking invalidation inputs without embedding summaries in main-server list responses.

## Impact

- Affected packages:
  - `package/ranking`: new Elysia service, Prisma schema, worker/runtime, ranking formulas, admin/debug endpoints.
  - `package/job`: new ranking command schemas, lane constants, and idempotency helpers.
  - `package/job-runner`: CDC routing for ranking invalidations, including a second Sequin database source for the reaction DB.
  - `package/reaction`: no ranking formula knowledge; may need publication/CDC configuration for `ReactionSummary`.
  - `package/search`: Meili schema updates, document builders, and partial patch helpers for ranking fields.
  - `package/contract`: content/post Meili document schemas and search sort option schemas.
  - `package/server`: minimal integration only where explicit runtime invalidation is still needed; canonical changes should prefer CDC.
- External systems:
  - PostgreSQL: new ranking database and migrations.
  - Meilisearch: `content` and `posts` indexes gain sortable ranking fields.
  - Sequin: add reaction database source/publication for `ReactionSummary`; existing main database source routes additional ranking-relevant tables.
  - pg-boss/job-runner: add ranking lane and durable ranking command delivery.
- Migration and compatibility:
  - Existing Meili indexes require settings updates and a backfill/full ranking sync to populate ranking fields.
  - Existing clients continue to work because ranking fields and sorts are additive.
  - Ranking fields default to stable numeric values so Meili sorting remains type-consistent even before all signals are populated.
