## Why

The current work/release model tries to make a work behave like a visible
catalog item, but the product direction now requires visible releases to remain
first-class while sharing one hidden work domain for community, discovery, and
content aggregation. Without an explicit work-domain relation, search tags,
release grouping, shelves, reviews, posts, and discussion
feeds must each rediscover the same work/release semantics in incompatible ways.

## What Changes

- Add a dedicated `UnitWork` relationship model that links any work-domain
  participating Unit to a hidden work Unit, analogous in shape to `UnitTag` and
  `UnitRealm` but with work-specific semantics.
- Treat release Units as the primary user-facing catalog entries for books and
  any future release-aware domains; hidden work Units provide grouping,
  inherited tags, and community/content aggregation.
- Keep work-domain pages out of the ordinary user flow. Users open and interact
  with releases, while release pages can show work-wide community content by
  default.
- Register posts, reviews, shelves, and other work-domain content in `UnitWork`
  so any release in the same work can query shared content without release
  fan-out or target-specific projection fields.
- Keep the book language switcher scoped to the current release's
  `UnitTranslation` rows. Missing desired languages link users to the Releases
  tab, where same-work releases can be filtered by language.
- Add derived `metadata.uswn` to library content DTOs. USWN is the Universal
  Standard Work Number exposed to frontend/library consumers; it is not stored
  in the database and resolves to the current canonical work Unit id, or `null`
  when the Unit has no work domain.
- Make ordinary content creation release-led. Public/personal creation flows
  create visible releases and guide users to search for an existing work before
  creating new content; standalone hidden work creation is reserved for admin
  repair/maintenance surfaces.
- Add admin-only work merge and optional metadata-copy operations. Work merge
  migrates canonical release/content membership to the target work, preserves
  the source work Unit and its non-membership metadata, and runs through queued
  repair for active work domains. Optional tag/alias copy is explicit and
  independent from canonical content migration.
- Generalize book content identity language so content structures use
  `contentUnitId` for chapter/content-unit identity instead of `chapterId`, and
  keep `targetUnitId` reserved for interaction targets.
- Add Meilisearch projections for inherited work tags and grouped release
  search. Tag filtering SHALL query denormalized `allTagIds` fields, while
  result presentation groups by work where appropriate.
- Add CDC/job-runner batch processing for work-tag fan-out, `UnitWork` changes,
  release move, work merge, and full work-domain search repair.
- Rename the realm membership relation concept from `RealmUnit` to `UnitRealm`
  for naming consistency with `UnitTag` and `UnitWork`.
- **BREAKING**: `RealmUnit` code/schema/API names are replaced by `UnitRealm`
  names in a phased internal cutover.
- **BREAKING**: `UnitTranslation.sourceReleaseUnitId` is replaced by the more
  general `sourceUnitId`; release selection is handled by same-work release
  browsing, not by translation-source rows.

## Capabilities

### New Capabilities

- `unit-work-domain`: Defines `UnitWork`, hidden work Units, release membership,
  work-domain content membership, derived USWN
  metadata, admin work merge, optional work metadata copy, and work-domain search
  projection requirements.

### Modified Capabilities

- `work-release`: Replaces the user-facing work/release interpretation with the
  hidden work domain plus visible release model.
- `unit-translation`: Renames `sourceReleaseUnitId` to `sourceUnitId` and removes
  release selection semantics from translation records.
- `content-search-contract`: Adds inherited work tag/search fields and grouped
  release result metadata to content search documents and options.
- `content-search-api`: Applies inherited work tag filters and grouped release
  presentation in the server search API.
- `post-search-index`: Uses `UnitWork` work-scope membership for posts and
  reviews while preserving precise `targetUnitId` context.
- `shelf-collection`: Keeps shelf storage release-first while registering
  shelves as work-domain content when they contain same-work releases.
- `book-detail-language-switcher`: Keeps language switching scoped to the
  current release's `UnitTranslation` records and links missing-language flows
  to the Releases tab.
- `book-detail-release-selector`: Changes the release selector into a Releases
  tab with multi-select language filtering and `UnitWork.position` ordering.
- `realm-post-junction`: Renames the realm membership model and related API
  language from `RealmUnit` to `UnitRealm`.
- `content-creation-work-matching`: Adds creation-time work matching UX and API
  behavior so users search ordinary content/release results before creating a
  new release or work domain.
- `library-content-metadata`: Adds derived `metadata.uswn` to library content
  DTOs.
- `content-structure`: Generalizes content structure terminology from
  book/chapter-specific ids to `contentStructure` and `contentUnitId`.
- `seed-factory-scenarios`: Adds work-domain seed fixtures covering
  multi-release works, inherited tags, release-local translations, grouped shelves,
  release-specific reviews, and optional external references.

## Impact

- Affected packages:
  - `package/server`: Prisma schema, migrations, work-link/unit services, post
    targeting, shelf services, tag services, work merge operations, metadata
    copy operations, work-domain membership maintenance, search sync enqueueing,
    and domain APIs.
  - `package/contract`: DTO schemas for Unit, UnitTranslation, content search,
    post search, shelf/search result metadata, library content metadata, and
    work-domain contracts.
  - `package/search`: Meilisearch document builders, index settings,
    inherited-tag projection, grouped result helpers, and repair handlers.
  - `package/job-runner`: CDC/outbox routing and batch handlers for `UnitWork`,
    `UnitTag`, `UnitTranslation`, `UnitRealm`, release move, and work merge.
  - `package/api`: API clients, query keys, mutations, and hooks for work-domain
    membership, grouped search, Releases tab, and shelf hydration.
  - `package/app`: book detail routes, release selector, language switching,
    creation-time work matching UI, community feed filters, search result
    rendering, USWN metadata rendering, content structure terminology, and shelf
    rendering.
  - `package/admin`: admin repair/diagnostic surfaces for work-domain grouping,
    release move, work merge, and search projection drift.
- Database impact:
  - Adds `UnitWork`.
  - Adds admin work-merge operation state, or an equivalent durable operation
    log, for async/revertible merge and optional metadata-copy jobs.
  - Renames `RealmUnit` to `UnitRealm` through a phased migration.
  - Migrates `UnitTranslation.sourceReleaseUnitId` to `sourceUnitId`.
- Search impact:
  - Content and post indexes gain inherited work fields and work grouping
    fields.
  - Meilisearch filterable attributes include inherited/all tag arrays,
    work-domain membership fields, `workUnitId`, `UnitWork.position`, and
    display policy fields.
- Backward compatibility:
  - Existing `Unit.workUnitId` MAY be retained during migration as a
    denormalized shortcut, but `UnitWork` becomes the canonical relation.
  - Existing release links are backfilled into `UnitWork`.
  - Existing `RealmUnit` references are renamed in a clear internal cutover
    because the project is still in development.
  - Search consistency is eventually consistent after work-domain structural
    changes; user-facing mutations enqueue repair jobs instead of blocking on
    full Meilisearch fan-out.
