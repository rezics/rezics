## Context

The current Meilisearch integration consists of:

- **`@rezics/search`** (`package/search/`): `SearchClient` class with 5 indexes (`books`, `units`, `readlists`, `feedbacks`, `users`), each with init/sync/CRUD methods. Sync functions read directly from old Prisma models (`Book.title`, `Book.author`, `Unit.title`, etc.).
- **`@rezics/server`** (`package/server/src/meili/`): Per-type subdirectories (`book/`, `unit/`, `readlist/`, `feedback/`, `user/`), each with sync, API, and mapper files. `MeiliService` facades all operations. `searchBooks()` builds Meilisearch filter strings from typed `BookQueryOptions`.
- **`@rezics/contract`** (`package/contract/src/meili/`): Per-type interfaces (`BookSearchDocument`, `UnitSearchDocument`, `ReadlistSearchDocument`, etc.) and result types.
- **`@rezics/app`**: Search feature with `app-search-feature` spec, consuming `BookSearchResult` from server API.

The `unit-architecture` change (dependency) restructures the entire data model. After that change lands:
- Text fields move to `UnitTranslation(unitId, language)` — `Book.title`, `Book.description`, `Unit.title`, `Unit.content` no longer exist.
- Attribution moves to `PersonCredit`/`OrgCredit` — `Book.author`/`Book.press`/`Book.producer` (User M2M) no longer exist.
- Tags become `UnitTag(unitId, tagUnitId, score)` with UUID-based tag identities — `Book.tags String[]` and the `Tag.name`-based system no longer exist.
- Readlists are replaced by Shelves. Domains are replaced by Realms.
- New types added: `GAME`, `MEDIA`, `REALM`, `SHELF`. Old types removed: `COMMENT`, `NOTE`, `REMARK`, `REVIEW`, `DOMAIN`, `READLIST`.
- Work/release model: `Unit.workUnitId` links releases to works. Releases are NOT indexed — only works and standalone units appear in search.

## Goals / Non-Goals

**Goals:**
- Replace the 5-index architecture with a unified content index for all discoverable Unit types
- Define a document model with denormalized multilingual content (one doc per Unit, all translations flattened)
- Support realm-scoped search via three independent denormalized fields mapping to `RealmUnit`, `RealmTagUnit`, and `UnitTag`
- Move search mediation to the server (tag UUIDs resolved server-side, no direct frontend-to-Meilisearch queries)
- Provide both full reindex and incremental (per-unit) sync capabilities
- Define shared contract types consumed by frontend and backend

**Non-Goals:**
- Search relevance tuning or custom ranking rules (default Meilisearch ranking is sufficient for launch)
- Faceted search / aggregation counts (can be added later via Meilisearch facets)
- Real-time search updates via WebSocket (sync is request-triggered or batch)
- Search analytics or query logging
- Person/Organization search (attribution entities are not Units, not indexed)
- Post/comment search (posts use `Post.body`, not `UnitTranslation` — different search semantics, potentially a future separate index)

## Decisions

### D1: Unified Content Index — One Index for All Discoverable Types

**Decision**: Replace the `books`, `units`, and `readlists` indexes with a single `content` index. The `users` and `feedbacks` indexes are retained separately.

**Rationale**: Books, games, media, and shelves share the same structural foundation after `unit-architecture`: they're all Units with `UnitTranslation` for text, `UnitTag` for tags, `RealmUnit`/`RealmTagUnit` for realm organization. Separate indexes per type would duplicate index settings, sync logic, and API code for what is structurally the same document shape. A `type` filterable attribute separates them at query time.

**Alternative considered**: Keep type-specific indexes (one for books, one for games, etc.). Rejected because it multiplies sync code and the document shape is identical — only the type-specific extension fields differ, and those are minor (e.g., `isbn13` for books, `platformKeys` for games).

**Index configuration**:
```
Index: "content"
Primary key: "id"

Searchable attributes (ordered by priority):
  1. titles        — UnitTranslation.title values (all languages)
  2. subtitles     — UnitTranslation.subtitle values
  3. descriptions  — UnitTranslation.description values
  4. summaries     — UnitTranslation.summary values
  5. creditNames   — PersonCredit + OrgCredit name values
  6. tagLabels     — UnitTranslation.title of associated tag Units (for text search on tags)

Filterable attributes:
  - type           — UnitType enum value (BOOK, GAME, MEDIA, SHELF)
  - tagIds         — string[] of tag Unit UUIDs (from UnitTag)
  - realmIds       — string[] of realm Unit UUIDs (from RealmUnit)
  - realmTagKeys   — string[] of "realmUnitId:tagUnitId" compound keys (from RealmTagUnit)
  - languages      — string[] of language codes (from UnitTranslation)
  - nsfw           — boolean
  - visibility     — UnitVisibility enum value
  - isLicensed     — boolean (from type extension)

Sortable attributes:
  - createdAt
  - updatedAt
  - publishedAt
```

### D2: One Document Per Unit, All Translations Denormalized

