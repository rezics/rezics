## ADDED Requirements

### Requirement: Content-type tag seeding with database-generated IDs

The seed system SHALL create content-type tags (book, game, media, post, link) as `Unit` records with `type = TAG`, letting the database generate UUIDv7 IDs. The seed script MUST NOT supply explicit `id` values.

Each tag SHALL have a `UnitTranslation` with the platform default language (`zh-hant`) using the canonical title, and an `en` translation with the English title. Tags SHALL have `isLanguageNeutral: true`, `status: PUBLISHED`, `visibility: PUBLIC`.

Each tag SHALL receive a self-referencing `UnitTag` entry with `score = SEED_TAG_SCORE` (1000) for official boost.

#### Scenario: First run — tags do not exist

- **WHEN** the seed script runs and no content-type tags exist in the database
- **THEN** the system creates 5 tag Units with database-generated v7 IDs, translations in `zh-hant` and `en`, and self-tag score boost

#### Scenario: Subsequent run — tags already exist

- **WHEN** the seed script runs and content-type tags already exist (matched by English title + type TAG)
- **THEN** the system skips creation and uses the existing IDs for EchoKV registration

### Requirement: Default realm seeding

The seed system SHALL create a single official default realm as a `Unit` with `type = REALM`, owned by the root seed user. The realm SHALL have `isPublic: true` and `isOfficial: true`, with `memberCount: 1` and the root user as owner member.

The seed SHALL import `DEFAULT_REALM` from `@rezics/contract` and use its `translations` record to create `UnitTranslation` rows. Translations SHALL be created for all languages defined in `DEFAULT_REALM.translations` (en, zh-hant, ja). The seed SHALL also create `UnitSupportLanguage` rows for all three languages.

The seed SHALL NOT hardcode translation strings — the contract is the single source of truth.

#### Scenario: First run — no official realm exists

- **WHEN** the seed script runs and no realm with `isOfficial: true` exists
- **THEN** the system creates the default realm with the root user as owner, with translations for en, zh-hant, and ja imported from `DEFAULT_REALM.translations`

#### Scenario: Subsequent run — official realm exists

- **WHEN** the seed script runs and an official realm already exists
- **THEN** the system skips creation and uses the existing realm's ID for EchoKV registration

#### Scenario: Translation languages match contract

- **WHEN** the seed creates the default realm
- **THEN** the number of `UnitTranslation` rows matches the number of keys in `DEFAULT_REALM.translations` (currently 3)

### Requirement: EchoKV infrastructure registry

After seeding tags and the default realm, the seed system SHALL upsert EchoKV entries to register their IDs.

The key `infra:seed_tags` SHALL contain a JSON map of tag name to UUIDv7:

```json
{ "book": "<uuid>", "game": "<uuid>", "media": "<uuid>", "post": "<uuid>", "link": "<uuid>" }
```

The key `infra:default_realm` SHALL contain:

```json
{ "id": "<uuid>" }
```

#### Scenario: EchoKV entries created on seed

- **WHEN** the seed script completes infrastructure seeding
- **THEN** both `infra:seed_tags` and `infra:default_realm` keys exist in EchoKV with correct IDs

#### Scenario: EchoKV entries updated on re-seed

- **WHEN** the seed script runs again with existing infrastructure
- **THEN** EchoKV entries are upserted with the same IDs (idempotent)

### Requirement: Remove compile-time seed tag IDs from contract

`@rezics/contract/seed-tags.ts` MUST NOT export `SEED_TAG_IDS`, `uuidv5()`, `buildSeedTagId()`, or `SEED_TAG_NAMESPACE`. These SHALL be removed entirely.

The following exports SHALL be preserved: `SEED_TAG_NAMES`, `SeedTagName`, `SEED_TAG_TITLES`, `SEED_TAG_SCORE`.

#### Scenario: Consumer importing SEED_TAG_IDS

- **WHEN** any package imports `SEED_TAG_IDS` from `@rezics/contract`
- **THEN** it SHALL fail at compile time (export no longer exists)

### Requirement: Frontend resolves tag IDs via EchoKV

The collection modal SHALL fetch tag IDs from EchoKV (`infra:seed_tags`) at runtime instead of importing compile-time constants. Filter chips SHALL render using `SEED_TAG_NAMES` and `SEED_TAG_TITLES` from `@rezics/contract`. Tag ID resolution for shelf filtering SHALL use the EchoKV response.

#### Scenario: Collection modal filters shelves by content type

- **WHEN** the user selects a content-type filter chip (e.g., "Book")
- **THEN** the modal filters shelves by matching `tags[].tagUnitId` against the EchoKV-provided UUID for that tag name

#### Scenario: EchoKV data not yet loaded

- **WHEN** the EchoKV query is still loading or has failed
- **THEN** content-type filter chips SHALL still render but filtering by tag SHALL be disabled (show all shelves)

### Requirement: Shared infrastructure seed module

A shared module (`tool/seed/lib/seed-infra.ts`) SHALL encapsulate all infrastructure seeding logic. Both `tool/seed/cross-seed.ts` and `package/server/prisma/seed/mock/seed.ts` SHALL use this module. The existing `package/server/prisma/seed/mock/seed-tags.ts` SHALL be removed.

#### Scenario: Mock seed uses shared module

- **WHEN** the mock seed script runs
- **THEN** it calls the shared infrastructure seed module instead of its own tag creation logic

#### Scenario: Cross-seed uses shared module

- **WHEN** the cross-seed script runs
- **THEN** it calls the shared infrastructure seed module after user seeding
