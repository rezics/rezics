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

### Requirement: Two-phase user seeding (auth then main)

The user seed pipeline SHALL execute in two strict phases. Phase 1 (`seedAllAuthUsers`) SHALL create every seed user in the auth database and capture a deterministic `{ email, authUserId, name, slug }` result map. Phase 2 (`seedAllMainUsers`) SHALL consume that map to create or upsert the corresponding main `User` rows, with `userId === authUserId` and `authUserId` set on the main row. Phase 2 SHALL NOT begin before phase 1 completes successfully. The pipeline SHALL NOT interleave auth and main writes per user.

#### Scenario: Auth phase completes before main phase

- **WHEN** the seed CLI runs the user pipeline
- **THEN** every auth user is created (phase 1) before any main user is touched (phase 2)
- **AND** phase 2 receives a populated email→authUserId map produced by phase 1

#### Scenario: Phase 1 failure leaves no main users half-written

- **WHEN** phase 1 fails part-way (e.g., a transient auth DB error)
- **THEN** phase 2 SHALL NOT execute
- **AND** the pipeline reports the phase 1 failure with no orphan main rows attributed to the failed batch

#### Scenario: Idempotent re-run on partial completion

- **WHEN** phase 1 succeeded but phase 2 was interrupted, and the CLI is re-run
- **THEN** phase 1 SHALL upsert by email (no duplicate auth users)
- **AND** phase 2 SHALL upsert by `userId` (no duplicate main users)
- **AND** the pipeline reaches a clean fully-seeded state

### Requirement: Factory mock users cross-seed auth

The factory mock user seeder (`package/server/prisma/factory/users.ts`) SHALL create an auth `User` for every mock user it produces, using the same `seedAuthUser` helper as the cross-seed pipeline. Each mock user's main row SHALL be created with `userId === authResult.userId` and `authUserId === authResult.userId`. Mock users SHALL be capable of completing a full sign-in round-trip after seeding.

#### Scenario: Mock user has corresponding auth row

- **WHEN** the factory seed creates a mock user
- **THEN** an auth `User` row SHALL exist with the mock user's email
- **AND** the main `User.userId` SHALL equal that auth `User.id`

#### Scenario: Mock user can sign in

- **WHEN** the factory seed completes
- **THEN** any seeded mock user SHALL be able to authenticate against the auth service using the seed-assigned credentials
- **AND** the cookie-boundary refresh SHALL issue a `rezics-session-token` for the user (assuming `slug !== null`)

#### Scenario: SeedCtx carries authPrisma

- **WHEN** the factory orchestrator dispatches the user seeding step
- **THEN** the `SeedCtx` passed to the strategy SHALL include an `authPrisma` client
- **AND** `seedUsers(ctx, spec)` SHALL call `seedAuthUser(ctx.authPrisma, ...)` before writing to the main DB

### Requirement: Reset clears both databases

`resetDatabase` (the seed CLI's reset action) SHALL truncate or drop-and-recreate user-related state in both the auth database and the server database, so that a `--reset` followed by `--seed` produces a clean, internally consistent two-database state. The current implementation that resets only the server DB SHALL be extended to cover the auth DB.

#### Scenario: Reset clears auth users

- **WHEN** the seed CLI is invoked with reset
- **THEN** auth `User`, `Session`, `Account`, and verification rows for seed users SHALL be cleared
- **AND** main `User` rows SHALL also be cleared

#### Scenario: Reset preserves non-user infra

- **WHEN** the reset runs
- **THEN** infra-only rows that survive non-user resets (e.g., default realm, content-type tags) MAY be preserved according to the existing `database-reset-preserve` capability
- **AND** the reset SHALL NOT drop the underlying schema unless explicitly requested

### Requirement: Seed users do not write accountStatus

Seed and factory writers SHALL NOT supply an `accountStatus` field on `prisma.user.create` or `prisma.user.upsert`. The `User.accountStatus` column has been removed; readiness is conveyed by `slug !== null`. Seeded users that should be member-ready SHALL be written with their canonical slug; setup-stage seed users (if any) SHALL be written with `slug: null`.

#### Scenario: Member-ready seed user has slug

- **WHEN** a seed function creates a member-ready user (e.g., root, admin, regular)
- **THEN** the create payload SHALL include the canonical `slug`
- **AND** it SHALL NOT include any `accountStatus` field

#### Scenario: TypeScript blocks accidental accountStatus writes

- **WHEN** a developer attempts to write `accountStatus: "MEMBER_READY"` in a seed function
- **THEN** TypeScript SHALL surface a type error (the field does not exist on the Prisma user model after migration)

### Requirement: Seeded publishable units carry publication defaults
The seed system SHALL write the platform default publication license slug onto seeded publishable Unit rows instead of relying on nullable fallback behavior.

#### Scenario: Factory seed creates publishable content
- **WHEN** the factory seed creates a `BOOK`, `GAME`, `MEDIA`, `POST`, or `SHELF` Unit
- **THEN** the Unit SHALL store `licenseSlug = "all-rights-reserved"`

#### Scenario: Seeded publishing defaults are available for composer flows
- **WHEN** infra and user seeds create default demo records
- **THEN** at least one seeded user and the default official realm SHALL expose a valid publishing default license slug

### Requirement: Entity seed populates role eligibility

The seed system SHALL populate `eligibleCreditRoles` and `eligibleSubjectRoles` for seeded Entities using explicit role arrays derived from seed data or creation-time kind suggestions. The seed SHALL persist those arrays on Entity rows and SHALL NOT rely on backend read-time inference from `kind`.

#### Scenario: Person seed includes credit eligibility

- **WHEN** the seed creates a person Entity intended for creator credits
- **THEN** the Entity SHALL include relevant values in `eligibleCreditRoles`
- **AND** those values SHALL be persisted on the Entity row

#### Scenario: Character seed includes subject eligibility

- **WHEN** the seed creates a character Entity
- **THEN** the Entity SHALL include character subject roles in `eligibleSubjectRoles`
- **AND** it SHALL NOT include real-world credit roles such as `author` unless seed data explicitly marks the Entity eligible

### Requirement: Entity seed synchronizes Meili entity documents

When seed execution includes Meilisearch synchronization, the seed system SHALL synchronize seeded Entity documents into the `entities` index after Entity rows and translations are created. The synchronized documents SHALL include eligibility arrays.

#### Scenario: Seeded entity appears in EntityPicker search

- **WHEN** seeding completes with Meili synchronization enabled
- **AND** a seeded Entity has `eligibleCreditRoles = ["author"]`
- **THEN** an EntityPicker search for author-eligible Entities SHALL be able to return that Entity from Meilisearch
