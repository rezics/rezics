---
title: Simplify Shelf With User Tag Applications
status: done
created: 2026-05-31
completed: 2026-06-01
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

The replacement introduces direct user-to-unit tag applications and
user-authored collection search text. Tag filters read `UserTagApplication`
relations directly; they are not denormalized into shelf item search documents.
Collection text search uses a dedicated Meilisearch collection index, not
PostgreSQL full-text search and not the generic content index. That index stores
only the user's collection-side metadata; searchable content from collected
Units continues to come from the canonical Unit/content search surface.

## Durable constraints & decisions

- `(type)` Add `UserTagApplication` as the user-scoped counterpart of
  `RealmTagApplication`: `(userId, unitId, tagUnitId)` plus optional
  `position`, timestamps, and no `score`, `voteCount`, or vote table.
- `(type)` Add `UserUnitCollection` for per-user/per-unit collection metadata:
  `(userId, unitId)`, nullable `searchText`, and timestamps. This row is not a
  shelf item, does not prove current collection membership, and is shared across
  all of the user's shelves containing the Unit.
- `(comment)` `unitId` in both `UserTagApplication` and `UserUnitCollection` is
  the resolved interaction target Unit. Exact edition/source/variant context
  belongs to shelf containment or interaction context, not to these shared
  per-user/per-unit rows.
- `(comment)` Shelf remains the collection/publication surface. `ShelfUnit`
  continues to mean "this shelf contains this Unit" and owns shelf-local
  ordering only.
- `(comment)` User tags are applied to Units, not to `(shelfId, unitId)` pairs.
  Editing tags from a shelf item edits the user's cross-shelf
  `UserTagApplication` rows for that Unit.
- `(test)` Collection reads and searches must intersect current `ShelfUnit`
  containment. `UserUnitCollection` and `UserTagApplication` rows may enrich a
  collected Unit, but neither row type alone makes a Unit appear collected.
- `(test)` Collecting a Unit into a shelf can also write user tags and
  collection search text, but those writes target `UserTagApplication` and
  `UserUnitCollection`, not shelf-item tag rows.
- `(test)` Collection writes use patch semantics: omitted `tagUnitIds` or
  `searchText` leave existing metadata untouched; an empty tag array replaces
  the user's tag set with none; `searchText: null` clears collection search text.
- `(test)` Updating one `UserTagApplication` must not enqueue or require fanout
  updates to shelf-item search documents. Tag filtering joins/filters against
  `UserTagApplication` at read time.
- `(comment)` `UserUnitCollection.searchText` is user-authored indexing help:
  arbitrary words, phrases, `#` text, aliases, or notes. It is not an automatic
  aggregate of the collected Unit's content, metadata, tags, or shelf metadata.
- `(comment)` The collection Meilisearch index stores only collection-side
  metadata such as `ownerUserId`, `unitId`, `searchText`, and collection
  timestamps. It must not copy any content or metadata from the collected Unit.
- `(test)` My collection search combines current shelf containment, public
  content-index hits, owner-private collection-index hits, and optional
  `UserTagApplication` filters without reading user tag arrays from denormalized
  content or shelf-item documents.
- `(test)` A user's public collection search combines public shelf exposure,
  public content-index hits, and shelf-approved owner user-tag exposure. It must
  not search or expose the owner's private `UserUnitCollection.searchText`.
- `(test)` Public shelf content search follows the same rule: the shelf owner
  may use private `searchText` when searching their own shelf, but other viewers
  search only public collected-Unit content plus any shelf-approved owner tag
  filters.
- `(comment)` Direct user-tag profile/surface visibility is governed by the
  user's field-level privacy setting for the user tag domain. A public shelf API
  decides exposure from the shelf's own visibility/settings and does not inherit
  the user's direct user-tag privacy setting.
- `(comment)` Public shelf and public collection APIs use the shelf owner's
  `UserTagApplication` rows when exposing owner tags. The current viewer's
  private user tags are used only for that viewer's own collection search.
- `(type)` Global `UnitTag` and `RealmTagApplication` keep their voting/scoring
  semantics. `UserTagApplication` must not share vote or threshold logic with
  either model.
