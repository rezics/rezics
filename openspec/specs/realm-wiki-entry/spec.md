# realm-wiki-entry Specification

## Purpose
TBD - created by archiving change define-realm-wiki-zone-experience. Update Purpose after archive.
## Requirements
### Requirement: Wiki realm membership uses UnitRealm
WIKI Post Units SHALL belong to realms through `UnitRealm`. Sending a wiki Unit to a realm SHALL create or keep `UnitRealm(realmUnitId, unitId)` and SHALL make the wiki eligible for that realm's wiki lists, wiki Zone queries, moderation, and search filters.

#### Scenario: Send wiki to realm
- **WHEN** a user with posting permission sends wiki Unit `wiki-artoria` to realm `realm-fate`
- **THEN** the system SHALL create `UnitRealm(realm-fate, wiki-artoria)`
- **AND** `wiki-artoria` SHALL appear in realm `realm-fate` wiki queries

#### Scenario: Wiki can belong to multiple realms
- **GIVEN** wiki Unit `wiki-artoria` has UnitRealm rows for `realm-fate` and `realm-type-moon`
- **WHEN** either realm's wiki list is queried
- **THEN** `wiki-artoria` SHALL be eligible in both result sets

### Requirement: Reposting is separate from sending
Reposting or forwarding a wiki for discussion SHALL create a new ordinary discussion/repost Post that references the original wiki Unit. Reposting SHALL NOT create `UnitRealm` rows for the original wiki Unit unless the user explicitly sends that original wiki to the realm.

#### Scenario: Repost does not change original wiki membership
- **GIVEN** wiki Unit `wiki-artoria` belongs only to `realm-fate`
- **WHEN** a user creates a discussion post in `realm-books` that references `wiki-artoria`
- **THEN** the discussion post MAY belong to `realm-books`
- **AND** `wiki-artoria` SHALL NOT gain `UnitRealm(realm-books, wiki-artoria)`

### Requirement: Realm Wiki tab is a uniform wiki list
The realm detail page SHALL provide a Wiki tab that uses the standard Rezics app theme. The tab SHALL list, search, and filter WIKI Post Units sent to the realm through `UnitRealm`. It SHALL NOT apply custom wiki Zone theme tokens.

#### Scenario: Realm Wiki tab lists sent wiki
- **GIVEN** realm `realm-fate` has WIKI Units sent through UnitRealm
- **WHEN** a viewer opens the realm Wiki tab
- **THEN** the tab SHALL display a paginated wiki list for `realm-fate`
- **AND** the tab SHALL use the uniform app theme

### Requirement: Realm Wiki tab links to configured wiki Zone
A realm MAY configure a wiki Zone. When configured, the realm Wiki tab SHALL display a prominent entry action to open the themed wiki Zone. When no wiki Zone is configured, the tab SHALL still render the uniform wiki list and MAY show an owner/moderator setup prompt.

#### Scenario: Wiki tab links to Zone
- **GIVEN** realm `realm-fate` has `wikiZoneUnitId = zone-fate-wiki`
- **WHEN** a viewer opens the realm Wiki tab
- **THEN** the tab SHALL render an action that navigates to the Zone page for `zone-fate-wiki`

#### Scenario: No configured Zone
- **GIVEN** realm `realm-fate` has no wiki Zone configuration
- **WHEN** a viewer opens the realm Wiki tab
- **THEN** the tab SHALL still show the realm wiki list
- **AND** moderators MAY see a setup action if they have permission

