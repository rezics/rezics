## ADDED Requirements

### Requirement: Wiki-capable content creation records initial history
Wiki-capable creation paths SHALL emit an initial content-history revision in
the same transaction as canonical creation whenever the created content is in
editorial content-history scope. The creation actor SHALL be recorded as the
history actor even when wiki mode assigns ownership to the seeded `rezics-wiki`
User.

#### Scenario: Wiki catalog book creation records creator as actor
- **WHEN** an authenticated ordinary user creates a wiki-mode Book
- **THEN** the created Unit owner SHALL be `rezicsWikiUser.unitId`
- **AND** the initial history revision actor SHALL be the creating user's Unit
  id

#### Scenario: Wiki entity creation records creator as actor
- **WHEN** an authenticated ordinary user creates an Entity from a catalog
  editing surface
- **THEN** the created Entity Unit owner SHALL be `rezicsWikiUser.unitId`
- **AND** the initial history revision actor SHALL be the creating user's Unit
  id

#### Scenario: Personal creation records initial history actor
- **WHEN** an authenticated user creates personal Book or Entity content that
  is in editorial content-history scope
- **THEN** the initial history revision actor SHALL be the current user's Unit
  id
