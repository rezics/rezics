## ADDED Requirements

### Requirement: Realms support rules acknowledgement

Realms SHALL support versioned rules and configurable acknowledgement before joining, first posting, or continuing after a material rule update.

#### Scenario: User must accept updated rules

- **GIVEN** a realm requires acknowledgement for rule version 3
- **WHEN** a member who last accepted version 2 attempts to post
- **THEN** the composer SHALL block submission until the member acknowledges version 3

### Requirement: Realm content supports pin, lock, and archive lifecycle

Realm-scoped content SHALL support pinned, locked, and archived states without changing the underlying content's global publication state unless a separate moderation decision does so.

#### Scenario: Locked thread blocks replies

- **GIVEN** a realm thread is locked
- **WHEN** a regular member attempts to reply
- **THEN** the server SHALL reject the reply
- **AND** moderators SHALL still see the lock state and available actions

### Requirement: Member state controls realm participation

Realm membership SHALL support active, pending, muted, removed, and banned states where configured.

#### Scenario: Muted member can read but not post

- **GIVEN** a member is muted in a realm
- **WHEN** they view realm content
- **THEN** reading SHALL remain allowed according to realm visibility
- **AND** posting, replying, and tag curation SHALL be denied
