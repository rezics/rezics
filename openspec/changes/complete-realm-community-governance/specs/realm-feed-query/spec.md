## MODIFIED Requirements

### Requirement: Realm feeds respect lifecycle and moderator filters

Realm feed queries SHALL respect visibility, member-only access, pinned ordering, hidden-from-realm state, locked/archive filters, and moderator-only views.

#### Scenario: Regular member does not see hidden item

- **GIVEN** a post was hidden from a realm by a moderator
- **WHEN** a regular member loads the realm feed
- **THEN** the hidden item SHALL not appear
- **AND** a moderator filter MAY reveal it with moderation context
