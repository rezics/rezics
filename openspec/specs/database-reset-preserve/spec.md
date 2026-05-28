# database-reset-preserve Specification

## Purpose

Defines the `database-reset` seed utility and the
`seed:database-reset` script. Owns the rename from
`databaseReset.ts`, the default behavior that wipes mock data
while preserving cross-seeded infrastructure (seed users,
content-type tags, official realm, their translations / language
support / self-tags / owner membership, and `infra:*` EchoKV
keys), the `--all` flag for a full wipe, and the JSDoc contract
on `resetDatabase()`, `resetDatabasePreserveInfra()`, and the CLI
entry point.

## Requirements

### Requirement: File and script rename from databaseReset to database-reset

The seed utility file SHALL be renamed from `databaseReset.ts` to `database-reset.ts` in `package/server/prisma/seed/utils/`. The `package.json` script SHALL be renamed from `seed:databaseReset` to `seed:database-reset`.

#### Scenario: Script invocation with new name

- **WHEN** a developer runs `bun run seed:database-reset`
- **THEN** the database reset script SHALL execute successfully

#### Scenario: Old script name no longer works

- **WHEN** a developer runs `bun run seed:databaseReset`
- **THEN** the command SHALL fail (script no longer exists)

### Requirement: Default reset preserves cross-seeded infrastructure

When `database-reset` is run without the `--all` flag, the reset SHALL preserve cross-seeded infrastructure. The system SHALL snapshot the following before wiping: seed users (identified by the 4 hardcoded email addresses), content-type tags (identified by `type=TAG` + `isLanguageNeutral=true` + known canonical titles), the official realm (`isOfficial=true`), associated `UnitTranslation` and `UnitSupportLanguage` records, self-referencing `UnitTag` entries for tags, `RealmMember` owner entry for the realm, and `EchoKV` entries with keys starting with `infra:`. After the wipe, all snapshotted data SHALL be reinserted in FK-safe order.

#### Scenario: Reset preserves seed users

- **WHEN** `database-reset` runs without `--all`
- **AND** the database contains the 4 seed users (root, admin, regular, blocked)
- **THEN** after reset, all 4 seed users SHALL exist with their original `unitId` values

#### Scenario: Reset preserves content-type tags

- **WHEN** `database-reset` runs without `--all`
- **AND** 5 content-type tags exist (Book, Game, Media, Post, Link)
- **THEN** after reset, all 5 tags SHALL exist with their original IDs, translations, and self-tag UnitTag entries

#### Scenario: Reset preserves official realm

- **WHEN** `database-reset` runs without `--all`
- **AND** an official realm exists with the root user as owner
- **THEN** after reset, the official realm SHALL exist with its original ID, translation, Realm extension, and RealmMember owner entry

#### Scenario: Reset preserves EchoKV infrastructure entries

- **WHEN** `database-reset` runs without `--all`
- **AND** `infra:seed_tags` and `infra:default_realm` EchoKV entries exist
- **THEN** after reset, both EchoKV entries SHALL exist with their original values

#### Scenario: Reset removes all mock data

- **WHEN** `database-reset` runs without `--all`
- **AND** the database contains 100 mock books, 50 shelves, 200 mock users, etc.
- **THEN** after reset, no mock data SHALL remain (only the preserved infrastructure)

### Requirement: Full wipe with --all flag

When `database-reset --all` is passed, the reset SHALL wipe everything including cross-seeded infrastructure. This is the current `resetDatabase()` behavior with no preservation.

#### Scenario: Full wipe removes everything

- **WHEN** `database-reset --all` runs
- **THEN** all tables SHALL be empty after the reset (including User, EchoKV, etc.)
- **AND** the developer MUST rerun `seed:cross` before mock seeding

### Requirement: JSDoc on reset functions and CLI entry point

The `resetDatabase()` and `resetDatabasePreserveInfra()` functions SHALL have JSDoc comments describing their purpose, parameters, and usage. The CLI entry point (`database-reset.ts`) SHALL have a top-level JSDoc describing the script, available flags, and example invocations.

#### Scenario: JSDoc on CLI entry point

- **WHEN** a developer opens `database-reset.ts`
- **THEN** they SHALL see a JSDoc comment at the top of the file explaining:
  - What the script does (reset mock data, preserve infrastructure)
  - Available flags (`--all` for full wipe)
  - Example usage (`bun run seed:database-reset`, `bun run seed:database-reset --all`)
  - What constitutes "infrastructure" (users, tags, realm, EchoKV)
