## Why

GAME and MEDIA currently exist as shallow type extensions with legacy work-link
language, string platform keys, string age rating keys, and incomplete metadata
semantics. Now that `introduce-unit-work-domain` has landed, these library
content types need a real release-first backend that matches the same
work-domain model as books while supporting game- and media-specific structured
facts.

## What Changes

- Make GAME and MEDIA release-aware library content backed by `UnitWork` work
  domains. Users interact with visible release Units; hidden work Units remain
  grouping infrastructure and do not require public titles.
- Treat episodes, seasons, volumes, DLC, expansions, bonus content, and similar
  parts as Units organized through the generic `contentStructure` /
  `contentUnitId` model introduced by `introduce-unit-work-domain`.
- Replace `GamePlatform(platformKey)` with Entity-backed platform relationships
  so platform data can carry translations, aliases, external references, source
  evidence, and search projection metadata.
- Replace `Game.ageRatingKey` and any future MEDIA age-rating string field with
  catalog rating tags. External official age/content ratings (ESRB, PEGI, CERO,
  MPAA, TV) are classification vocabulary, not identity-bearing Entities: they
  live in the `TAGS` registry as board-prefixed flat slugs (for example
  `esrb-teen`, `pegi-12`, `cero-b`, `mpaa-r`, `tv-14`) and attach through
  `UnitTag`. They are distinct from the internal `ContentRating` axis
  (`Unit.rating`), which stays the maturity/discovery gate.
- Add a dedicated game system requirements backend model and contract schema for
  platform/tier/source-specific requirements, with structured hardware slugs and
  optional raw source text. This data is not stored in `UnitTranslation.extra`.
- Tighten GAME and MEDIA metadata boundaries:
  - title, subtitle, summary, description, and cover stay in `UnitTranslation`;
  - creator, publisher, studio, cast, and crew data stay in `CreditAttribution`;
  - platforms, characters, and worlds stay in `SubjectAttribution`; worlds
    attach as `Entity(kind = "universe")` through the existing `setting` role;
  - external official age/content ratings stay in the `TAGS` registry as catalog
    tags applied through `UnitTag`, not as subjects;
  - franchise grouping is modeled as `Series(kind = "franchise")`, not as a
    subject;
  - external source ids stay in `UnitExternalRef`;
  - editable long-form wiki/infobox text stays in `ContentDoc`.
- Add library-content DTO/search projection requirements for game/media typed
  metadata, Entity-backed platform filters, tag-backed age-rating filters,
  system-requirement summaries, and content structure entry points.
- Add backend APIs/services for creating, reading, updating, searching, and
  repairing GAME and MEDIA release data using the same layering and contract
  boundaries as existing library content.
- Follow the exact-vs-work-domain list/search naming rule from
  `clarify-release-vs-work-list-scopes`: GAME/MEDIA list and search surfaces use
  `*UnitId` / `targetUnitId` / `containsUnitId` for exact Unit scope and
  `*WorkUnitId` / `workUnitId` / `containsWorkUnitId` for work-domain scope, and
  reuse `containsReleaseUnitId` / `relatedWorkUnitId` for Series/franchise
  lookups. This change depends on that change landing first.
- Frontend scope is limited to contract and data-readiness plus basic route
  integration guidance. Full GAME/MEDIA detail pages should follow the current
  book detail pattern: hero plus multi-tab layout, with the hero structure kept
  similar and the book review area replaced by domain media such as a trailer
  carousel when available.
- **BREAKING**: Replace public and internal `GamePlatform` string-key behavior
  with Entity-backed platform relations.
- **BREAKING**: Replace `ageRatingKey`-style game/media classification with
  catalog rating tags applied through `UnitTag`.

## Capabilities

### New Capabilities

- `game-system-requirements`: Stores and exposes game system requirements as
  dedicated source-aware backend records with structured hardware slugs and
  optional raw text.
- `game-media-library-backend`: Defines the complete GAME/MEDIA library backend
  surface: release-first work-domain usage, metadata ownership, DTO/search/API
  behavior, and frontend integration expectations.
### Modified Capabilities

- `type-extension-game`: Replaces legacy platform and work/release requirements
  with Entity-backed platforms and `UnitWork`-backed behavior, and moves age
  ratings to catalog tags.
- `type-extension-media`: Replaces legacy work/release and episode/season count
  assumptions with `UnitWork` and content-structure-oriented behavior.
- `content-structure`: Clarifies that game DLC, expansions, media episodes,
  seasons, volumes, and similar parts are Units organized by content structure.
- `content-search-contract`: Adds game/media typed metadata, Entity-backed
  platform projection fields, and tag-backed age-rating projection.
- `content-search-api`: Adds server-side filters and response behavior for
  game/media Entity-backed platform metadata and tag-backed age-rating metadata.
- `library-content-metadata`: Extends release-aware library DTO metadata to
  include GAME/MEDIA typed fields while keeping `metadata.uswn` derived from
  `UnitWork`.
- `unit-translation`: Clarifies that game system requirements raw text does not
  live in `UnitTranslation.extra`.
- `entity-unit-type`: Adds `game_platform` and `universe` to the contract entity
  kind registry. `universe` names the same concept as the Series `universe`
  kind at a different layer (Series = curated release collection; Entity =
  taggable subject).
- `subject-attribution`: Adds the `available_on` subject role for platforms and
  adds `universe` as a kind hint on the existing `setting` role. No `age_rating`
  subject role is added.

## Impact

- Affected packages:
  - `package/server`: Prisma schema, migrations, game/media services, mappers,
    APIs, Entity-backed relationship writes, external-ref integration, content
    structure reads, and repair/backfill paths.
  - `package/contract`: GAME/MEDIA DTOs, platform and age-rating relation
    schemas, system requirement schemas, search option schemas, and library
    content metadata contracts.
  - `package/search`: Meilisearch document builders, filterable attributes,
    platform/age-rating denormalization, and game/media system requirement
    summaries.
  - `package/job-runner`: repair jobs for platform/age-rating migrations,
    GAME/MEDIA work-domain projection repair, and search rebuilds.
  - `package/api`: typed API clients, query keys, and mutations for game/media
    library content.
  - `package/app`: route/data integration for future GAME/MEDIA detail pages
    and search filters. Full visual implementation is out of scope except for
    documenting the book-like hero plus multi-tab target.
  - `package/admin`: admin repair/import surfaces for external refs, platform
    entities, age-rating entities, and system requirements.
- Database impact:
  - Removes or migrates `GamePlatform`.
  - Removes or deprecates `Game.ageRatingKey`.
  - Adds game system requirement storage.
  - Adds backfill paths from string platform values to Entity-backed subject
    relations and from string rating values to external rating tags.
- Search impact:
  - GAME/MEDIA documents gain platform Entity ids, external rating tag ids,
    typed metadata fields, and system requirement summary fields.
- Backward compatibility:
  - Existing GAME/MEDIA Units are migrated as visible releases.
  - Existing `Unit.workUnitId` links were already migrated into `UnitWork` by
    the landed `introduce-unit-work-domain` foundation.
  - Existing `GamePlatform.platformKey` rows are migrated to platform Entities
    and `available_on` subject relations.
  - Existing `Game.ageRatingKey` values are migrated to external rating tags via
    `UnitTag`.
