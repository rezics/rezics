## Context

All five Meilisearch indexes (content, posts, realms, users, feedbacks) use `addDocuments()` for every sync operation — both initial creation and incremental updates. This means every field change triggers a full Prisma query with all nested includes and replaces the entire document in Meilisearch.

The Meilisearch JS client provides two distinct methods:
- `addDocuments()` → `POST /indexes/{uid}/documents` — full document replace (missing fields are deleted)
- `updateDocuments()` → `PUT /indexes/{uid}/documents` — partial merge (only provided fields are updated, rest preserved)

Current sync architecture:

```
Service layer (e.g. tag.service.attachToUnit)
  → prisma.unitTag.create(...)
  → syncContentToMeili(unitId)
    → prisma.unit.findUnique({ include: contentInclude })  ← 7 nested includes
    → buildContentDocument(unit)                            ← full document
    → client.contentIndex.addDocuments([doc])               ← full replace
```

The `contentInclude` alone pulls translations, unitTags (with tag translations), inRealms, realmTagAsUnit, personCredits (with person), orgCredits (with org), and all type extensions.

## Goals / Non-Goals

**Goals:**
- Reduce DB query cost for incremental updates by fetching only changed data
- Reduce Meilisearch payload size for incremental updates by sending only changed fields
- Eliminate fan-out join queries (e.g., rebuilding N post documents with 6 joins when a user changes their avatar)
- Maintain full-rebuild capability for creation and admin reindex operations

**Non-Goals:**
- Changing document schemas or index settings
- Adding new indexes or removing existing ones
- Implementing CDC (Change Data Capture) — that's a separate concern
- Optimizing full reindex operations (those are admin-only and infrequent)
- Denormalization reduction (removing fields from indexes)

## Decisions

### Decision 1: Two-tier method pattern on SearchClient

Add `patch*` methods alongside existing `addOrUpdate*` methods on `SearchClient`. Each index gets a corresponding partial update method:

```
addOrUpdateContent(docs)   → addDocuments()    — full replace (creation, reindex)
patchContent(docs)         → updateDocuments() — partial merge (field updates)
```

**Why not replace addDocuments entirely?** `addDocuments()` is correct for creation (all fields present) and full reindex (ensures clean state). `updateDocuments()` would silently preserve stale fields if a document exists with unexpected data. Both methods serve distinct purposes.

**Alternatives considered:**
- Single method that auto-detects: Rejected — implicit behavior makes debugging harder and the caller always knows whether it's creating or patching.

### Decision 2: Dedicated partial sync functions per update scenario

Instead of one monolithic `syncSingleContent()` that fetches everything, add targeted functions for each update scenario:

| Function | Trigger | Fields sent | DB query |
|----------|---------|-------------|----------|
| `patchContentTags(unitId)` | Tag attach/detach | `tagIds`, `tagScores`, `tagLabels` | UnitTag + tag translations |
| `patchContentCredits(unitId)` | Credit link/unlink | `creditNames` | PersonCredit + OrgCredit |
| `patchContentTranslations(unitId)` | Translation upsert | `titles`, `subtitles`, `summaries`, `descriptions`, `languages`, `translations` | UnitTranslation |
| `patchContentRealmIds(unitId)` | Realm add/remove | `realmIds` | RealmUnit |
| `patchContentRealmTagKeys(unitId)` | Realm tag add/remove | `realmTagKeys` | RealmTagUnit |
| `patchContentMetadata(unitId, fields)` | Book/unit metadata update | Only changed fields (e.g., `coverUrl`, `nsfw`, `visibility`) | None — caller passes values |
| `patchPostsAuthor(userId, fields)` | User profile change | `authorName`, `authorSlug`, `authorAvatar` | Post IDs only |
| `patchPostsTarget(targetUnitId)` | Target translation change | `targetTitles`, `targetType`, `targetCoverUrl` | Post IDs + target unit data |
| `patchPostFields(unitId, fields)` | Post body/lock edit | Only changed fields | None — caller passes values |
| `patchRealmMemberCount(unitId, count)` | Join/leave | `memberCount` | None — caller passes value |
| `patchRealmMetadata(unitId, fields)` | Realm update | Only changed fields | None — caller passes values |
| `patchRealmTranslations(unitId)` | Translation upsert | `titles`, `descriptions`, `translations` | UnitTranslation |
| `patchUserFields(unitId, fields)` | Profile update | Only changed fields | None — caller passes values |
| `patchFeedbackResolution(id, fields)` | Resolution toggle | `resolved`, `resolvedAt` | None — caller passes values |

