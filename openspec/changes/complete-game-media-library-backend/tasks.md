## 1. Contract Schemas

- [x] 1.1 Add contract schemas for GameSystemRequirement DTOs, structured hardware requirement JSON, create/update inputs, and list filters in `package/contract`.
- [x] 1.2 Add contract fields for GAME/MEDIA platform Entity ids, age-rating Entity ids, system-requirement summaries, and media content-structure availability in library content DTOs.
- [x] 1.3 Add a `platformEntityIds` content search option, route age-rating filtering through the existing tag filter (rating tag Units), and update search result metadata schemas for GAME/MEDIA.
- [x] 1.4 Extend contract registries: add the `available_on` subject role and the `game_platform` + `universe` entity kinds (with EntityPicker eligibility hints), add `universe` to the `setting` role hints, and add a `RATING_TAGS` constant enumerating board-prefixed rating tag slugs. Do not add an `age_rating` entity kind or subject role.
- [x] 1.5 Add contract tests for system requirement validation, search option validation, and DTO serialization.

## 2. Database And Migration

- [x] 2.1 Add Prisma models and migration SQL for `GameSystemRequirement` with indexes for `gameUnitId`, `platformEntityId`, `tier`, and `sourceRefId`.
- [x] 2.2 Seed or migration-create initial platform Entities for common game platforms such as Windows, macOS, Linux, Steam, Steam Deck, PlayStation, Xbox, Nintendo Switch, iOS, and Android.
- [x] 2.3 Seed external rating tags (`RATING_TAGS`) as TAG Units with multilingual labels for common game/media rating systems (ESRB, PEGI, CERO, MPAA film, TV).
- [x] 2.4 Backfill existing `GamePlatform.platformKey` rows into platform Entity `SubjectAttribution(role = "available_on")` rows.
- [x] 2.5 Backfill existing `Game.ageRatingKey` values into the matching rating tag via `UnitTag`.
- [x] 2.6 Remove, quarantine, or mark legacy `GamePlatform` and `Game.ageRatingKey` behavior after backfill tests pass.
- [x] 2.7 Add migration tests or seed-factory verification for platform/rating backfill and system requirement storage.

## 3. Server Domain Services

- [x] 3.1 Add `game-system-requirement` service, mapper, types, and API modules under `package/server/src` following existing domain naming conventions.
- [x] 3.2 Update game service/mapper behavior to read/write Entity-backed platform subject relations and rating tags (`UnitTag`) instead of `GamePlatform` or `ageRatingKey`.
- [x] 3.3 Update media service/mapper behavior to expose rating tags and content-structure availability.
- [x] 3.4 Update GAME/MEDIA read paths to resolve canonical work membership from `UnitWork(role = RELEASE)` and derived `metadata.uswn`.
- [x] 3.5 Ensure GAME/MEDIA creation and update flows keep titles, descriptions, and covers in `UnitTranslation` and keep credits in `CreditAttribution`.
- [x] 3.6 Add server-side validation that game system requirement raw text is stored only in requirement rows, not in `UnitTranslation.extra`.
- [x] 3.7 Mount new or updated domain APIs from `package/server/src/index.ts`.
- [x] 3.8 Add targeted server tests for GAME/MEDIA DTO mapping, platform/rating relation writes, system requirements, and work-domain resolution.

## 4. Search And Job Runner

- [x] 4.1 Update `package/search` content document builders to project GAME platform Entity ids, external rating tag ids, release metadata, and system requirement summaries.
- [x] 4.2 Update MEDIA search projection for kind key, external rating tag ids, runtime summary, release metadata, and content-structure availability.
- [x] 4.3 Update Meilisearch filterable/sortable attributes for new GAME/MEDIA projected fields.
- [x] 4.4 Update server content search API filters to apply `platformEntityIds` and route age-rating filtering through the existing rating tag filter.
- [x] 4.5 Add job-runner repair paths for platform/rating backfill drift and GAME/MEDIA search document rebuilds.
- [x] 4.6 Add search tests covering platform filter, rating tag filter, work grouping, and GAME/MEDIA result metadata.
- [x] 4.7 Adopt the exact-vs-work-domain list/search naming from `clarify-release-vs-work-list-scopes` (`*UnitId`/`containsUnitId` exact, `*WorkUnitId`/`containsWorkUnitId` work-domain) in GAME/MEDIA surfaces, and reuse `containsReleaseUnitId`/`relatedWorkUnitId` for Series/franchise lookups.

## 5. Content Structure Integration

- [x] 5.1 Update GAME/MEDIA content-structure mappers so DLC, expansions, seasons, episodes, volumes, and specials are represented as Units through `contentUnitId`.
- [x] 5.2 Remove or demote code paths that treat `episodeCount`, `seasonCount`, or future part-count fields as canonical part identity.
- [x] 5.3 Add tests that a game DLC Unit and media episode Unit can be listed through release content structure and targeted through `targetUnitId` interactions.

## 6. API Client And Frontend Readiness

- [ ] 6.1 Update `package/api` clients, query keys, and hooks for GAME/MEDIA DTOs, platform/rating filters, and system requirement reads.
- [ ] 6.2 Update frontend search/filter models to use Entity-backed platform and age-rating ids.
- [ ] 6.3 Add placeholder data integration points for future GAME/MEDIA detail pages using the book-like hero plus multi-tab layout direction.
- [ ] 6.4 Document that trailer/screenshot/carousel hero content is domain media and not part of this backend implementation.
- [ ] 6.5 Add frontend type-level or unit tests for DTO consumption and search filter state where existing patterns support it.

## 7. Admin And Import Readiness

- [ ] 7.1 Add admin-facing read/list endpoints or service methods for platform Entities, external rating tags, and system requirement rows.
- [ ] 7.2 Add source evidence handling so imported requirements can reference `UnitExternalRef` records.
- [ ] 7.3 Add drift diagnostics for legacy platform/rating rows, missing platform Entities, missing rating tags, and search projection mismatch.
- [ ] 7.4 Document import-source expectations for IGDB, Steam, TMDB, IMDb, and PCGamingWiki without implementing crawlers/importers.

## 8. Verification

- [ ] 8.1 Run targeted contract tests for GAME/MEDIA schemas and system requirements.
- [ ] 8.2 Run targeted server tests for game/media services, migrations, and APIs.
- [ ] 8.3 Run targeted search tests for projection and filters.
- [ ] 8.4 Run `bun run check:convention` and fix any repo convention violations introduced by the change.
- [ ] 8.5 Run `bun run format:check` or format changed files with Biome.
- [ ] 8.6 Run a repo-wide search for removed legacy names such as `GamePlatform`, `platformKey`, and `ageRatingKey` and migrate remaining internal callsites intentionally.
