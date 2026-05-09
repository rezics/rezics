## Why

Book/Game/Media-scoped post search is broken for reply trees. The Meilisearch post index supports `targetUnitId = bookId`, but that filter only matches root-level posts (REVIEW / EXCERPT / REMARK / CHAPTER) whose `targetUnitId` directly equals the Book id. Their reply trees (comments, nested replies) are missed because a reply's `targetUnitId` typically points to its parent post, not the Book.

A query-time workaround (`SELECT root posts targeting B; rootPostUnitId IN [...]`) is unworkable: a popular Book has thousands of root posts, the in-list grows unbounded, and pagination/relevance fall apart. The safe answer is index-time denormalization with a single scalar field on every post — the same pattern Slack and Reddit use (`channel_id` / `subreddit` denormalized onto every message regardless of thread depth) and that Elasticsearch's official guidance recommends over parent-child join.

This change patches the §3.2 assumption in `openspec/plans/search-scope-indexing-plan.md` (which conflated `targetUnitId = bookId` with full Book-scope coverage) and supersedes the rejected closure-array design in `openspec/plans/unit-scope-search-indexing-plan.md`. A full ancestor closure (`scopeUnitIds`) was rejected because (a) middle-subtree search is not a product requirement, and (b) closure write-amplification on subtree moves is unbounded and difficult to amortize.

## What Changes

- Add two denormalized scalar fields to `Post`: `rootTargetUnitId: string | null` (the `targetUnitId` of this post's root post) and `rootTargetUnitType: string | null` (the `Unit.type` of that root target — e.g. `BOOK`, `GAME`, `MEDIA`).
- Derive both at post creation only:
  - **Top-level post** (no parent): `rootTargetUnitId = input.targetUnitId ?? null`; `rootTargetUnitType` resolved from the target Unit's `type` (null when no target).
  - **Reply** (has parent): both fields inherited from parent — no extra DB roundtrip; the existing parent fetch in `PostService.create` is widened to include them.
- Project both fields onto every Meilisearch post document and add them to `filterableAttributes` on the `posts` index.
- Extend `searchPosts` and the `PostSearchOptions` contract to accept `rootTargetUnitId` and `rootTargetUnitType` as filters.
- One-shot SQL backfill for existing Posts (derive via `rootPostUnitId → Post.targetUnitId → Unit.type`); idempotent.
- Partial Meilisearch resync entry that pushes only the two new fields onto existing documents (mirrors the existing `syncAllPostRealmIds` pattern).

PostKind clarification (informational, not requirement-altering): `REVIEW`, `EXCERPT`, `REMARK`, and `CHAPTER` are top-level posts that target a Book/Game/Media unit. `REMARK` is a top-level kind, not a reply kind — it behaves the same as `REVIEW` for derivation. `POST` is generic; replies of any kind always inherit from parent. The derivation rule does not branch on `PostKind`.

Out of scope (deferred to other changes):

- Shelves containing the Book in the content index (future `search-index-content-relations`).
- Realm index `targetUnitId` filterable attribute.
- Federated cross-index search orchestration (future `federated-search-results`).
- Admin "retarget root post" / subtree move flows — these do not exist in `PostService.update` today; when introduced they will need an outbox-driven cascade and belong to that future change.
- Cascade on Book deletion — `onDelete: SetNull` leaves descendant `rootTargetUnitId` stale until next manual resync. Books are rarely deleted; documented as known eventual consistency.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `post-search-index`: post documents gain `rootTargetUnitId` and `rootTargetUnitType` fields; the `posts` index gains both as filterable attributes; the search options surface gains filters for both.
- `type-extension-post`: the Post type extension gains two denormalized derivation fields with explicit create-time rules and immutability through `Post.update`.

## Impact

- **Affected packages**:
  - `package/server` — Prisma schema migration, `PostService.create` parent-fetch and derivation, `searchPosts` filter wiring, backfill script.
  - `package/search` — `buildPostDocument` projection, `initPostIndex` filterable settings, partial resync helper.
  - `package/contract` — `PostSearchDocumentSchema` and `PostSearchOptionsSchema` field additions.
- **Database**: one Postgres migration adding `Post.rootTargetUnitId` (`uuid`, nullable), `Post.rootTargetUnitType` (`varchar(32)`, nullable), and an index on `(rootTargetUnitId, createdAt)`.
- **Search index**: filterable-attributes update is forward-compatible with existing documents (Meilisearch tolerates missing fields). A targeted backfill + partial resync brings the existing corpus current; no full reindex required.
- **Backward compatibility**: additive only. Existing filters (`targetUnitId`, `rootPostUnitId`, etc.) keep working unchanged. New fields are nullable and absent values are tolerated. No breaking changes to API consumers.
- **Migration**: backfill script must run before relying on the new filter; document order in the apply phase.
- **Eventual consistency**: when a target Unit is deleted (`onDelete: SetNull` on `targetUnitId`), descendant posts' `rootTargetUnitId` becomes stale until the next manual resync. Out of scope for automatic handling in this change.
