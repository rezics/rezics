## Context

The Meilisearch `posts` index today supports filtering by `targetUnitId`, `realmIds`, `authorUserId`, `rootPostUnitId`, `parentPostUnitId`, `kind`, `depth`, `isLocked` (settings at `package/search/src/client.ts:92-108`). The post tree is modeled in Postgres via `parentPostUnitId`, `rootPostUnitId`, `depth`, `sortPath` on the `Post` model (`package/server/prisma/schema.prisma:385-426`), and the existing creation flow at `package/server/src/post/post.service.ts:186-360` already enforces:

- Top-level post: `rootPostUnitId = own unitId` (set via post-insert update at `:323-329`).
- Reply: `rootPostUnitId = parent.rootPostUnitId ?? parent.unitId`, `depth = parent.depth + 1` (`:240-241`).
- `Post.update` (`:363-388`) only mutates `body`, `isLocked`, `extra` — `targetUnitId` is immutable post-creation.

Plan documents informing this design:

- `openspec/plans/search-scope-indexing-plan.md` §3.2 prescribed Book-scoped post search as `posts.targetUnitId = bookId`. That assumption breaks for reply trees, since a reply's `targetUnitId` typically points to its parent post.
- `openspec/plans/unit-scope-search-indexing-plan.md` proposed a full ancestor closure (`scopeUnitIds: string[]`). Rejected for product/operational reasons; this design supersedes it.

Industry precedent for the chosen pattern:

- Slack denormalizes `channel_id` onto every message regardless of thread depth.
- Reddit denormalizes `subreddit` onto every comment regardless of depth.
- Elasticsearch official docs recommend denormalized redundant fields over parent-child join for scoped filters.
- Confluence's CQL `ancestor=<pageId>` is the closest public analog.

## Goals / Non-Goals

**Goals:**

- Make Book/Game/Media-scoped post search return the full reply tree (not just root posts) via a single Meilisearch equality filter.
- Avoid query-time fan-out of root post id lists (which would scale unboundedly with popular Books).
- Keep the change minimal and additive: new nullable columns, new optional filterable attributes, no removal of existing fields, no breaking changes.
- Preserve constant-time post creation (no extra DB roundtrip on reply create).

**Non-Goals:**

- Middle-subtree search ("search within Comment C1") — not a product requirement; would require a closure model and is rejected.
- Shelves containing the Book in scope — handled by future `search-index-content-relations` change adding `containedUnitIds` to the content index.
- Realm index `targetUnitId` filterable attribute.
- Federated cross-index orchestration that merges posts + content + realm + user results — future `federated-search-results` change.
- Admin "retarget root post" / subtree move flows — these flows do not exist in the API today; when introduced they will need an outbox-driven cascade and belong to that future change.
- Automatic cascade on Book deletion (`onDelete: SetNull` leaves descendants stale until next manual resync).

## Decisions

### Decision 1: Two scalar fields, not an array closure

**Choice:** Denormalize `rootTargetUnitId` (uuid) and `rootTargetUnitType` (string) as scalar fields on every post — both in the Prisma model and the Meilisearch document.

**Why:** A scalar equality filter (`rootTargetUnitId = X`) has the same shape and cost as the existing `realmIds = X` filter. There is no array length, no closure write-amplification on subtree moves, no Meilisearch filterable-array gotchas. A popular Book is a single value, regardless of how many root posts target it.

**Alternatives considered:**

- **Full ancestor closure (`scopeUnitIds: string[]`)** — rejected. Would solve middle-subtree search (not a requirement) at the cost of `O(subtree × ancestor_depth)` write amplification on subtree moves and an unbounded array length per document. No public engineering writeup of this pattern at scale because most platforms (Slack, Reddit, SO, HN) simply don't permit subtree moves.
- **Query-time root expansion** (`SELECT root posts targeting B; rootPostUnitId IN [...]`) — rejected. The in-list scales with the number of root posts, which is unbounded for popular Books; pagination/relevance break.
- **Per-level fields (`lvl0/lvl1/lvl2`, the Algolia/Meilisearch official hierarchical-facet pattern)** — rejected. Designed for fixed-depth category trees, not unbounded comment trees.
- **Postgres `ltree`** — considered for the canonical store. Useful for descendant queries, but doesn't replace the search-side need for a denormalized scalar filter, and adds extension/migration complexity. Deferred unless future canonical-side requirements warrant it.

