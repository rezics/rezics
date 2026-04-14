## Why

All Meilisearch sync operations currently use `addDocuments()` (full document replace), even when only 1–3 fields change. This means every update — a tag attach, a memberCount increment, a user avatar change — triggers a full Prisma query with all nested includes and pushes the entire document to Meilisearch. For fan-out updates (e.g., user profile change propagating to all their posts), this multiplies into heavy DB load and large payloads for minimal field changes.

## What Changes

- Add `updateDocuments()`-based partial update methods to `SearchClient` alongside existing `addDocuments()` methods
- Add lightweight partial sync functions that query only IDs + changed data instead of full relation trees
- Refactor service-layer sync calls to use partial updates when only a subset of fields changed
- Keep full rebuilds for creation and full reindex operations (no change to those paths)

### Per-index optimizations

- **Posts**: User profile changes (`authorName`, `authorSlug`, `authorAvatar`) and target unit changes (`targetTitles`, `targetCoverUrl`, `targetType`) use partial updates instead of rebuilding N documents with 6-table joins
- **Content**: Tag attach/detach, credit link/unlink, translation upsert, realm association changes, and book metadata updates each send only their affected fields
- **Realms**: `memberCount` changes (join/leave) and metadata updates (`isPublic`, `isOfficial`) use partial updates instead of full rebuilds with translation joins
- **Users**: Profile updates (`name`, `avatar`, `bio`, `description`) use partial updates
- **Feedbacks**: Resolution toggle (`resolved`, `resolvedAt`) uses partial updates

## Capabilities

### New Capabilities
- `meili-partial-sync`: Partial document update infrastructure for all Meilisearch indexes — `SearchClient` patch methods, lightweight sync functions, and service-layer integration

### Modified Capabilities
- `content-sync`: Sync triggers switch from full rebuild to partial updates for tag, credit, translation, realm association, and metadata changes
- `post-search-index`: Post sync triggers switch from full rebuild to partial updates for author profile and target unit changes
- `realm-search-index`: Realm sync triggers switch from full rebuild to partial updates for memberCount and metadata changes
- `profile-sync`: User profile update sync switches from full rebuild to partial update

## Impact

**Affected packages:**
- `@rezics/search` — `SearchClient` gains partial update methods; `sync.ts` gains lightweight sync functions
- `@rezics/server` — Service-layer sync calls in `user.service.ts`, `post.service.ts`, `realm.service.ts`, `feedback.service.ts`, `book.service.ts`, `unit.service.ts`, `translation.service.ts`, `tag.service.ts`, `attribution.service.ts` switch to partial sync where applicable
- `@rezics/contract` — No schema changes (document types remain the same)

**Backward compatibility:** Fully backward-compatible. Document schemas don't change. Full reindex operations remain available. The change is purely an optimization of how incremental updates are performed.

**Migration:** No data migration needed. Existing indexes continue to work. A full reindex is recommended after deployment but not required.
