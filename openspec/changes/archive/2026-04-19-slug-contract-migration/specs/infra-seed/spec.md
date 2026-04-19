## MODIFIED Requirements

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

### Requirement: Shared infrastructure seed module lives in the server package

A shared module at `package/server/prisma/seed/infra/` SHALL encapsulate all infrastructure seeding logic (content-type tags, default realm, and any future infra content).

Both `tool/seed/seed.ts` (cross-database orchestrator) and `package/server/prisma/seed/mocks/seed.ts` (mock-data seeder) SHALL invoke this shared module rather than maintaining independent implementations.

The module SHALL export a single entry point (e.g., `seedInfra(prisma, rootUserId)`) that performs all infra seeding steps in the correct order.

The mock seed orchestrator (`seed.ts`) SHALL execute steps in the following order to ensure data dependencies are satisfied:

1. Reset
2. Users + Entities (parallel)
3. Infra (content-type tags + default realm) via shared module
4. Random mock Tags (non-infra)
5. Works — Books, Games, Media (parallel)
6. Scores (needs realms + works)
7. Posts (needs works, users, scores)
8. Shelves + additional Realms (parallel; shelves need works + posts)
9. Chapters (needs books)
10. Engagement (needs all unit IDs)
11. Zones (needs works, tags)

#### Scenario: Mock seed uses shared infra module

- **WHEN** the mock seed script runs
- **THEN** it calls `package/server/prisma/seed/infra/` instead of its own tag creation logic

#### Scenario: Cross-seed uses shared infra module

- **WHEN** the cross-seed script (`tool/seed/seed.ts`) runs
- **THEN** it imports and invokes `package/server/prisma/seed/infra/` after user seeding

#### Scenario: Old seed-infra module is removed

- **WHEN** the refactor is complete
- **THEN** `tool/seed/lib/seed-infra.ts` SHALL NOT exist

## REMOVED Requirements

### Requirement: EchoKV infrastructure registry

**Reason**: Infrastructure identifiers are now resolved via `Unit.slug`, which is a globally unique, type-gated field that already provides the stable-name-to-UUID mapping that EchoKV was emulating. The keys `infra:seed_tags` and `infra:default_realm` are no longer written, removing an entire indirection layer.

**Migration**:
- Server callers previously reading `echoKV.findUnique({ where: { key: "infra:default_realm" } })` migrate to `prisma.unit.findUnique({ where: { slug: "rezics" } })`.
- Frontend callers previously using `echoKvGetQuery("infra:seed_tags")` / `echoKvGetQuery("infra:default_realm")` migrate to the new `/infra/bootstrap` endpoint (see `typed-slug-lookup` and `default-realm-infra-bootstrap` specs).
- For existing databases, a one-off SQL migration sets `Unit.slug` on existing infra content:
  ```sql
  UPDATE unit SET slug = 'rezics'
  WHERE type = 'REALM' AND "isOfficial" = true;
  -- plus analogous UPDATEs for the five seed tags matched by English title
  ```

### Requirement: Frontend resolves tag IDs via EchoKV

**Reason**: Frontend tag ID resolution now goes through the `/infra/bootstrap` endpoint, stored in a versioned localStorage dictionary (`rezics:infra:v1`). This removes the generic EchoKV query from the collection modal and makes the dependency explicit.

**Migration**: See `default-realm-infra-bootstrap` spec — `useInfraBootstrap` hook replaces the EchoKV-based flow, and `CollectionModal` reads tag IDs from the synchronous `getSeedTagId(name)` accessor.
