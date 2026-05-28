## ADDED Requirements

### Requirement: Wiki posts use UnitRealm for sent realm membership
WIKI Post Units SHALL use the existing UnitRealm relationship for realm membership. The relationship semantics are the same as other sent content: membership means the Unit belongs to that realm's content set.

#### Scenario: Wiki sent to realm uses UnitRealm
- **WHEN** a wiki post is sent to a realm
- **THEN** the system SHALL write a UnitRealm row for the wiki Unit and realm Unit

### Requirement: Repost creates a separate Unit
Forwarding or reposting wiki content for discussion SHALL create a separate post/repost Unit that references the original wiki Unit. This SHALL NOT be modeled as UnitRealm membership on the original wiki unless the user explicitly sends the original wiki to the realm.

#### Scenario: Repost leaves original UnitRealm unchanged
- **WHEN** a repost references wiki Unit `wiki-a`
- **THEN** the repost Unit MAY have its own UnitRealm rows
- **AND** `wiki-a` SHALL keep its existing UnitRealm rows unchanged
