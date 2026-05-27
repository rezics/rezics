## ADDED Requirements

### Requirement: Realm management console lives in package/app

The realm owner/admin/moderator console SHALL live under realm product routes in `package/app`, not under `package/admin`.

#### Scenario: Moderator opens realm queue

- **WHEN** a moderator opens `/r/:realmSlug/manage/moderation`
- **THEN** the page SHALL show the realm moderation queue for that realm
- **AND** it SHALL NOT navigate to the admin app

### Requirement: Console covers operational realm tasks

The console SHALL include sections for overview, rules, members, moderation queue, pinned/announcement content, tag curation, settings, and ownership transfer/deletion where allowed.

#### Scenario: Owner edits rules

- **WHEN** a realm owner updates rules in the console
- **THEN** the server SHALL persist the rule Unit, localized rule content references, and rule version policy
- **AND** members SHALL be prompted to acknowledge material rule changes when required

### Requirement: Console supports realm i18n editing

Realm management SHALL support editing multilingual realm-owned content, including realm title/summary/description, rule translations, about content, pinboard item translations where the item is created from the pinboard editor, and tag tree group/category labels. Editing surfaces SHALL reuse the existing UnitTranslation editor/resolution patterns instead of adding realm-only language fields.

#### Scenario: Owner adds a Japanese rule translation

- **GIVEN** a realm rule Unit has English rule content
- **WHEN** the owner adds a Japanese translation in the rules management section
- **THEN** the system SHALL create or update the Japanese UnitTranslation for the rule Unit
- **AND** the translation MAY point to a Japanese rule Post through `sourceUnitId`

### Requirement: Console configures tag tab display

Realm management SHALL expose the realm tag tab's default display style: `flat`, `grouped`, or `tree`, and whether viewers may switch display styles. Creation and settings flows SHALL default to `flat` unless the owner chooses another style.

#### Scenario: Owner chooses grouped tags during realm creation

- **WHEN** an owner creates a realm and selects grouped tag navigation
- **THEN** the realm SHALL store grouped as the tag tab default style
- **AND** the Tags tab SHALL render grouped category panels when tagTree data exists

### Requirement: Console follows Rezics app design density

Realm management UI SHALL use product-side Rezics design-system rhythm and `@rezics/ui` primitives. It SHALL not mimic the compact operator density of `package/admin`.

#### Scenario: Management page renders states

- **WHEN** queue data is loading, empty, denied, or failed
- **THEN** the page SHALL render accessible state content using shared UI primitives and Traditional Chinese copy where localized
