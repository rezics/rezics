## Context

Rezics uses Unit UUIDs as the common identity for books, posts, comments, shelves, realms, tags, and other content-like records. Public list and discovery surfaces are served from Meilisearch indexes (`content`, `posts`, `realms`, `progress`) rather than direct SQL result sets. Existing Meili documents support temporal sorting and reply-count sorting, but they do not carry canonical hot/top/trending/quality fields.

Reaction data is already split into `@rezics/reaction` with its own PostgreSQL database and `ReactionSummary` aggregate table. Main-server code can proxy reaction writes, but ranking cannot depend on that proxy path because reaction cleanup, repair, or future direct internal operations would bypass main-server hooks. The existing job-runner already treats CDC as invalidation and dispatches durable jobs through typed `@rezics/job` commands, which is the right integration boundary for ranking.

The target design is a new `@rezics/ranking` Elysia service with its own PostgreSQL schema. It consumes ranking commands from the queue, reads current canonical state from main/reaction sources, stores Unit-based projections, and patches Meili serving fields. Meilisearch remains the list-serving system; ranking computes the numeric fields that Meili sorts by.

## Goals / Non-Goals

**Goals:**

- Introduce `package/ranking` / `@rezics/ranking` as the owner of Unit rank projections.
- Use `unitId` as the universal target key for content, posts, comments, books, and future rankable Units.
- Support global, realm, work, tag, and parent/comment scopes without adding per-domain rank tables.
- Add durable `ranking.*` commands and a dedicated ranking queue lane.
- Route main DB CDC and reaction DB `ReactionSummary` CDC into ranking invalidations.
- Populate Meili `content` and `posts` ranking fields through partial document patches.
- Keep ranking formulas versioned and inspectable so operators can repair or recompute projections.
- Keep high-frequency view/read signals bucketed and coalesced before recomputing rank.

**Non-Goals:**

- Do not build a personalized recommendation model in this change.
- Do not replace Meilisearch as the serving layer for public list/search pages.
- Do not make `@rezics/reaction` aware of ranking formulas or Meilisearch.
- Do not add per-user ranking fields to Meili documents.
- Do not guarantee real-time per-view score updates; view/read signals are intentionally bucketed.

## Decisions

### D1. Split ranking into `@rezics/ranking`

`@rezics/ranking` owns projection tables, score formulas, Meili ranking-field patches, and ranking admin/debug APIs. This prevents ranking behavior from accumulating inside main server, reaction service, or generic search sync handlers.

Alternatives considered:
- Keep ranking inside `@rezics/job-runner`: lower deployment cost, but job-runner would become a domain service that owns formulas, projections, and Meili patch policy.
- Keep ranking inside `@rezics/server`: simple access to main DB, but it couples ranking to one canonical source and does not handle reaction-service-only changes cleanly.

### D2. Keep job-runner as queue ingress and CDC router

`@rezics/job-runner` remains the component that receives Sequin webhooks and enqueues typed jobs. `@rezics/ranking` consumes or handles ranking commands but does not own generic queue ingress. This preserves the existing queue ownership boundary while still splitting ranking domain logic.

Ranking commands belong in `@rezics/job`, for example:

- `ranking.invalidate`
- `ranking.recompute`
- `ranking.patchServing`
- `ranking.fullSync`
- `ranking.viewBucketFlush`

The ranking lane is separate from `search.sync.fast` and `search.sync.slow` because ranking can require cross-service reads and formula recomputation before Meili patching.

### D3. Use Unit-based rank projections

The canonical projection identity is `(unitId, scopeKind, scopeId, rankKind)`.

Examples:
- Global book trending: `(bookUnitId, "global", null, "content")`
- Realm post hot: `(postUnitId, "realm", realmUnitId, "post")`
- Comment sibling hot: `(commentUnitId, "parent", parentPostUnitId, "comment")`
- Work-scoped release/content ranking: `(unitId, "work", workUnitId, "content")`

