## 1. Power-Law Utility & Config Restructure

- [x] 1.1 Add `powerLaw(min, max, alpha)` function to `package/server/prisma/seed/mock/utils.ts` — returns integer from Pareto-like distribution, clamped to [min, max]
- [x] 1.2 Update `SeedCounts` in `types.ts` — remove `reviewsPerWork`, `treePostsPerWork`, `quotesPerWork`, `remarksPerWork`, `chaptersPerBook`; add `zones: number`
- [x] 1.3 Update `config.ts` defaults — books: 1000, games: 1000, media: 1000, shelves: 500, personEntities: 800, organizationEntities: 200, zones: 40; remove per-work count env vars

## 2. Entity Seed Enrichment & Batch Insert

- [x] 2.1 Add `UnitType.ENTITY` case to `pickFromCorpus` in `generators.ts` — return title + description (description from `getSummaryPool`)
- [x] 2.2 Refactor `seedPeople` in `attribution.ts` to use two-phase batch `createMany` (Units → Entity extensions + UnitTranslation + UnitSupportLanguage) with multi-language translations via `generateTranslations(UnitType.ENTITY)`, locale-appropriate faker names per language, and ~5% `verified: true`
- [x] 2.3 Refactor `seedOrganizations` in `attribution.ts` with the same batch pattern, locale-appropriate company names, descriptions, and ~10% `verified: true`

## 3. Tag Description Support

- [x] 3.1 Update `pickFromCorpus` for `UnitType.TAG` to include a `description` field drawn from `getSummaryPool`
- [x] 3.2 Update `seedTags` in `tags.ts` to write `description` in `UnitTranslation` createMany phase

## 4. Zone Seed Module

- [x] 4.1 Create `package/server/prisma/seed/mock/zones.ts` with `seedZones` function — creates Zone units with varied templates (`featured-carousel`, `trending-grid`, `seasonal-banner`, `topic-spotlight`, `new-releases`), filters JSON referencing content types/tags, optional styling, and temporal state distribution (40% always-active, 30% active, 20% scheduled, 10% expired)
- [x] 4.2 Add Zone template/filter/styling data constants to `data.ts` or inline in `zones.ts`
- [x] 4.3 Wire `seedZones` into `seed.ts` orchestrator (after works + tags, before EchoKV)

## 5. Shelf Seed Fix & Enhancement

- [x] 5.1 Reorder `seed.ts` pipeline — move shelf seeding after post seeding so review posts are available
- [x] 5.2 Pass actual review posts (filtered from `posts` by `kind === PostKind.REVIEW`) to `seedShelves` instead of empty array
- [x] 5.3 Replace fixed `randomInt(3, 10)` item count with `powerLaw(3, 150, 1.5)` in `shelves.ts`
- [x] 5.4 Populate `shelf.extra` JSON on ~30% of shelves with display settings / sort preferences
- [ ] 5.5 Verify `ShelfItemReview` records are actually created after the reorder fix

## 6. Power-Law Distribution in Posts

- [x] 6.1 Refactor `seedPostsForWorks` in `posts.ts` — replace fixed `counts.reviews` with per-work `powerLaw(0, 50, 1.8)` call
- [x] 6.2 Replace fixed `counts.treePosts` with per-work `powerLaw(0, 120, 1.8)`
- [x] 6.3 Replace fixed `counts.quotes` with per-work `powerLaw(0, 15, 2.0)` and `counts.remarks` with `powerLaw(0, 10, 2.0)`
- [x] 6.4 For works receiving >20 posts, use batch `createMany` for Unit + Post rows instead of individual creates

## 7. Power-Law Distribution in Chapters

- [x] 7.1 Replace fixed `chaptersPerBook` config with per-book `powerLaw(5, 1200, 2.0)` in `seed.ts` chapter seeding loop
- [x] 7.2 For books with >50 chapters, use batch `createMany` for chapter Unit + UnitTranslation rows
- [x] 7.3 Preserve `BookIndex` JSON tree structure generation for all chapter counts

## 8. Work Seed Scale-Up

- [x] 8.1 Verify `seedBooks`, `seedGames`, `seedMedia` work correctly at 1000-level scale with existing `chunkedParallel`
- [x] 8.2 Batch attribution `createMany` — collect attributions across a chunk of works and insert in one call instead of per-work
- [x] 8.3 Batch `unitTag` createMany — same pattern as attributions

## 9. Seed Orchestrator Update

- [x] 9.1 Update `seed.ts` main function with new pipeline order: Reset → Users + Entities → Tags → Works → Scores → Posts → Shelves + Realms → Chapters → Engagement → Zones → EchoKV
- [x] 9.2 Remove per-work count destructuring from `DEFAULT_COUNTS` usage in `seed.ts` (now handled by powerLaw inside each seeder)
- [x] 9.3 Add Zone step logging and summary output
- [x] 9.4 Update `mock/README.md` with new defaults, distribution model, and pipeline order

## 10. Validation

- [ ] 10.1 Run full seed against a clean database and verify no errors
- [ ] 10.2 Spot-check data distribution — query review counts per work, verify long-tail pattern
- [ ] 10.3 Verify ShelfItemReview records exist in database after seed
- [ ] 10.4 Verify Zone records exist with varied templates and temporal states
- [ ] 10.5 Verify Entity records have multi-language translations and descriptions
- [ ] 10.6 Verify Tag records have descriptions
- [ ] 10.7 Log and report total seed time for performance baseline