**Decision**: Each indexed Unit becomes exactly one Meilisearch document. All `UnitTranslation` rows for that unit are flattened into arrays (`titles: string[]`, `descriptions: string[]`, etc.).

**Rationale**: At million-scale, per-translation documents would multiply the index size by 2-5x with no proportional gain. Meilisearch tokenizes array elements independently — searching "哈利波特" matches the Chinese element in a `titles` array that also contains the English title, with no relevance penalty. One-doc-per-unit keeps the index lean and sync simple.

**Document shape** (`ContentSearchDocument`):
```typescript
interface ContentSearchDocument {
  // Identity
  id: string;                    // Unit.id (UUID)
  type: string;                  // UnitType enum value

  // Searchable text (denormalized from UnitTranslation)
  titles: string[];              // all UnitTranslation.title values
  subtitles: string[];           // all UnitTranslation.subtitle values
  summaries: string[];           // all UnitTranslation.summary values
  descriptions: string[];        // all UnitTranslation.description values

  // Searchable attribution (denormalized from PersonCredit + OrgCredit)
  creditNames: string[];         // all Person.name + Organization.name via credits

  // Searchable tag labels (denormalized from tag Unit translations)
  tagLabels: string[];           // UnitTranslation.title of each associated tag Unit

  // Filterable: tag system (from UnitTag)
  tagIds: string[];              // tag Unit UUIDs
  tagScores: Record<string, number>; // tagUnitId → score (for client-side sorting if needed)

  // Filterable: realm system (from RealmUnit)
  realmIds: string[];            // realm Unit UUIDs

  // Filterable: realm-tag system (from RealmTagUnit)
  realmTagKeys: string[];        // "realmUnitId:tagUnitId" compound strings

  // Filterable: metadata
  languages: string[];           // language codes from UnitTranslation
  nsfw: boolean;
  visibility: string;            // UnitVisibility enum value
  isLicensed: boolean;           // from type extension (Book/Game/Media)

  // Sortable
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;

  // Result display fields (denormalized for rendering without DB round-trip)
  defaultLanguage: string | null;
  coverAssetUnitId: string | null; // from type extension
  userId: string | null;          // creator
}
```

### D3: Three Independent Denormalized Fields for Realm/Tag

**Decision**: The three junction tables (`RealmUnit`, `RealmTagUnit`, `UnitTag`) each map to their own independent field on the search document. They are never conflated.

**Rationale**: Each table serves a distinct query pattern:

| Table | Document field | Query pattern |
|---|---|---|
| `UnitTag` | `tagIds: string[]` | "Show works tagged X" (global) |
| `RealmUnit` | `realmIds: string[]` | "Show works in realm Y" (content feed) |
| `RealmTagUnit` | `realmTagKeys: string[]` | "In realm Y, show works tagged X" (scoped classification) |

Compound keys in `realmTagKeys` use the format `"realmUnitId:tagUnitId"` where both are UUIDs. Example: `"550e8400-...:7c9e6679-..."`. This is the only way to express three-way junction filtering in Meilisearch's flat filter model.

**Filter construction examples**:
```
// Global tag filter
filter: 'tagIds = "7c9e6679-..."'

// Realm content feed
filter: 'realmIds = "550e8400-..."'

// Realm + scoped tag filter
filter: 'realmTagKeys = "550e8400-...:7c9e6679-..."'

// Realm content feed + global tag filter (different from scoped)
filter: 'realmIds = "550e8400-..." AND tagIds = "7c9e6679-..."'
```

Note the semantic difference between the last two: `realmTagKeys` means "this realm specifically classifies this unit with this tag" (curated). `realmIds AND tagIds` means "this unit is in the realm AND happens to have this tag globally" (coincidental).

### D4: Server-Mediated Search — No Direct Frontend-to-Meilisearch

**Decision**: All search queries go through the server. The frontend calls a server search endpoint; the server builds Meilisearch filters and returns results. The `getSearchKey()` pattern (issuing Meilisearch API keys to the frontend) is removed.

**Rationale**: Tags are now UUID-based. The frontend may know a tag's display label but not its UUID. The server must resolve tag context before building filters. Additionally, server mediation enables:
- Visibility/permission enforcement (private units, realm membership)
- Filter enrichment (e.g., auto-exclude nsfw unless opted in)
- Response shaping (map `ContentSearchDocument` to the DTO the frontend expects)

**Search API contract** (`ContentSearchOptions`):
```typescript
interface ContentSearchOptions {
  keyword?: string;              // free-text query
  type?: string | string[];      // UnitType filter(s)
  tagIds?: string[];             // global tag UUIDs
  realmId?: string;              // realm UUID (content feed)
  realmTagIds?: string[];        // tag UUIDs scoped to realmId (builds realmTagKeys filter)
  languages?: string[];          // language code filter
  nsfw?: boolean;                // default false
  isLicensed?: boolean;
  sort?: {
    field: 'createdAt' | 'updatedAt' | 'publishedAt' | 'relevance';
    order?: 'asc' | 'desc';
  };
  offset?: number;
  limit?: number;
}
```