### Decision 2: Derive at create time only; no admin retarget path

**Choice:** Both fields are computed at `PostService.create` and never recomputed by `Post.update` (which can't change `targetUnitId` anyway). No outbox, no async repair worker.

**Why:** The current `update` API (`package/server/src/post/post.service.ts:363-388`) only allows mutating `body`, `isLocked`, `extra`. There is no human-triggerable code path that retargets a root post or moves a subtree. Therefore the write-amplification scenario simply does not occur in the current product. Adding async infrastructure now would be premature.

**Alternatives considered:**

- **Outbox + worker** — overkill for a flow that doesn't exist. When a future `admin-post-retarget` or subtree move feature lands, that change will own the outbox cascade.
- **Database triggers** to auto-propagate parent target changes — also unnecessary while the API doesn't expose retarget.

### Decision 3: Reply derivation reads parent only (no extra roundtrip)

**Choice:** When creating a reply, both new fields are read from the parent post's pre-existing fields. The existing `parent` select at `package/server/src/post/post.service.ts:225-234` is widened to include `rootTargetUnitId` and `rootTargetUnitType`. No new DB query is added.

**Why:** Constant-time post creation is preserved. The recursion base case is clean: a top-level post derives from its own input.targetUnitId; replies inherit from parent. The recursive invariant — "every post's `rootTargetUnitId` equals its rootPost's `targetUnitId`" — is maintained without ever traversing more than one hop.

### Decision 4: Top-level `rootTargetUnitType` requires a Unit lookup

**Choice:** When a top-level post is created with `targetUnitId != null`, fetch the target Unit's `type` in the same transaction (one extra `prisma.unit.findUnique` for top-level only). When `targetUnitId == null`, both fields are null.

**Why:** Without this lookup, the type field on top-level creates would be unknown until next sync. The lookup is one indexed primary-key read, runs only on top-level creation (a small fraction of posts), and yields a clean immutable value. Replies inherit from parent and need no Unit lookup.

**Alternative considered:** Defer type derivation to sync time. Rejected — would require `buildPostDocument` to do an additional join on the target Unit for every post; we already do that join for `targetType` on the post's own `targetUnit`, but the *root* target's type is a different join (via `rootPostUnitId → Post.targetUnitId → Unit.type`). Storing the value at create time keeps sync straightforward and lets the field be queryable from Postgres too.

### Decision 5: Backfill via SQL, partial resync via existing pattern

**Choice:** A one-shot, idempotent SQL script computes both fields from `Post P JOIN Post R ON P.rootPostUnitId = R.unitId LEFT JOIN Unit U ON R.targetUnitId = U.id`, updating `P.rootTargetUnitId` and `P.rootTargetUnitType`. After the SQL backfill, a Meilisearch partial resync (mirroring `syncAllPostRealmIds` at `package/search/src/sync.ts:771-812`) pushes the two new fields onto existing documents in batches.

**Why:** Two-stage backfill keeps the Postgres truth and Meilisearch projection synchronized without a full reindex. Idempotent SQL is rerunnable if interrupted. Meilisearch tolerates partial document updates; `addOrUpdate` semantics merge by primary key.

**Alternatives considered:**

- **Full Meilisearch reindex (`syncAllPosts`)** — wasteful; rewrites every field on every document.
- **Application-level batch loop** computing per-row — slower than SQL and more code.

### Decision 6: Top-level post with no target → both fields null

**Choice:** A top-level post with `targetUnitId = null` (e.g., free-form realm post) has `rootTargetUnitId = null` and `rootTargetUnitType = null`. It will not appear in unit-scoped search; realm-scoped and user-scoped search continue to work via the existing `realmIds` and `authorUserId` filters.

**Why:** Honest data shape. A post that is not "about" any Unit should not be findable by unit scope. Other scopes are unaffected.

## Risks / Trade-offs

[**Stale `rootTargetUnitId` on Book deletion**] → The schema's `onDelete: SetNull` on `Post.targetUnit` only nullifies the root post's `targetUnitId`; descendants' denormalized `rootTargetUnitId` becomes stale. **Mitigation:** Books are rarely deleted; a manual resync run after deletion repairs it. Documented as known eventual consistency. Future improvement: a deletion hook that walks descendants, but not in this change.

[**Future admin retarget will require write-amp handling**] → If/when an admin can change a root post's `targetUnitId`, every descendant must be updated. **Mitigation:** Out of scope for this change; the future feature owns its cascade strategy (outbox + worker).

[**`rootTargetUnitType` denormalization can drift**] → If a Unit's `type` changes (currently not supported in any flow), the cached type on descendant posts would drift. **Mitigation:** `Unit.type` is treated as immutable in the current product; same eventual-consistency story as Book deletion if that ever changes.

[**Backfill on a large `Post` table is non-trivial**] → SQL UPDATE on millions of rows can lock or bloat. **Mitigation:** The backfill script SHOULD batch by id range (e.g., 10K rows per statement) and run idempotently; pattern follows `package/server/src/script/resync-posts.ts`.

[**Filterable-attribute change requires Meilisearch settings update before query rollout**] → Querying with a filterable attribute that isn't configured returns an error. **Mitigation:** Apply phase orders the index settings update before any client uses the new filter. Settings updates in Meilisearch are async tasks; rely on existing task-progress handling already used by `initPostIndex`.

[**Order-of-operations during deploy**] → If new server code lands before backfill completes, posts created in the window will have correct values, but historical posts will be incomplete and Book-scoped search will under-return. **Mitigation:** Sequence the apply: schema migration → server code (writes new fields on creates) → SQL backfill → partial Meilisearch resync → enable filter in API. Each step is independently reversible until the API filter is enabled.

## Migration Plan

1. **Schema migration**: add `rootTargetUnitId` (uuid, nullable, FK to Unit), `rootTargetUnitType` (varchar(32), nullable), and index `(rootTargetUnitId, createdAt)`. Reversible (DROP COLUMN on rollback).
2. **Server code lands**: `PostService.create` writes both fields on new posts; `searchPosts` accepts optional filters but they are not yet exposed in any client UI.
3. **SQL backfill** (`package/server/src/script/backfill-root-target.ts`): idempotent, batched UPDATE. Verify completion with a count of NULL rows where they shouldn't be NULL.
4. **Meilisearch settings update**: add `rootTargetUnitId` and `rootTargetUnitType` to `filterableAttributes` via `initPostIndex`.
5. **Partial Meilisearch resync**: push the two new fields onto every existing document. Verify a sample of documents post-sync.
6. **Enable filter** in client UI / scoped search code paths that route through `searchPosts`.

**Rollback strategy:** Steps 4–6 are reversible by reverting the Meilisearch settings update (drop the filterable entries) and rolling back the server code. The SQL columns remain harmless if left in place; if removal is desired, a follow-up migration drops them. No data loss in any rollback path.

## Open Questions

None. All five pre-propose decisions were resolved with the user before this artifact was authored:

- Field name `rootTargetUnitId` — confirmed.
- Add `rootTargetUnitType` — confirmed.
- Top-level with no target → null — confirmed.
- Strict post-side scope (no shelves, realm, federation in this change) — confirmed.
- Cleanup of `openspec/plans/unit-scope-search-indexing-plan.md` — handled by the user outside this proposal.
