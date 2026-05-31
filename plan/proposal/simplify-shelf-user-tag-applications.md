---
title: Simplify Shelf With User Tag Applications
status: active
created: 2026-05-31
completed:
supersededBy:
tags: [shelf, catalog, tag, user, search, privacy]
---

## Why

Shelf should stay the collection mechanism: it owns containment, ordering,
visibility, and publication of a user's collected units. It should not own
per-shelf item tagging. The useful product behavior is that a user tags a Unit
once and sees that tag consistently across every shelf containing that Unit,
similar to how a realm tags a Unit through `RealmTagApplication`, but without
votes.

The replacement introduces direct user-to-unit tag applications and a
user-authored collection search text. Tag filters read `UserTagApplication`
relations directly; they are not denormalized into shelf item search documents.
The search optimization field is only what the user writes for their own
collection indexing, so updating one tag relation never fans out into thousands
of shelf-item document updates.

## Durable constraints & decisions

- `(type)` Add `UserTagApplication` as the user-scoped counterpart of
  `RealmTagApplication`: `(userId, unitId, tagUnitId)` plus optional
  `position`, timestamps, and no `score`, `voteCount`, or vote table.
- `(type)` Add `UserUnitCollection` for per-user/per-unit collection metadata:
  `(userId, unitId)`, nullable `searchText`, search-vector/index support, and
  timestamps. This row is not a shelf item and is shared across all of the
  user's shelves containing the Unit.
- `(comment)` Shelf remains the collection/publication surface. `ShelfUnit`
  continues to mean "this shelf contains this Unit" and owns shelf-local
  ordering only.
- `(comment)` User tags are applied to Units, not to `(shelfId, unitId)` pairs.
  Editing tags from a shelf item edits the user's cross-shelf
  `UserTagApplication` rows for that Unit.
- `(test)` Collecting a Unit into a shelf can also write user tags and
  collection search text, but those writes target `UserTagApplication` and
  `UserUnitCollection`, not shelf-item tag rows.
- `(test)` Updating one `UserTagApplication` must not enqueue or require fanout
  updates to shelf-item search documents. Tag filtering joins/filters against
  `UserTagApplication` at read time.
- `(comment)` `UserUnitCollection.searchText` is user-authored indexing help:
  arbitrary words, phrases, `#` text, aliases, or notes. It is not an automatic
  aggregate of Unit titles, public tags, realm tags, or shelf metadata.
- `(test)` Shelf content search combines shelf containment, user-authored
  collection text search, and optional `UserTagApplication` filters without
  reading user tag arrays from denormalized search documents.
- `(comment)` Direct user-tag profile/surface visibility is governed by the
  user's field-level privacy setting for the user tag domain. A public shelf API
  decides exposure from the shelf's own visibility/settings and does not inherit
  the user's direct user-tag privacy setting.
- `(type)` Global `UnitTag` and `RealmTagApplication` keep their voting/scoring
  semantics. `UserTagApplication` must not share vote or threshold logic with
  either model.
- `(test)` The same user/unit tag set is visible from every shelf owned by that
  user that contains the Unit, subject to the shelf endpoint's visibility rule.

## 1. Contract and Naming

- [ ] 1.1 Add `UserTagApplication` contract schemas and DTOs under
  `@rezics/contract`, mirroring realm tag naming where useful but omitting vote,
  score, and threshold fields.
- [ ] 1.2 Add `UserUnitCollection` contract schemas for per-user collection
  metadata, including nullable `searchText` and timestamps.
- [ ] 1.3 Extend collection write contracts so adding/collecting a Unit can
  optionally include `tagUnitIds` and `searchText`.
- [ ] 1.4 Extend shelf-unit list/search contracts with collection search
  options: `q`, `tagUnitIds`, pagination, and sorting compatible with existing
  shelf item ordering.
- [ ] 1.5 Add field-level privacy contract shape for user profile fields and the
  user tag domain, including a stable key for direct user tag surfaces.

## 2. Database Model

- [ ] 2.1 Add `UserTagApplication` to `package/server/prisma/schema.prisma` with
  primary key `(userId, unitId, tagUnitId)`, indexes for
  `(userId, unitId)`, `(userId, tagUnitId, unitId)`, and optional
  `(userId, tagUnitId, position)`.
- [ ] 2.2 Add `UserUnitCollection` with primary key `(userId, unitId)`,
  nullable `searchText`, timestamps, and indexes for user-scoped collection
  listing/search.
- [ ] 2.3 Add PostgreSQL search support for `UserUnitCollection.searchText`
  through a generated/stored search vector or equivalent raw SQL migration with
  a GIN index.
