## MODIFIED Requirements

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

The seed system SHALL create a single official default realm as a `Unit` with `type = REALM`, owned by the root seed user. The realm SHALL have `isPublic: true` and `isOfficial: true`, with `memberCount: 1` and the root user as owner member. The realm translation SHALL use canonical language code `zh-hant` (with title "rezics") and an `en` translation.

#### Scenario: First run — no official realm exists

- **WHEN** the seed script runs and no realm with `isOfficial: true` exists
- **THEN** the system creates the default realm with the root user as owner, with translations in `zh-hant` and `en`

#### Scenario: Subsequent run — official realm exists

- **WHEN** the seed script runs and an official realm already exists
- **THEN** the system skips creation and uses the existing realm's ID for EchoKV registration
