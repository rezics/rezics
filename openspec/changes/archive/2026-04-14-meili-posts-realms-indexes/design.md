## Context

Meilisearch currently has 3 indexes: `content` (books, games, media, shelves, links), `users`, and `feedbacks`. The `@rezics/search` package provides `SearchClient` with index definitions, `sync.ts` with document builders and sync functions, and the server's `meili.api.ts` exposes search, init, sync, and delete endpoints.

Posts (`PostKind.REVIEW`, `QUOTE`, `REMARK`, `POST`) and realms have no Meilisearch presence. Frontend list views for both hit Postgres directly.

## Goals / Non-Goals

**Goals:**
- Add `posts` and `realms` Meilisearch indexes with list-ready denormalized documents
- Add incremental sync triggers on post and realm mutations
- Add server-mediated search endpoints for both indexes
- Rewire frontend list views to use Meilisearch for browsing and search
- Restrict DB-backed list endpoints to admin role (for admin dashboard use)

**Non-Goals:**
- CDC / logical replication (continue with direct sync strategy)
- Migrating the existing `content` index frontend queries (separate change if desired)
- Real-time sync guarantees (fire-and-forget pattern, same as existing content sync)

## Decisions

### 1. Two new independent indexes (not merged into `content`)

Posts and realms get their own Meilisearch indexes (`posts`, `realms`) rather than being added to the existing `content` index.

**Rationale:** Posts and realms have fundamentally different document shapes, search priorities, and filter dimensions than library content. Separate indexes allow independent tuning of searchable attribute priority, ranking rules, and filterable attributes.

**Alternative considered:** Merging everything into `content` — rejected because the `content` index is optimized for library discovery (titles, credits, tags) while posts are text-body-centric and realms are lightweight metadata documents.

### 2. Post documents denormalize author + target unit for list rendering

Each post document includes:
- `author: { name, slug, avatar }` — denormalized from User
- `targetTitle`, `targetType`, `targetCoverUrl` — denormalized from the target unit's translation and type extension
- `scoreValue`, `scoreFields` — denormalized from linked ScoreEntry

This means a single Meilisearch query returns everything needed to render a post card. Author name changes or target title changes trigger re-sync of affected post documents.

**Rationale:** Avoids N+1 queries. The existing `content` index uses the same denormalization pattern for `creditNames` and `tagLabels`.

### 3. Realm documents denormalize all translations into searchable arrays

Same pattern as the `content` index: `titles[]`, `descriptions[]` arrays from `UnitTranslation` rows, plus a `translations[]` structured array for display.

**Rationale:** Enables multilingual search (search in any language) while also carrying enough data to render realm cards.

### 4. Frontend lists use Meilisearch search endpoints with empty keyword

An empty-keyword search with filters is equivalent to a filtered list:
```
POST /meili/posts/search { kind: "REVIEW", targetUnitId: "..." }
→ Returns all reviews for a unit, sorted by createdAt desc
```

This unifies search and browse into a single code path on the frontend.

**Rationale:** Meilisearch handles filtering, sorting, and pagination efficiently. Frontend gets consistent search/filter behavior whether the user typed a keyword or not.

### 5. DB-backed list endpoints restricted to admin

Existing `GET /realms/` and `GET /posts/` endpoints remain but require `BasicAdminPermission`. The admin dashboard uses these for data management with full relational data.

**Rationale:** Admin needs relational data (joins, nested relations) that Meilisearch documents don't carry. Public users get the faster Meilisearch path.

### 6. Sync follows existing fire-and-forget pattern

Post and realm sync calls use the same `.catch(() => {})` pattern as existing content sync. No queuing, no retry.

**Rationale:** Consistency with existing architecture. A failed sync means the document is stale until the next mutation or manual full reindex. Acceptable trade-off for simplicity.

## Data Flow

```
POST create/update/delete
  → post.service.ts
    → Postgres write (transaction)
    → syncPostToMeili(unitId)  // fire-and-forget
      → buildPostDocument(unitId)  // reads from Postgres
        → Meilisearch addDocuments

REALM create/update + translation update
  → realm.service.ts / translation.service.ts
    → Postgres write
    → syncRealmToMeili(unitId)  // fire-and-forget
      → buildRealmDocument(unitId)
        → Meilisearch addDocuments

Frontend list:
  RemarkList → POST /meili/posts/search { kind: "REMARK", targetUnitId }
  RealmLanding → POST /meili/realms/search { isPublic: true }
  RealmSearch → POST /meili/realms/search { keyword, isOfficial, sort }
```

## Index Definitions

### Posts Index

| Setting | Value |
|---------|-------|
| Primary key | `id` (unit UUID) |
| Searchable | `body`, `targetTitles`, `authorName` |
| Filterable | `kind`, `targetUnitId`, `realmUnitId`, `authorUserId`, `depth`, `isLocked`, `rootPostUnitId`, `parentPostUnitId` |
| Sortable | `createdAt`, `updatedAt`, `replyCount` |
| Display | `author`, `targetUnit`, `scoreValue`, `scoreFields`, `extra`, `directReplyCount`, `lastReplyAt`, `sortPath` |

### Realms Index

| Setting | Value |
|---------|-------|
| Primary key | `id` (unit UUID) |
| Searchable | `titles`, `descriptions` |
| Filterable | `isPublic`, `isOfficial` |
| Sortable | `memberCount`, `createdAt`, `updatedAt` |
| Display | `translations`, `extra`, `userId` |

## Risks / Trade-offs

- **[Risk] Post author changes require re-syncing all their posts** → Mitigated: author profile changes are rare. When they occur, a bulk re-sync of that user's posts is acceptable. Add a `syncPostsByAuthor(userId)` helper.
- **[Risk] Stale documents on sync failure** → Same as existing content index. Manual full reindex via admin panel is the recovery path.
- **[Risk] Large post volume** → Posts grow faster than library content. Monitor index size. Meilisearch handles millions of documents well.
