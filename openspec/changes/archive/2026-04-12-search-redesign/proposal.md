## Why

The current Meilisearch integration uses five separate indexes (books, units, readlists, feedbacks, users) with type-specific sync logic that reads directly from the old schema (`Book.title`, `Book.author`, `Book.tags`, `Unit.title`, `Unit.content`). The `unit-architecture` change removes these fields entirely — text moves to `UnitTranslation`, attribution moves to `PersonCredit`/`OrgCredit`, tags become scored `UnitTag` junctions with UUID-based identities, and readlists are replaced by shelves. Beyond schema adaptation, the new architecture introduces realms (community scoping), the work/release model, and new content types (games, media) — none of which the current search system can represent.

A mechanical rewrite of the sync layer is insufficient. The index architecture, document model, filtering strategy, and API surface all need redesign to support: multilingual content discovery, realm-scoped search with realm-tag filtering, server-mediated tag resolution (tags are now UUIDs, not strings), and a unified content index spanning books, games, media, and shelves.

## What Changes

### Index Architecture
- **BREAKING**: The five existing indexes (`books`, `units`, `readlists`, `feedbacks`, `users`) are replaced by a new index set.
- New **`content`** index: unified index for all discoverable Unit types (BOOK, GAME, MEDIA, SHELF works and standalone units). Releases (`workUnitId != null`) are NOT indexed.
- **`users`** index retained with minor field updates.
- **`feedbacks`** index retained as-is.
- The old `books`, `units`, and `readlists` indexes are dropped.

### Document Model
- Each indexed Unit becomes one document with all `UnitTranslation` rows denormalized (multilingual titles, descriptions as arrays).
- Three separate denormalized fields map to the three junction tables: `realmIds` (from `RealmUnit`), `realmTagKeys` (from `RealmTagUnit`, compound `realmId:tagId` strings), `tagIds` (from `UnitTag`).
- Attribution denormalized from `PersonCredit`/`OrgCredit` as `creditNames` array.

### Search API
- **BREAKING**: Tag filtering moves from string-based to UUID-based. The frontend sends tag identifiers; the server resolves and builds Meilisearch filter expressions. Direct frontend-to-Meilisearch search key pattern is removed.
- Server search endpoint mediates all queries: receives typed search options, builds filters (realm, tag, type, nsfw, language), queries Meilisearch, returns results.
- New filter dimensions: `realmIds`, `realmTagKeys`, `tagIds`, `type`, `languages`, `nsfw`, `visibility`.

### Sync Strategy
- Sync reads from post-`unit-architecture` schema: `UnitTranslation`, `UnitTag`, `RealmUnit`, `RealmTagUnit`, `PersonCredit`, `OrgCredit`.
- Incremental sync support: unit-level document updates on mutation (create/update/delete), plus full reindex capability.

### Contract Layer
- New `ContentSearchDocument` interface replacing `BookSearchDocument` and `UnitSearchDocument`.
- New `ContentSearchResult` replacing `BookSearchResult` and `UnitSearchResult`.
- New `ContentSearchOptions` with typed filter fields (realm, tags, type, language, nsfw).
- Old search document/result/query types removed.

## Capabilities

### New Capabilities
- `content-index`: Unified Meilisearch content index — document model, index settings (searchable/filterable/sortable attributes), and index lifecycle (init, drop, reindex)
- `content-sync`: Sync strategy from PostgreSQL to Meilisearch — full reindex and incremental unit-level sync, reading from UnitTranslation, UnitTag, RealmUnit, RealmTagUnit, PersonCredit, OrgCredit
- `content-search-api`: Server-side search API — query building, tag UUID resolution, realm-scoped filtering, result mapping
- `content-search-contract`: Shared TypeScript types for search documents, search options, and search results across frontend and backend

### Modified Capabilities
- `app-search-feature`: Frontend search feature updated to consume new `ContentSearchResult` shape, use server-mediated search instead of direct Meilisearch queries, and support realm/tag/type filtering

## Impact

### Affected Packages
- **`@rezics/search`**: Complete rewrite — new `SearchClient` with unified content index, new sync functions, old book/unit/readlist sync removed.
- **`@rezics/server`**: `package/server/src/meili/` restructured — old per-type subdirectories (`book/`, `unit/`, `readlist/`) replaced by unified `content/` domain. `MeiliService` rewritten. Search API endpoints updated.
- **`@rezics/contract`**: Old search document/result interfaces (`BookSearchDocument`, `UnitSearchDocument`, `ReadlistSearchDocument`, `BookSearchResult`, `UnitSearchResult`, `ReadlistSearchResult`, `BookQueryOptions`, `UnitListQuery`, `ReadlistListQuery`) removed. New `ContentSearchDocument`, `ContentSearchResult`, `ContentSearchOptions` added.
- **`@rezics/api`**: Search query options and hooks rewritten to use new contract types.
- **`@rezics/app`**: Search feature updated to consume new result shapes and server-mediated API.
- **`@rezics/admin`**: Admin search/sync controls updated for new index structure.

### Dependencies
- **Depends on `unit-architecture`**: This change requires the post-migration schema (UnitTranslation, UnitTag, RealmUnit, RealmTagUnit, PersonCredit, OrgCredit, updated UnitType enum). Must be implemented after unit-architecture completes.

### Backward Compatibility
- No backward compatibility with existing search system. This is a clean replacement.
- Old indexes are dropped. Old search document types are removed. Old sync functions are deleted.

### Migration
- Full reindex required after deployment. No incremental migration from old indexes — the document shapes are incompatible.
