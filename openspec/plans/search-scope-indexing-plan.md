# Search Scope & Indexing Plan

**Status**: Draft plan, pre-proposal  
**Date**: 2026-05-09  
**Scope**: Future search architecture for global, book-scoped, realm-scoped, and user-scoped search

---

## 1. Context

Header search started as a navigation/UI improvement, but route-aware search scope
quickly became a larger product and indexing question. The current header work
should stay narrow:

- Desktop header can show a search input.
- Mobile home keeps the existing page-level search input position and does not
  show a duplicate header search icon.
- Realm and user pages may show scoped header affordances.
- Other pages should use basic/general filter behavior for now.

The richer question of "what should search include?" belongs in a separate
search project.

---

## 2. Current Findings

### 2.1 Content index

The unified `content` index currently supports public content search over:

- `BOOK`
- `GAME`
- `MEDIA`
- `SHELF`
- `LINK`

Current document fields include:

- `id`
- `type`
- searchable translation fields: `titles`, `subtitles`, `summaries`,
  `descriptions`
- searchable attribution/tag fields: `creditNames`, `tagLabels`
- filterable tags: `tagIds`
- filterable realm membership: `realmIds`
- filterable realm tag keys: `realmTagKeys`
- `languages`, `rating`, `visibility`, `isLicensed`, `textLength`
- display-only `userId`

Current content filters support `realmId`, because it maps to
`realmIds = "<realmId>"`.

Current content filters do **not** support:

- `bookId`
- `userId`
- "shelves containing this book"

`userId` exists on content documents but is not currently configured as a
filterable content attribute.

### 2.2 Post index

Posts are indexed separately. The post index supports:

- `targetUnitId`
- `realmIds`
- `authorUserId`
- `rootPostUnitId`
- `parentPostUnitId`
- `kind`

This means book-scoped post search is already conceptually supported through:

- `targetUnitId = bookId`

Realm-scoped post search is supported through:

- `realmIds contains realmId`

User-scoped post search is supported through:

- `authorUserId = userId`

### 2.3 Engagement data

Reactions, progress, follows, and similar engagement records should not become
search results. They can influence ranking or facets later, but they are not
content objects.

---

## 3. Product Semantics

### 3.1 Global/general search

General search should eventually search across public content-like objects:

- books
- games
- media
- shelves
- links
- reviews
- excerpts
- remarks
- posts

It should not search:

- reactions
- reading progress
- private/system-only feedback
- notifications
- follow edges
- raw score entries

### 3.2 Book-scoped search

`/book/:bookId/*` should mean:

> Search public content related to this book.

Recommended result scope:

- reviews targeting the book
- excerpts targeting the book
- remarks/posts targeting the book
- public shelves containing the book

Do not include:

- reactions to the book
- private reading progress
- private collections
- unrelated content by the book's author/owner

Implementation implication:

- `posts.targetUnitId = bookId` covers reviews/excerpts/remarks/posts.
- Shelves require the content index to add a filterable field such as
  `containedUnitIds` or `shelfItemUnitIds`.

### 3.3 Realm-scoped search

`/realm/:realmId` should mean:

> Search public content inside this realm.

Recommended result scope:

- content with `realmIds contains realmId`
- posts with `realmIds contains realmId`

Do not include by default:

- realm members
- reactions
- moderation records

Members can have a separate member search if the realm page needs it.

### 3.4 User-scoped search

`/user/:userId` and `/u/:slug` should mean:

> Search this user's public authored/published content.

Recommended result scope:

- content with `userId = userId`
- posts with `authorUserId = userId`

Include:

- public books authored/owned by the user
- public shelves owned by the user
- public links owned by the user
- reviews
- excerpts
- remarks/posts

Do not include:

- reactions
- private bookmarks/favorites
- reading progress
- follow/follower relationships
- sessions, tokens, settings, or other account data

Implementation implication:

- Content index should make `userId` filterable.
- Post index already supports `authorUserId`.

---

## 4. Recommended Architecture

Use federated scoped search instead of forcing every searchable object into one
index immediately.

```
SearchScope
  global/general
    -> content index
    -> post index

  book
    -> post index where targetUnitId = bookId
    -> content index where shelfItemUnitIds contains bookId

  realm
    -> content index where realmIds contains realmId
    -> post index where realmIds contains realmId

  user
    -> content index where userId = userId
    -> post index where authorUserId = userId
```

The UI can merge results into an "All" view, with optional tabs/facets:

- All
- Books
- Reviews
- Shelves
- Posts
- Links

This preserves index-specific data shapes while keeping the user-facing search
experience coherent.

---

## 5. Header Search Implication

Header search should not encode the full search project in v1.

For the header-focused change:

- Home desktop: show global search input.
- Home mobile: keep the existing page-level search input and omit header search
  icon.
- Realm desktop: show scoped search affordance with a `r/{localizedTitle}` badge.
- User desktop: show scoped search affordance with a `u/{usernameOrSlug}` badge.
- Other pages: use the basic/general search behavior and placeholder.

Book-scoped search should not be claimed in UI copy until the richer indexing
work exists.

---

## 6. Future Work

Potential OpenSpec changes:

1. `search-scope-contracts`
   - Define `SearchScope` types and route-to-scope rules.
   - Define global/book/realm/user scoped search API contracts.

2. `search-index-content-relations`
   - Add filterable `userId` to content index settings.
   - Add shelf contained-unit fields, such as `shelfItemUnitIds`.
   - Backfill content documents.

3. `federated-search-results`
   - Build backend/frontend query orchestration for content + posts.
   - Normalize result display models.
   - Add result grouping/tabs.

4. `scoped-search-ui`
   - Add full pages or overlays for scoped book/realm/user search.
   - Add route-aware badges and placeholders.

---

## 7. Open Questions

- Should global search include users and realms, or should those remain separate
  verticals?
- Should book-scoped search include chapters once chapter indexing is mature?
- Should public system shelves appear in user-scoped results, or only
  user-created shelves?
- Should scoped search default to relevance or recency when the query is empty?
- Should reactions influence ranking once enough engagement data exists?
