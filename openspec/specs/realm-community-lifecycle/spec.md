# realm-community-lifecycle Specification

## Purpose
TBD - created by archiving change complete-realm-community-governance. Update Purpose after archive.
## Requirements
### Requirement: Realms support rules acknowledgement

Realms SHALL support versioned rules and configurable acknowledgement before joining, first posting, or continuing after a material rule update.

#### Scenario: User must accept updated rules

- **GIVEN** a realm requires acknowledgement for rule version 3
- **WHEN** a member who last accepted version 2 attempts to post
- **THEN** the composer SHALL block submission until the member acknowledges version 3

### Requirement: Realm rules use UnitTranslation-aware POST Unit content

Realm rule content SHALL be anchored by `Realm.extra.rule` referencing a stable POST Unit. The rule Unit SHALL resolve localized rule display/body content through UnitTranslation fallback, and MAY use each UnitTranslation's `sourceUnitId` to point at the language-specific rule Post that carries the full rule body. Keeping the rule identity as a POST Unit preserves existing realm-extra validation, post editing, history, and moderation behavior.

#### Scenario: Rule content resolves in the viewer locale

- **GIVEN** a realm's rule Unit has UnitTranslation rows for `"zh-hant"` and `"en"`
- **AND** the `"zh-hant"` translation points to a Traditional Chinese rule Post through `sourceUnitId`
- **WHEN** a Traditional Chinese viewer opens the rule acknowledgement dialog
- **THEN** the dialog SHALL render the Traditional Chinese rule content
- **AND** acknowledgement SHALL be recorded for the rule Unit and version rather than for a locale-specific Post id

### Requirement: Realm rule acknowledgement is versioned by rule identity

Rule acknowledgement state SHALL include realm id, rule Unit id, rule version, user id, accepted time, and MAY record accepted language for audit. The accepted language SHALL NOT be treated as the canonical rule version.

#### Scenario: Locale changes do not invalidate accepted rule version

- **GIVEN** a member accepted rule Unit `R` at version 4 while browsing in English
- **WHEN** they later browse the realm in Japanese
- **THEN** the member SHALL remain acknowledged for version 4
- **AND** the UI SHALL render Japanese rule content when available

### Requirement: Realm content supports pin, lock, and archive lifecycle

Realm-scoped content SHALL support pinned, locked, and archived states without changing the underlying content's global publication state unless a separate moderation decision does so.

#### Scenario: Locked thread blocks replies

- **GIVEN** a realm thread is locked
- **WHEN** a regular member attempts to reply
- **THEN** the server SHALL reject the reply
- **AND** moderators SHALL still see the lock state and available actions

### Requirement: Realm pinboard reuses Realm.extra list primitives

Realm pinned content SHALL use the ordered `Realm.extra.pinboard` Unit id list and existing realm-extra append, remove, reorder, stale cleanup, and visibility filtering primitives. Realm governance MAY add policy checks, audit events, and richer DTOs, but SHALL NOT introduce a separate pin ordering source of truth.

#### Scenario: Moderator reorders pinboard

- **WHEN** a realm moderator reorders pinned Units
- **THEN** the server SHALL persist the new order through the Realm.extra pinboard list primitive
- **AND** a realm governance event SHALL record the pinboard reorder

### Requirement: Realm announcements do not duplicate pinboard infrastructure

General realm announcements SHALL be modeled as normal realm Posts and surfaced through feed, tag, notification, or pinboard flows. `Realm.extra.announcement` SHALL keep its existing role as an ordered Unit id list for special announcement surfaces and SHALL NOT become a second general-purpose realm announcement system.

#### Scenario: Moderator announces an event

- **WHEN** a moderator publishes an event announcement for a realm
- **THEN** the announcement SHALL be a normal realm Post
- **AND** the moderator MAY pin it through `Realm.extra.pinboard` when it should appear in the realm Pinboard

### Requirement: Member state controls realm participation

Realm membership SHALL support active, pending, muted, removed, and banned states where configured.

#### Scenario: Muted member can read but not post

- **GIVEN** a member is muted in a realm
- **WHEN** they view realm content
- **THEN** reading SHALL remain allowed according to realm visibility
- **AND** posting, replying, and tag curation SHALL be denied
