## ADDED Requirements

### Requirement: Content-type tag seeding with database-generated IDs and contract slugs

The seed system SHALL create content-type tags (book, game, media, post, link) as `Unit` records with `type = TAG`, letting the database generate UUIDv7 IDs. The seed script MUST NOT supply explicit `id` values.

Each tag SHALL have its `Unit.slug` field set to the corresponding value from `SEED_TAG_SLUGS` exported by `@rezics/contract` (e.g., the "book" tag SHALL have `slug = "book"`). The slug is the stable cross-environment identifier — the UUIDv7 is the runtime handle.

Each tag SHALL have a `UnitTranslation` with the platform default language (`zh-hant`) using the canonical title, and an `en` translation with the English title. Tags SHALL have `isLanguageNeutral: true`, `status: PUBLISHED`, `visibility: PUBLIC`.

Each tag SHALL receive a self-referencing `UnitTag` entry with `score = SEED_TAG_SCORE` (1000) for official boost.

#### Scenario: First run — tags do not exist

- **WHEN** the seed script runs and no content-type tags exist in the database
- **THEN** the system creates 5 tag Units with database-generated v7 IDs, `slug` set to the contract value, translations in `zh-hant` and `en`, and self-tag score boost

#### Scenario: Subsequent run — tags already exist

- **WHEN** the seed script runs and content-type tags already exist (matched by `Unit.slug` against `SEED_TAG_SLUGS`)
- **THEN** the system skips creation and uses the existing IDs

#### Scenario: Seed tag slug matches contract

- **WHEN** the seed creates the "book" content-type tag
- **THEN** `Unit.slug` SHALL equal `SEED_TAG_SLUGS.book`

### Requirement: Default realm seeding

The seed system SHALL create a single official default realm as a `Unit` with `type = REALM`, owned by the root seed user. The realm SHALL have `isPublic: true` and `isOfficial: true`, with `memberCount: 1` and the root user as owner member.

The `Unit.slug` field SHALL be set to `DEFAULT_REALM.slug` exported by `@rezics/contract` (currently `"rezics"`).

The seed SHALL import `DEFAULT_REALM` from `@rezics/contract` and use its `translations` record to create `UnitTranslation` rows. Translations SHALL be created for all languages defined in `DEFAULT_REALM.translations` (en, zh-hant, ja). The seed SHALL also create `UnitSupportLanguage` rows for all three languages.

The seed SHALL NOT hardcode translation strings — the contract is the single source of truth.

#### Scenario: First run — no official realm exists

- **WHEN** the seed script runs and no realm with `isOfficial: true` exists
- **THEN** the system creates the default realm with the root user as owner, with `Unit.slug = "rezics"` and translations for en, zh-hant, and ja imported from `DEFAULT_REALM.translations`

#### Scenario: Subsequent run — official realm exists

- **WHEN** the seed script runs and an official realm already exists
- **THEN** the system skips creation and uses the existing realm's ID

#### Scenario: Default realm slug matches contract

- **WHEN** the seed creates the default realm
- **THEN** `Unit.slug` SHALL equal `DEFAULT_REALM.slug`

#### Scenario: Translation languages match contract

- **WHEN** the seed creates the default realm
- **THEN** the number of `UnitTranslation` rows matches the number of keys in `DEFAULT_REALM.translations` (currently 3)

### Requirement: Remove compile-time seed tag IDs from contract

`@rezics/contract/seed-tags.ts` MUST NOT export `SEED_TAG_IDS`, `uuidv5()`, `buildSeedTagId()`, or `SEED_TAG_NAMESPACE`. These SHALL be removed entirely.

The following exports SHALL be preserved: `SEED_TAG_NAMES`, `SeedTagName`, `SEED_TAG_TITLES`, `SEED_TAG_SCORE`.

#### Scenario: Consumer importing SEED_TAG_IDS

- **WHEN** any package imports `SEED_TAG_IDS` from `@rezics/contract`
- **THEN** it SHALL fail at compile time (export no longer exists)

### Requirement: Shared infrastructure seed module lives in the server package

A shared module at `package/server/prisma/seed/infra/` SHALL encapsulate all infrastructure seeding logic (content-type tags, default realm, and any future infra content).

Both the cross-database seed CLI (`bun run seed`, entry: `package/utils/bin/cli.ts` → `seed/index.ts`) and the factory orchestrator (`package/server/prisma/factory/orchestrator.ts`) SHALL invoke this shared module rather than maintaining independent implementations.