- `(test)` The same user/unit tag set is visible from every shelf owned by that
  user that contains the Unit, subject to the shelf endpoint's visibility rule.
- `(test)` Updating canonical content or metadata on a collected Unit must update
  the content search index and must not fan out copied collected-Unit content
  into the collection index.

## 1. Contract and Naming

- [ ] 1.1 Add `UserTagApplication` contract schemas and DTOs under
  `@rezics/contract`, mirroring realm tag naming where useful but omitting vote,
  score, and threshold fields.
- [ ] 1.2 Add `UserUnitCollection` contract schemas for per-user collection
  metadata, including nullable `searchText` and timestamps.
- [ ] 1.3 Extend collection write contracts so adding/collecting a Unit can
  optionally include `tagUnitIds` and `searchText`, with explicit omitted,
  empty-array, and null patch semantics.
- [ ] 1.4 Extend shelf-unit list/search contracts with collection search options:
  `q`, `tagUnitIds`, pagination, and sorting compatible with existing shelf item
  ordering.
- [ ] 1.5 Add collection-wide search contracts for the caller's own collection
  and for a specific user's public collection.
- [ ] 1.6 Add field-level privacy contract shape for user profile fields and the
  user tag domain, including a stable key for direct user tag surfaces.

## 2. Database Model

- [ ] 2.1 Add `UserTagApplication` to `package/server/prisma/schema.prisma` with
  primary key `(userId, unitId, tagUnitId)`, indexes for
  `(userId, unitId)`, `(userId, tagUnitId, unitId)`, and optional
  `(userId, unitId, position)` if user/unit tag chip ordering is supported.
- [ ] 2.2 Add `UserUnitCollection` with primary key `(userId, unitId)`,
  nullable `searchText`, timestamps, and indexes for user-scoped metadata
  lookup and collection index sync.
- [ ] 2.3 Do not add PostgreSQL full-text search columns, generated search
  vectors, or GIN search indexes for `UserUnitCollection.searchText`.
- [ ] 2.4 Add Prisma relations from `User` and `Unit` to
  `UserTagApplication` and `UserUnitCollection`.
- [ ] 2.5 Keep `Shelf`, `ShelfUnit`, and shelf-level `UnitTag` rows distinct:
  shelf-level pinned tags describe the shelf itself; user-unit tags describe
  the collected Unit for that user.
- [ ] 2.6 Keep exact edition/source/variant context out of
  `UserTagApplication` and `UserUnitCollection`; use the resolved interaction
  target Unit in their `unitId` columns.

## 3. Server Domains

- [ ] 3.1 Create a `user-tag-application` server domain following
  `{domain}.api.ts`, `.service.ts`, `.mapper.ts`, and `.types.ts`.
- [ ] 3.2 Add APIs to list, set, reorder, and delete the caller's
  `UserTagApplication` rows for a Unit; mount them from
  `package/server/src/index.ts`.
- [ ] 3.3 Create a `user-unit-collection` server service for upserting and
  reading `searchText` and shared per-user/per-unit collection metadata.
- [ ] 3.4 Add or reuse a collection target resolver that resolves exact
  edition/source/variant submissions to the long-term interaction target before
  writing user tag or collection metadata.
- [ ] 3.5 Update `collection.service.ts` so collect/toggle flows upsert
  `UserUnitCollection` and optional `UserTagApplication` rows alongside
  `ShelfUnit` containment.
- [ ] 3.6 Update `shelf.service.ts` shelf-unit reads so owner searches can
  combine content search hits with owner-private collection search hits, while
  public-viewer searches use public collected-Unit content only. Tag filters
  query `UserTagApplication`, intersected with `ShelfUnit`.
- [ ] 3.7 Add collection-wide read services for the caller's own collection and
  for a user's public collection. Public collection reads must use shelf
  visibility and must not search private `searchText`.
- [ ] 3.8 Remove or avoid any shelf-item tag write path that would create
  per-shelf item tag state. Editing tags from shelf UI must call the user-tag
  application service.
- [ ] 3.9 Add privacy decision helpers for direct user tag surfaces versus shelf
  API exposure. Shelf reads use shelf visibility/settings; direct profile/user
  tag reads use the user's field-level privacy setting.