Projection rows store `hotScore`, `topScore`, `trendingScore`, `qualityScore`, formula version, a signal snapshot JSON value, and timestamps. Scores are numeric and always present so Meili sort behavior stays type-consistent.

### D4. Treat CDC as invalidation, not ordered scoring input

CDC messages enqueue ranking invalidations keyed by logical targets. The ranking worker reads current state when processing a command:

- Main DB: `Unit`, `Post`, `ScoreEntry`, `ScoreAggregate`, `UserUnitProgress`, `UnitRealm`
- Reaction service: `ReactionSummary` via public or internal batch summary endpoint
- Ranking DB: view/read buckets and prior projections

This matches the existing job-runner rule that CDC should route current-state jobs rather than apply ordered payload deltas.

### D5. Use `ReactionSummary` CDC as the reaction trigger

Reaction writes update `ReactionSummary` synchronously in the reaction database. Sequin should watch reaction DB `ReactionSummary` insert/update/delete and enqueue `ranking.invalidate` for `targetId`. This avoids per-reaction fanout and keeps the reaction service independent from ranking.

### D6. Patch Meili, but keep ranking state in Postgres

Meili is the serving projection, not the source of truth. Ranking stores computed state in ranking Postgres first, then patches Meili documents with the relevant rank fields. This enables repair, debugging, formula migration, and replay after Meili drift.

### D7. Keep comment hot as sibling ranking

Threaded comments must preserve tree shape. Comment hot ranking applies only to sibling sets under the same parent/root scope. The `posts` index receives comment rank fields, and comment list queries filter by `parentPostUnitId` or root/depth before sorting by comment-specific rank fields.

### D8. Bucket high-frequency view/read signals

The first ranking service may support view/read buckets, but it must not patch Meili per view. View/read events are aggregated into time buckets and flushed through coalesced ranking commands. This keeps Meili update pressure bounded and leaves room for later analytics or recommendation use.

## Risks / Trade-offs

- Cross-service reads can fail during recompute -> Ranking commands SHALL be retryable and idempotent; failed commands remain inspectable in queue/admin tooling.
- Reaction DB CDC adds another Sequin source -> Configure it explicitly and keep `ReactionSummary` as the only required v1 reaction table.
- Meili ranking fields may be temporarily stale -> Ranking projections are eventually consistent; list pages continue to work with previous values and temporal tie-breakers.
- Ranking formulas may need tuning -> Store `formulaVersion` and `signalSnapshot`; provide full recompute and patch-serving commands.
- Hot content can create frequent invalidations -> Use stable idempotency keys and coalescing by `(unitId, scope/rank target)`; bucket high-frequency signals.
- Comment ancestor updates can create fanout -> V1 SHALL update direct parent/sibling rank and may defer deep descendant aggregation to repair/batch jobs.

## Migration Plan

1. Add `package/ranking` with Elysia health endpoints, env validation, Prisma schema, and initial migrations.
2. Add ranking command schemas and lane constants in `@rezics/job`.
3. Add job-runner routing for main DB tables that affect ranking.
4. Add Sequin reaction DB source and route `ReactionSummary` changes to ranking invalidations.
5. Add rank projection computation and Meili patch helpers.
6. Add rank fields to `content` and `posts` contracts, builders, sortable attributes, and search sort options.
7. Run Meili settings migration and ranking full sync/backfill.
8. Enable ranked list sorts behind additive API options.

Rollback strategy:
- Disable ranking command routing.
- Keep additive Meili fields present but stop sorting by them.
- Retain projection tables for inspection; no existing query requires them.

## Open Questions

- Should `@rezics/ranking` consume pg-boss directly, or should job-runner dispatch ranking commands to ranking internal HTTP handlers in v1?
- Which exact rank kinds should ship first: `content`, `post`, and `comment`, or only `content` and `post`?
- Should view events be part of the first implementation or left as a schema/command placeholder?
