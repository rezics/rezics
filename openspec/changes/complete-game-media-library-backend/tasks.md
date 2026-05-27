## 1. Contract Schemas

- [ ] 1.1 Add contract schemas for GameSystemRequirement DTOs, structured hardware requirement JSON, create/update inputs, and list filters in `package/contract`.
- [ ] 1.2 Add contract fields for GAME/MEDIA platform Entity ids, age-rating Entity ids, system-requirement summaries, and media content-structure availability in library content DTOs.
- [ ] 1.3 Add content search option schemas for `platformEntityIds` and `ageRatingEntityIds`, and update search result metadata schemas for GAME/MEDIA.
- [ ] 1.4 Add or extend contract registries for subject roles used by platforms and age ratings, including eligibility hints for EntityPicker.
- [ ] 1.5 Add contract tests for system requirement validation, search option validation, and DTO serialization.

## 2. Database And Migration

- [ ] 2.1 Add Prisma models and migration SQL for `GameSystemRequirement` with indexes for `gameUnitId`, `platformEntityId`, `tier`, and `sourceRefId`.
- [ ] 2.2 Seed or migration-create initial platform Entities for common game platforms such as Windows, macOS, Linux, Steam, Steam Deck, PlayStation, Xbox, Nintendo Switch, iOS, and Android.
- [ ] 2.3 Seed or migration-create initial age-rating Entities for common game/media rating systems such as ESRB, PEGI, CERO, TV, and film ratings.
- [ ] 2.4 Backfill existing `GamePlatform.platformKey` rows into platform Entity `SubjectAttribution(role = "available_on")` rows.
- [ ] 2.5 Backfill existing `Game.ageRatingKey` values into age-rating Entity `SubjectAttribution(role = "age_rating")` rows.
- [ ] 2.6 Remove, quarantine, or mark legacy `GamePlatform` and `Game.ageRatingKey` behavior after backfill tests pass.
- [ ] 2.7 Add migration tests or seed-factory verification for platform/rating backfill and system requirement storage.

## 3. Server Domain Services

- [ ] 3.1 Add `game-system-requirement` service, mapper, types, and API modules under `package/server/src` following existing domain naming conventions.
- [ ] 3.2 Update game service/mapper behavior to read/write Entity-backed platform and age-rating subject relations instead of `GamePlatform` or `ageRatingKey`.
- [ ] 3.3 Update media service/mapper behavior to expose age-rating subject relations and content-structure availability.
- [ ] 3.4 Update GAME/MEDIA read paths to resolve canonical work membership from `UnitWork(role = RELEASE)` and derived `metadata.uswn`.
- [ ] 3.5 Ensure GAME/MEDIA creation and update flows keep titles, descriptions, and covers in `UnitTranslation` and keep credits in `CreditAttribution`.
- [ ] 3.6 Add server-side validation that game system requirement raw text is stored only in requirement rows, not in `UnitTranslation.extra`.
- [ ] 3.7 Mount new or updated domain APIs from `package/server/src/index.ts`.
- [ ] 3.8 Add targeted server tests for GAME/MEDIA DTO mapping, platform/rating relation writes, system requirements, and work-domain resolution.

## 4. Search And Job Runner

- [ ] 4.1 Update `package/search` content document builders to project GAME platform Entity ids, age-rating Entity ids, release metadata, and system requirement summaries.
- [ ] 4.2 Update MEDIA search projection for kind key, age-rating Entity ids, runtime summary, release metadata, and content-structure availability.
- [ ] 4.3 Update Meilisearch filterable/sortable attributes for new GAME/MEDIA projected fields.
- [ ] 4.4 Update server content search API filters to apply `platformEntityIds` and `ageRatingEntityIds`.
- [ ] 4.5 Add job-runner repair paths for platform/rating backfill drift and GAME/MEDIA search document rebuilds.
- [ ] 4.6 Add search tests covering platform filter, age-rating filter, work grouping, and GAME/MEDIA result metadata.

## 5. Content Structure Integration

- [ ] 5.1 Update GAME/MEDIA content-structure mappers so DLC, expansions, seasons, episodes, volumes, and specials are represented as Units through `contentUnitId`.
- [ ] 5.2 Remove or demote code paths that treat `episodeCount`, `seasonCount`, or future part-count fields as canonical part identity.
- [ ] 5.3 Add tests that a game DLC Unit and media episode Unit can be listed through release content structure and targeted through `targetUnitId` interactions.

## 6. API Client And Frontend Readiness

- [ ] 6.1 Update `package/api` clients, query keys, and hooks for GAME/MEDIA DTOs, platform/rating filters, and system requirement reads.
- [ ] 6.2 Update frontend search/filter models to use Entity-backed platform and age-rating ids.
- [ ] 6.3 Add placeholder data integration points for future GAME/MEDIA detail pages using the book-like hero plus multi-tab layout direction.
- [ ] 6.4 Document that trailer/screenshot/carousel hero content is domain media and not part of this backend implementation.
- [ ] 6.5 Add frontend type-level or unit tests for DTO consumption and search filter state where existing patterns support it.

## 7. Admin And Import Readiness

- [ ] 7.1 Add admin-facing read/list endpoints or service methods for platform Entities, age-rating Entities, and system requirement rows.
- [ ] 7.2 Add source evidence handling so imported requirements can reference `UnitExternalRef` records.
- [ ] 7.3 Add drift diagnostics for legacy platform/rating rows, missing platform Entities, missing age-rating Entities, and search projection mismatch.
- [ ] 7.4 Document import-source expectations for IGDB, Steam, TMDB, IMDb, and PCGamingWiki without implementing crawlers/importers.

## 8. Series Follow-Up Documentation

- [ ] 8.1 Keep series unimplemented in this change and verify no `UnitType.SERIES` or series API is introduced.
- [ ] 8.2 Add developer documentation or design notes summarizing the two deferred paths: `Shelf(kindKey = "series")` and future Series Unit with `contentStructure`.
- [ ] 8.3 Verify GAME/MEDIA services do not depend on either series path and remain compatible with both.

## 9. Verification

- [ ] 9.1 Run targeted contract tests for GAME/MEDIA schemas and system requirements.
- [ ] 9.2 Run targeted server tests for game/media services, migrations, and APIs.
- [ ] 9.3 Run targeted search tests for projection and filters.
- [ ] 9.4 Run `bun run check:convention` and fix any repo convention violations introduced by the change.
- [ ] 9.5 Run `bun run format:check` or format changed files with Biome.
- [ ] 9.6 Run a repo-wide search for removed legacy names such as `GamePlatform`, `platformKey`, and `ageRatingKey` and migrate remaining internal callsites intentionally.