The module SHALL export a single entry point (e.g., `seedInfra(prisma, rootUserId)`) that performs all infra seeding steps in the correct order.

The factory orchestrator (`runFactorySeed`) SHALL execute steps in the following order to ensure data dependencies are satisfied:

1. Reset
2. Users + Entities (parallel)
3. Infra (content-type tags + default realm) via shared module
4. Random factory Tags (non-infra)
5. Works — Books, Games, Media (parallel)
6. Scores (needs realms + works)
7. Posts (needs works, users, scores)
8. Shelves + additional Realms (parallel; shelves need works + posts)
9. Chapters (needs books)
10. Engagement (needs all unit IDs)
11. Zones (needs works, tags)

#### Scenario: Factory seed uses shared infra module

- **WHEN** the factory seed runs (`bun run seed:factory`)
- **THEN** it calls `package/server/prisma/seed/infra/` instead of its own tag creation logic

#### Scenario: Cross-seed uses shared infra module

- **WHEN** the cross-seed flow runs (`bun run seed`)
- **THEN** it imports and invokes `package/server/prisma/seed/infra/` after user seeding

#### Scenario: Old seed-infra module is removed

- **WHEN** the refactor is complete
- **THEN** `tool/seed/lib/seed-infra.ts` SHALL NOT exist

#### Scenario: Shelves are seeded after posts

- **WHEN** the seed pipeline executes
- **THEN** shelf seeding SHALL occur after post seeding so that review posts are available for ShelfItemReview creation

### Requirement: Shelf seed receives review posts

The `seedShelves` function SHALL receive the list of created review posts (not an empty array). For each shelf item, the seeder SHALL probabilistically attach matching review posts via the `ShelfItemReview` junction table.

#### Scenario: ShelfItemReview records are created

- **WHEN** shelves are seeded with available review posts
- **THEN** at least some shelf items SHALL have associated `ShelfItemReview` records linking to actual review posts

#### Scenario: Review matching by target work

- **WHEN** a shelf item references work X and a review post targets work X
- **THEN** the `ShelfItemReview` record SHALL link the shelf item to that review post

### Requirement: Shelf extra field population

The shelf seeder SHALL populate the `extra` JSON field on approximately 30% of shelves. The extra field SHALL contain metadata such as custom display settings, sort preferences, or theme overrides.

#### Scenario: Shelf with extra metadata

- **WHEN** a shelf is seeded with extra data
- **THEN** the `extra` JSON field SHALL contain at least one property

#### Scenario: Shelf without extra metadata

- **WHEN** a shelf is seeded without extra data
- **THEN** the `extra` field SHALL be `null`

### Requirement: Scaled default counts

The default seed counts SHALL be updated to the following values:

| Key | Old Default | New Default |
|-----|-------------|-------------|
| books | 100 | 1000 |
| games | 50 | 1000 |
| media | 50 | 1000 |
| shelves | 100 | 500 |
| personEntities | 300 | 800 |
| organizationEntities | 50 | 200 |
| zones | (new) | 40 |

The `reviewsPerWork`, `treePostsPerWork`, `quotesPerWork`, and `remarksPerWork` fixed counts SHALL be removed from `SeedCounts` and replaced by power-law distribution calls within each seeder.

#### Scenario: Default book count is 1000

- **WHEN** the seed runs without `SEED_BOOKS` env var
- **THEN** approximately 1000 books SHALL be created

#### Scenario: Per-work counts removed from config

- **WHEN** the `SeedCounts` interface is inspected
- **THEN** it SHALL NOT contain `reviewsPerWork`, `treePostsPerWork`, `quotesPerWork`, or `remarksPerWork` fields

#### Scenario: Env var overrides still work

- **WHEN** the seed runs with `SEED_BOOKS=50`
- **THEN** approximately 50 books SHALL be created (override respected)

### Requirement: Entity verified diversity

The entity seed SHALL set `verified: true` on approximately 5% of person entities and 10% of organization entities.

#### Scenario: Some persons are verified

- **WHEN** 800 person entities are seeded
- **THEN** approximately 40 (5%) SHALL have `verified: true`

#### Scenario: Some organizations are verified

- **WHEN** 200 organization entities are seeded
- **THEN** approximately 20 (10%) SHALL have `verified: true`
