# realm-feed-query Specification

## Purpose

Defines the realm-scoped post feed query path. The `byRealm(realmUnitId)` query lists posts that belong to a realm via the `RealmUnit` junction (never via a column on `Post`), and supports sort modes (new/top/hot), tag filtering (via `RealmTagUnit` with fallback to `UnitTag`), and cursor-based pagination. This capability replaces the previous reuse of `byTarget(realmUnitId)` for realm feeds; `byTarget` reverts to its strict semantic of "posts that reply to or directly target this unit".

## Requirements

### Requirement: byRealm query lists posts via RealmUnit junction

The system SHALL expose a query path `byRealm(realmUnitId)` that returns all posts associated with the given realm. The query SHALL be served by `GET /post/list?realmUnitId={id}` on the server and by `postQueries.byRealm(realmUnitId, opts)` on the frontend (in `@rezics/api`). The query SHALL filter posts by joining through the `RealmUnit` junction (i.e., `Post WHERE Post.unitId IN (SELECT unitId FROM RealmUnit WHERE realmUnitId = ?)`), NOT by reading any column on `Post`.

The previously-existing reuse of `byTarget(realmUnitId)` for realm-feed purposes SHALL be removed. After this change, `byTarget(unitId)` SHALL strictly mean "posts that reply to or directly target this unit" (book-discussion threads, post-reply trees) and SHALL NOT be used to enumerate realm content.

#### Scenario: byRealm returns posts in a realm

- **GIVEN** `RealmUnit` rows `(realm-1, post-A)`, `(realm-1, post-B)`, `(realm-2, post-C)`
- **WHEN** a client calls `byRealm("realm-1")`
- **THEN** the response SHALL contain posts A and B
- **AND** SHALL NOT contain post C

#### Scenario: byTarget no longer returns realm content

- **GIVEN** `RealmUnit` row `(realm-1, post-A)` and post A has no `targetUnitId` set
- **WHEN** a client calls `byTarget("realm-1")`
- **THEN** post A SHALL NOT appear in the response (because `Post.targetUnitId` is not "realm-1")
- **AND** the client SHALL use `byRealm("realm-1")` instead

#### Scenario: Cross-posted post appears in each realm's byRealm result

- **GIVEN** `RealmUnit` rows `(realm-A, post-X)` and `(realm-B, post-X)`
- **WHEN** a client calls `byRealm("realm-A")`
- **THEN** the response SHALL include post-X
- **AND** when calling `byRealm("realm-B")`, the response SHALL also include post-X

### Requirement: byRealm supports new/top/hot sort modes

The `byRealm` query SHALL accept an optional `sort` parameter with three values:

- `"new"` — posts ordered by `createdAt DESC`. This is the default when `sort` is omitted.
- `"top"` — posts ordered by their score DESC, where score is sourced from the `ScoreEntry` linked to the post (via `Post.scoreEntryId`) if present, else `0`. Ties broken by `createdAt DESC`.
- `"hot"` — posts ordered by a time-decayed score. Phase-1 implementation MAY use the simplified rule: posts within the last 7 days, ordered by score DESC then `createdAt DESC`. The full Reddit-style decay formula (`score / (age_in_hours + 2)^1.5`) is a follow-up enhancement and is not required for the initial release.

The sort SHALL be applied at the database level (or via Meilisearch if the index path is taken — see post-search-index spec) so that pagination is correct.

#### Scenario: New sort orders by createdAt descending

- **GIVEN** posts in realm-1: post-A (created 10:00), post-B (created 12:00), post-C (created 11:00)
- **WHEN** a client calls `byRealm("realm-1", { sort: "new" })`
- **THEN** the response SHALL return posts in order: post-B, post-C, post-A

#### Scenario: Top sort orders by score descending

- **GIVEN** posts in realm-1 with scores: post-A (score 5), post-B (score 12), post-C (score 8)
- **WHEN** a client calls `byRealm("realm-1", { sort: "top" })`
- **THEN** the response SHALL return posts in order: post-B, post-C, post-A

