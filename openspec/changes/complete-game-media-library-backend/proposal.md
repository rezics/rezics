## Why

GAME and MEDIA currently exist as shallow type extensions with legacy work-link
language, string platform keys, string age rating keys, and incomplete metadata
semantics. After `introduce-unit-work-domain`, these library content types need a
real release-first backend that matches the same work-domain model as books
while supporting game- and media-specific structured facts.

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
  Entity-backed age-rating relationships.
- Add a dedicated game system requirements backend model and contract schema for
  platform/tier/source-specific requirements, with structured hardware slugs and
  optional raw source text. This data is not stored in `UnitTranslation.extra`.
- Tighten GAME and MEDIA metadata boundaries:
  - title, subtitle, summary, description, and cover stay in `UnitTranslation`;
  - creator, publisher, studio, cast, and crew data stay in `CreditAttribution`;
  - platforms, age ratings, characters, worlds, franchises, and other subjects
    stay in `SubjectAttribution`;
  - external source ids stay in `UnitExternalRef`;
  - editable long-form wiki/infobox text stays in `ContentDoc`.
- Add library-content DTO/search projection requirements for game/media typed
  metadata, platform filters, age-rating filters, system-requirement summaries,
  and content structure entry points.
- Add backend APIs/services for creating, reading, updating, searching, and
  repairing GAME and MEDIA release data using the same layering and contract
  boundaries as existing library content.
- Keep series as a deliberate follow-up. This proposal documents two candidate
  paths, but does not implement either:
  - `Shelf(kindKey = "series")` as the ordered collection substrate; or
  - a future Series Unit type whose members are organized through
    `contentStructure`.
- Frontend scope is limited to contract and data-readiness plus basic route
  integration guidance. Full GAME/MEDIA detail pages should follow the current
  book detail pattern: hero plus multi-tab layout, with the hero structure kept
  similar and the book review area replaced by domain media such as a trailer
  carousel when available.
- **BREAKING**: Replace public and internal `GamePlatform` string-key behavior
  with Entity-backed platform relations.
- **BREAKING**: Replace `ageRatingKey`-style game/media classification with
  Entity-backed age-rating relations.
- **BREAKING**: Update GAME/MEDIA work-release specs away from `Unit.workUnitId`
  and `UnitTranslation.sourceReleaseUnitId` semantics to the `UnitWork` and
  `sourceUnitId` model.

## Capabilities

### New Capabilities

- `game-system-requirements`: Stores and exposes game system requirements as
  dedicated source-aware backend records with structured hardware slugs and
  optional raw text.
- `game-media-library-backend`: Defines the complete GAME/MEDIA library backend
  surface: release-first work-domain usage, metadata ownership, DTO/search/API
  behavior, and frontend integration expectations.
- `series-library-content-options`: Captures the deferred series design space
  and the two candidate paths without committing this change to implementation.

### Modified Capabilities

- `type-extension-game`: Replaces legacy platform, age-rating, and work/release
  requirements with Entity-backed and `UnitWork`-backed behavior.
- `type-extension-media`: Replaces legacy work/release and episode/season count
  assumptions with `UnitWork` and content-structure-oriented behavior.
- `content-structure`: Clarifies that game DLC, expansions, media episodes,
  seasons, volumes, and similar parts are Units organized by content structure.
- `content-search-contract`: Adds game/media typed metadata and Entity-backed
  platform/age-rating projection fields.
- `content-search-api`: Adds server-side filters and response behavior for
  game/media platform and age-rating metadata.
- `library-content-metadata`: Extends release-aware library DTO metadata to
  include GAME/MEDIA typed fields while keeping `metadata.uswn` derived from
  `UnitWork`.
- `unit-translation`: Clarifies that game system requirements raw text does not
  live in `UnitTranslation.extra`.

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
  - Adds backfill paths from string platform/rating values to Entity-backed
    subject relations.
- Search impact:
  - GAME/MEDIA documents gain platform Entity ids, age-rating Entity ids, typed
    metadata fields, and system requirement summary fields.
- Backward compatibility:
  - Existing GAME/MEDIA Units are migrated as visible releases.
  - Existing `Unit.workUnitId` links are interpreted through the
    `introduce-unit-work-domain` backfill into `UnitWork`.
  - Existing `GamePlatform.platformKey` rows and `Game.ageRatingKey` values are
    migrated to seeded or imported Entities and subject relations.
  - Series remains intentionally unimplemented; existing shelves continue to
    work as normal shelves.