- [ ] 2.4 Add Prisma relations from `User` and `Unit` to
  `UserTagApplication` and `UserUnitCollection`.
- [ ] 2.5 Keep `Shelf`, `ShelfUnit`, and shelf-level `UnitTag` rows distinct:
  shelf-level pinned tags describe the shelf itself; user-unit tags describe
  the collected Unit for that user.

## 3. Server Domains

- [ ] 3.1 Create a `user-tag-application` server domain following
  `{domain}.api.ts`, `.service.ts`, `.mapper.ts`, and `.types.ts`.
- [ ] 3.2 Add APIs to list, set, reorder, and delete the caller's
  `UserTagApplication` rows for a Unit; mount them from
  `package/server/src/index.ts`.
- [ ] 3.3 Create a `user-unit-collection` server service for upserting and
  reading `searchText` and shared per-user/per-unit collection metadata.
- [ ] 3.4 Update `collection.service.ts` so collect/toggle flows upsert
  `UserUnitCollection` and optional `UserTagApplication` rows alongside
  `ShelfUnit` containment.
- [ ] 3.5 Update `shelf.service.ts` shelf-unit reads so `q` searches
  `UserUnitCollection.searchText` and tag filters query
  `UserTagApplication`, intersected with `ShelfUnit`.
- [ ] 3.6 Remove or avoid any shelf-item tag write path that would create
  per-shelf item tag state. Editing tags from shelf UI must call the user-tag
  application service.
- [ ] 3.7 Add privacy decision helpers for direct user tag surfaces versus shelf
  API exposure. Shelf reads use shelf visibility/settings; direct profile/user
  tag reads use the user's field-level privacy setting.

## 4. Search and Indexing

- [ ] 4.1 Add focused PostgreSQL full-text search tests or service tests for
  `UserUnitCollection.searchText`, including words, spaces, `#` text, and
  sentence-like input.
- [ ] 4.2 Keep Meilisearch content documents free of `UserTagApplication`
  arrays and per-shelf user tag denormalization.
- [ ] 4.3 If a separate collection-search index is added later, define it around
  `(userId, unitId, searchText)` only; tag filters must still resolve through
  `UserTagApplication` or bounded SQL joins.
- [ ] 4.4 Add regression coverage that updating a `UserTagApplication` does not
  enqueue content-index or shelf-item-index fanout jobs.

## 5. API and Frontend Access

- [ ] 5.1 Add `@rezics/api` functions, query keys, and mutations for
  user-tag applications and user-unit collection metadata.
- [ ] 5.2 Update collection modal APIs/types so users can add tags and
  `searchText` while collecting a Unit into one or more shelves.
- [ ] 5.3 Update shelf item editor models so item tag edits call
  `UserTagApplication` APIs and apply across every shelf containing the Unit.
- [ ] 5.4 Update shelf search/list screens to pass `q` and `tagUnitIds` to the
  shelf content API instead of expecting tag arrays inside shelf item documents.
- [ ] 5.5 Add UI affordances for collection `searchText` as user-authored
  private/indexing text, separate from public Unit metadata.

## 6. Migration and Verification

- [ ] 6.1 Backfill `UserUnitCollection` from distinct `(shelf owner userId,
  ShelfUnit.unitId)` pairs.
- [ ] 6.2 If any existing shelf-item tag data exists by implementation time,
  migrate it into `UserTagApplication` by `(shelf owner, unitId, tagUnitId)`;
  otherwise document that the old shelf-item tag model never landed.
- [ ] 6.3 Add service tests proving the same user/unit tag set is returned from
  multiple shelves owned by the same user.
- [ ] 6.4 Add service tests proving public shelf exposure does not require direct
  user tag profile visibility, while direct user-tag profile reads do.
- [ ] 6.5 Add performance-oriented tests around batch status/tag lookups so
  shelf pages load user tags and collection metadata without N+1 queries.
- [ ] 6.6 Add account deletion/export coverage for `UserTagApplication` and
  `UserUnitCollection`.

## Out of scope

- Do not replace `Shelf` or `ShelfUnit`; shelf remains the collection mechanism.
- Do not add voting, scores, or visibility thresholds to `UserTagApplication`.
- Do not denormalize user tag ids into shelf item search documents or content
  search documents.
- Do not make `searchText` an automatic aggregate of Unit/title/tag metadata.
- Do not change global `UnitTag` or realm `RealmTagApplication` semantics except
  where shared tag DTO helpers need naming cleanup.
- Do not build a full privacy-settings UI beyond the contract/server decisions
  needed for user tag surfaces and shelf exposure.
