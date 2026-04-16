## MODIFIED Requirements

### Requirement: Content sync populates structured translations from Prisma relations

The `buildContentDocument()` function SHALL map each Prisma translation relation into the `translations` array, preserving the `language`, `title`, `subtitle`, `summary`, and `description` fields from each `UnitTranslation` record.

The credit fields in ContentSearchDocument SHALL be populated from the unified `Attribution` table instead of separate `PersonCredit` and `OrgCredit` tables. Attribution data SHALL include the entity's resolved name (from `UnitTranslation.title` on the Entity's unit) and kind.

#### Scenario: Sync maps all translation fields

- **WHEN** a unit has a translation with `language: "en"`, `title: "My Book"`, `subtitle: "A Story"`, `summary: "Long text"`, `description: "Short text"`
- **THEN** the corresponding entry in `translations` SHALL contain all five fields with their values

#### Scenario: Sync handles nullable fields

- **WHEN** a unit has a translation with `language: "en"`, `title: "My Book"`, `subtitle: null`, `summary: null`, `description: null`
- **THEN** the corresponding entry in `translations` SHALL contain `language: "en"`, `title: "My Book"`, and null values for the remaining fields

#### Scenario: Sync populates credits from Attribution table

- **WHEN** a unit has Attribution records linking to Entity units with translated names
- **THEN** the `patchContentCreditsToMeili` function SHALL read from the `Attribution` table
- **AND** resolve entity names from `UnitTranslation.title` on each referenced Entity unit
- **AND** the indexed credit data SHALL include the entity's name, role, and kind
