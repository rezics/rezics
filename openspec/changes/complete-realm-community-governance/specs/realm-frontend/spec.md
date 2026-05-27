## MODIFIED Requirements

### Requirement: Realm detail exposes mature community tabs

The realm detail page SHALL expose community tabs for feed, tags, members, rules/about, announcements/pins, and moderator-only queue entry when policy allows.

#### Scenario: Moderator sees queue entry

- **WHEN** a realm moderator opens the realm detail page
- **THEN** the UI SHALL show an entry to the realm moderation queue
- **AND** regular members SHALL NOT see that entry

### Requirement: Realm manage route expands beyond metadata

Realm management routes SHALL support rules, members, moderation, pins, tag curation, settings, and ownership flows rather than only metadata editing.

#### Scenario: Admin manages members

- **WHEN** a realm admin opens the members management section
- **THEN** they SHALL be able to filter members by role/state and perform policy-allowed role or state changes