**Why per-scenario instead of a generic `patchDocument(index, id, fields)`?** Each scenario has different DB query needs. Some need no query at all (caller passes values), some need a lightweight query (just IDs), some need a targeted include. A generic method can't optimize the DB side.

**Alternatives considered:**
- Generic patch with field whitelist: Rejected — doesn't solve the DB query optimization, which is the bigger win.
- Event-based with a queue: Out of scope (CDC is a future concern).

### Decision 3: Fan-out partial updates for cross-document propagation

For scenarios where one entity change affects many documents (user profile → N posts, target translation → N posts), the partial sync function:

1. Queries only the document IDs from Postgres (`SELECT unitId FROM posts WHERE authorUserId = ?`)
2. Builds minimal partial documents (`{ id, authorName, authorSlug, authorAvatar }`)
3. Sends via `updateDocuments()` in batches

This eliminates the per-document join queries entirely. The caller (service layer) provides the new field values directly — no need to re-fetch the user or target unit since the service already has them.

### Decision 4: Service layer passes changed values directly

Where possible, the service layer passes the new values to the patch function instead of having the sync layer re-query them:

```typescript
// Before: service updates DB, then sync re-queries everything
await prisma.user.update({ where: { unitId }, data: { name, avatar } });
await syncUserToMeili(unitId); // re-fetches entire user

// After: service passes values it already has
await prisma.user.update({ where: { unitId }, data: { name, avatar } });
await patchUserFields(unitId, { name, avatar }); // no DB query needed
```

For fan-out cases, the service also passes the values:

```typescript
// User profile update in user.service
await prisma.user.update({ where: { unitId }, data: { name, avatar } });
await patchUserFields(unitId, { name, avatar });
await patchPostsAuthor(unitId, { authorName: name, authorAvatar: avatar });
```

### Decision 5: Full rebuild remains the fallback

Full sync functions (`syncSingleContent`, `syncSinglePost`, etc.) remain unchanged and available. They're used for:
- Document creation (new entities)
- Admin full reindex
- Edge cases where the caller doesn't know which fields changed

The service layer chooses partial vs. full based on context. Creation always uses full. Updates use partial.

## Risks / Trade-offs

**[Risk] Partial update on non-existent document** → If `updateDocuments()` is called for a document that doesn't exist in the index, Meilisearch creates a document with only the provided fields. This would produce an incomplete document. → **Mitigation:** Partial updates are only used in update paths (entity already exists). Creation paths always use full sync. If a document is missing from the index, the next full reindex corrects it.

**[Risk] Field drift over time** → If a partial update is lost (network error, Meilisearch downtime), the document may have stale denormalized fields until the next full reindex. → **Mitigation:** This is the same risk as today (fire-and-forget sync can already fail). Full reindex remains available as a correction mechanism. No change in reliability guarantees.

**[Risk] Increased API surface in SearchClient** → Adding `patch*` methods doubles the write API surface. → **Mitigation:** Methods are thin wrappers (`return this.postIndex.updateDocuments(docs)`). The complexity is minimal and the naming convention (`patch*` vs `addOrUpdate*`) makes intent clear.

**[Trade-off] Service layer coupling** → The service must now know which Meilisearch fields correspond to which DB fields (e.g., `name` → `authorName`). → **Accepted:** This coupling already exists implicitly in `buildPostDocument()`. Making it explicit in the service layer is clearer and avoids redundant DB queries.

## Migration Plan

1. Add `patch*` methods to `SearchClient` — no existing behavior changes
2. Add partial sync functions to `sync.ts` — no existing behavior changes
3. Update service-layer calls one by one to use partial sync for update paths
4. Keep full sync for creation paths unchanged
5. After deployment, run a full reindex on all indexes to ensure consistency
6. No rollback needed — reverting to full sync is just changing which function the service calls