## 4. Search and Indexing

- [ ] 4.1 Add a dedicated Meilisearch collection index for collection-side
  metadata: `ownerUserId`, `unitId`, nullable `searchText`, and collection
  timestamps. Do not include any copied content or metadata from the collected
  Unit.
- [ ] 4.2 Keep Meilisearch content documents free of `UserTagApplication`
  arrays and per-shelf user tag denormalization.
- [ ] 4.3 Add collection index sync for `UserUnitCollection.searchText` changes
  only. Content metadata changes sync the content index, not the collection
  index.
- [ ] 4.4 Implement search orchestration that queries the content index for
  collected-Unit content or metadata matches and the collection index for
  owner-private `searchText` matches, then intersects results with current shelf
  containment and optional `UserTagApplication` filters.
- [ ] 4.5 Add regression coverage that updating a `UserTagApplication` does not
  enqueue content-index or shelf-item-index fanout jobs.
- [ ] 4.6 Add regression coverage proving collected-Unit content and metadata
  search comes from the content index, while collection `searchText` comes from
  the collection index.

## 5. API and Frontend Access

- [ ] 5.1 Add `@rezics/api` functions, query keys, and mutations for
  user-tag applications and user-unit collection metadata.
- [ ] 5.2 Update collection modal APIs/types so users can add tags and
  `searchText` while collecting a Unit into one or more shelves.
- [ ] 5.3 Update shelf item editor models so item tag edits call
  `UserTagApplication` APIs and apply across every shelf containing the Unit.
- [ ] 5.4 Update shelf search/list screens to pass `q` and `tagUnitIds` to the
  shelf content API instead of expecting tag arrays inside shelf item documents.
- [ ] 5.5 Add API/query access and UI entry points for searching the caller's
  full collection across all shelves.
- [ ] 5.6 Add API/query access and UI entry points for searching a user's public
  collection without exposing private `searchText`.
- [ ] 5.7 Add UI affordances for collection `searchText` as user-authored
  private/indexing text, separate from public Unit metadata.

## 6. Migration and Verification

- [ ] 6.1 Backfill `UserUnitCollection` from distinct `(shelf owner userId,
  ShelfUnit.unitId)` pairs.
- [ ] 6.2 If any existing shelf-item tag data exists by implementation time,
  migrate it into `UserTagApplication` by `(shelf owner, unitId, tagUnitId)`;
  otherwise document that the old shelf-item tag model never landed.
- [ ] 6.3 Backfill or initialize the collection Meilisearch index from existing
  `UserUnitCollection.searchText` values only; do not copy any collected-Unit
  content or metadata into collection documents.
- [ ] 6.4 Add service tests proving the same user/unit tag set is returned from
  multiple shelves owned by the same user.
- [ ] 6.5 Add service tests proving public shelf exposure does not require direct
  user tag profile visibility, while direct user-tag profile reads do.
- [ ] 6.6 Add service tests proving public collection search does not search or
  expose `UserUnitCollection.searchText`, while the owner's own collection
  search does.
- [ ] 6.7 Add performance-oriented tests around batch status/tag lookups so
  shelf pages load user tags and collection metadata without N+1 queries.
- [ ] 6.8 Add account deletion/export coverage for `UserTagApplication` and
  `UserUnitCollection`.

## Out of scope

- Do not replace `Shelf` or `ShelfUnit`; shelf remains the collection mechanism.
- Do not add voting, scores, or visibility thresholds to `UserTagApplication`.
- Do not denormalize user tag ids into shelf item search documents or content
  search documents.
- Do not add PostgreSQL full-text search for `UserUnitCollection.searchText`.
- Do not copy collected Unit content or metadata into the collection
  Meilisearch index; collected-Unit search remains a content-index concern.
- Do not make `searchText` an automatic aggregate of collected Unit content,
  metadata, tags, or shelf metadata.
- Do not build all-users collection discovery beyond "my collection search" and
  "a user's public collection search".
- Do not change global `UnitTag` or realm `RealmTagApplication` semantics except
  where shared tag DTO helpers need naming cleanup.
- Do not build a full privacy-settings UI beyond the contract/server decisions
  needed for user tag surfaces and shelf exposure.