When `realmId` and `realmTagIds` are both provided, the server constructs `realmTagKeys` filters by combining them: `realmTagIds.map(tagId => \`${realmId}:${tagId}\`)`.

### D5: Releases Are Not Indexed

**Decision**: Only works (`workUnitId = null` with type BOOK/GAME/MEDIA) and standalone units (`workUnitId = null`, any discoverable type) are indexed. Release units (`workUnitId != null`) are excluded from the content index.

**Rationale**: The primary search use case is work discovery — "find Harry Potter", not "find the Scholastic US paperback edition." Release-level lookup (by ISBN, by publisher) is a detail-page concern served by direct DB queries, not full-text search. Excluding releases reduces the content index size significantly (potentially 3-5x fewer documents at scale) and eliminates the need for `distinctAttribute`-based grouping.

**Indexing predicate** (SQL equivalent):
```sql
WHERE workUnitId IS NULL
  AND type IN ('BOOK', 'GAME', 'MEDIA', 'SHELF')
  AND status = 'PUBLISHED'
  AND visibility = 'PUBLIC'
```

### D6: Sync Strategy — Full Reindex + Incremental Updates

**Decision**: Two sync modes:
1. **Full reindex**: Delete all documents, cursor-paginate through qualifying units, batch-insert. Used for initial setup and recovery.
2. **Incremental sync**: On unit mutation (create/update/delete), sync that single unit's document. Called from domain services after successful DB transaction.

**Rationale**: Full reindex is necessary for initial deployment and for recovery after schema changes or data corrections. Incremental sync keeps the index fresh during normal operation without the cost of full reindex.

**Incremental sync triggers**:
- Unit created/updated/deleted → sync or remove that unit's document
- `UnitTranslation` created/updated/deleted → re-sync the parent unit's document
- `UnitTag` created/updated/deleted → re-sync the tagged unit's document
- `RealmUnit` created/deleted → re-sync the unit's document
- `RealmTagUnit` created/deleted → re-sync the unit's document
- `PersonCredit`/`OrgCredit` created/deleted → re-sync the credited unit's document

Each trigger resolves to a single unit ID. The sync function fetches the full document data for that unit and upserts it in Meilisearch.

**Full reindex query** (Prisma):
```typescript
prisma.unit.findMany({
  where: {
    workUnitId: null,
    type: { in: ['BOOK', 'GAME', 'MEDIA', 'SHELF'] },
    status: 'PUBLISHED',
    visibility: 'PUBLIC',
  },
  include: {
    translations: true,
    unitTags: {
      include: { tag: { include: { translations: true } } }
    },
    inRealms: true,
    realmTagAsUnit: true,
    personCredits: { include: { person: true } },
    organizationCredits: { include: { organization: true } },
    book: true,
    game: { include: { platforms: true } },
    media: true,
    shelf: true,
  },
  orderBy: { id: 'asc' },
  take: BATCH_SIZE,
  skip: cursor ? 1 : 0,
  cursor: cursor ? { id: cursor } : undefined,
})
```

### D7: Users and Feedbacks Indexes Retained

**Decision**: The `users` and `feedbacks` Meilisearch indexes are retained with minimal changes. They are not merged into the content index.

**Rationale**: Users and feedbacks are structurally different from content units — they don't have `UnitTranslation`, `UnitTag`, or realm associations. Merging them would bloat the content document with irrelevant fields. The existing sync logic for these indexes requires only minor field updates (e.g., removing `UserType` enum values that no longer exist).

## Risks / Trade-offs

**[Risk] `realmTagKeys` array size on popular works** → At scale, a work in 50 realms with 30 tags per realm could have 1500 `realmTagKeys` entries. Meilisearch handles large filterable arrays well (they're stored as inverted indexes), but sync write-amplification is a concern: every `RealmTagUnit` mutation triggers a document re-sync. **Mitigation**: Incremental sync is a single-document upsert — the cost is fetching the unit's full relations and sending one document to Meilisearch. At typical mutation rates this is acceptable. If write volume becomes a bottleneck, batch realm-tag mutations with a short debounce.

**[Risk] Tag label search requires denormalizing tag translations** → `tagLabels` contains the display names of tags (from tag Unit's `UnitTranslation`). When a tag's label changes, all documents using that tag need re-sync. **Mitigation**: Tag labels change rarely. When they do, a targeted reindex of affected documents (query `UnitTag WHERE tagUnitId = X`) is acceptable.

**[Risk] Server mediation adds latency vs direct Meilisearch queries** → Every search now routes through the server. **Mitigation**: The server is co-located with Meilisearch (same network). The added latency is one network hop (~1ms). Tag resolution is a simple ID lookup, not a heavy operation. The benefits (permission enforcement, filter enrichment) outweigh the cost.

**[Trade-off] No release-level search** → Users cannot search by ISBN or find specific editions via full-text search. **Accepted**: Release lookup is a detail-page concern. The server can provide a `GET /units/:workId/releases` endpoint with optional ISBN filter — this is a DB query, not a search problem.

## Open Questions

None — all design decisions resolved during exploration.