#### Scenario: Posts without ScoreEntry rank as score 0

- **GIVEN** posts in realm-1: post-A with no ScoreEntry, post-B with score 3
- **WHEN** a client calls `byRealm("realm-1", { sort: "top" })`
- **THEN** post-B SHALL rank above post-A
- **AND** post-A SHALL be treated as having score 0

#### Scenario: Hot sort phase-1 approximation

- **GIVEN** posts in realm-1: post-A (created 10 days ago, score 50), post-B (created 1 day ago, score 5), post-C (created 3 days ago, score 30)
- **WHEN** a client calls `byRealm("realm-1", { sort: "hot" })` and the implementation uses the phase-1 7-day window
- **THEN** post-A SHALL be excluded (older than 7 days)
- **AND** the response SHALL contain post-C, then post-B (ordered by score DESC within window)

### Requirement: byRealm supports tag filter via RealmTagUnit / UnitTag

The `byRealm` query SHALL accept an optional `tagIds: string[]` parameter. When non-empty, the result SHALL be restricted to posts that satisfy at least one of the supplied tag ids (OR semantics). Tag matching SHALL prefer `RealmTagUnit(realmUnitId, unitId, tagUnitId)` rows for the realm in question; if no `RealmTagUnit` row matches, the fallback SHALL be `UnitTag(unitId, tagUnitId)` rows.

#### Scenario: Filter realm posts by single tag

- **GIVEN** in realm-1: `RealmTagUnit(realm-1, post-A, tag-action)`, `RealmTagUnit(realm-1, post-B, tag-romance)`
- **WHEN** a client calls `byRealm("realm-1", { tagIds: ["tag-action"] })`
- **THEN** the response SHALL contain post-A
- **AND** SHALL NOT contain post-B

#### Scenario: Filter realm posts by multiple tags uses OR

- **GIVEN** in realm-1: `RealmTagUnit(realm-1, post-A, tag-action)`, `RealmTagUnit(realm-1, post-B, tag-romance)`, `RealmTagUnit(realm-1, post-C, tag-comedy)`
- **WHEN** a client calls `byRealm("realm-1", { tagIds: ["tag-action", "tag-romance"] })`
- **THEN** the response SHALL contain post-A and post-B
- **AND** SHALL NOT contain post-C

#### Scenario: Falls back to UnitTag when no RealmTagUnit row matches

- **GIVEN** in realm-1: post-A with no `RealmTagUnit` rows for `tag-action` but a `UnitTag(post-A, tag-action)` row exists
- **WHEN** a client calls `byRealm("realm-1", { tagIds: ["tag-action"] })`
- **THEN** the response SHALL include post-A

### Requirement: byRealm composes sort, tag filter, and pagination

The query SHALL accept `sort`, `tagIds`, `limit`, and `cursor` parameters in any combination. Pagination SHALL be cursor-based using the chosen sort field. Filters and sorts SHALL compose correctly such that pagination across pages does not skip or duplicate posts.

#### Scenario: Pagination with new sort

- **GIVEN** 25 posts in realm-1 ordered by `createdAt DESC`
- **WHEN** a client calls `byRealm("realm-1", { sort: "new", limit: 10 })` then continues with the returned cursor
- **THEN** the first page SHALL contain the 10 most recent posts
- **AND** the second page (using cursor) SHALL contain posts 11–20
- **AND** no post SHALL appear on both pages

#### Scenario: Sort and tag filter combine

- **GIVEN** 5 posts in realm-1 tagged `tag-action`, ordered by score 12, 8, 6, 3, 1 respectively
- **WHEN** a client calls `byRealm("realm-1", { sort: "top", tagIds: ["tag-action"], limit: 3 })`
- **THEN** the response SHALL return the three highest-scored tagged posts
- **AND** in score-descending order
