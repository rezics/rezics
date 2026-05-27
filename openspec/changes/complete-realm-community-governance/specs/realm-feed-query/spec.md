## MODIFIED Requirements

### Requirement: Realm feeds respect lifecycle and moderator filters

Realm feed queries SHALL respect visibility, member-only access, hidden-from-realm state, locked/archive filters, and moderator-only views. Pinboard ordering SHALL remain sourced from `Realm.extra.pinboard` and its realm-extra read APIs rather than being embedded as a separate feed ordering source.

#### Scenario: Regular member does not see hidden item

- **GIVEN** a post was hidden from a realm by a moderator
- **WHEN** a regular member loads the realm feed
- **THEN** the hidden item SHALL not appear
- **AND** a moderator filter MAY reveal it with moderation context

#### Scenario: Pinboard remains separate from feed ordering

- **GIVEN** a realm has pinned Unit ids in `Realm.extra.pinboard`
- **WHEN** the feed query loads discussion items
- **THEN** the feed SHALL preserve its normal sort/filter semantics
- **AND** the UI SHALL compose the pinboard rail from the realm-extra pinboard source
