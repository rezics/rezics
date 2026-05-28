## ADDED Requirements

### Requirement: Wiki pages describe Entities through subject attribution
WIKI Post Units that document a character, location, faction, concept, event, artifact, or similar subject SHALL link to the subject Entity through SubjectAttribution roles such as `canonical_wiki_page` or `about`.

#### Scenario: Character wiki links to Entity
- **WHEN** a wiki page documents character Entity `entity-artoria`
- **THEN** the wiki Unit SHALL be linkable to `entity-artoria` through SubjectAttribution

### Requirement: Work character lists derive from subject attribution
The list of characters, locations, factions, concepts, or similar subjects for a work or release SHALL be derived from SubjectAttribution between the work/release Unit and Entity Units. The system SHALL NOT infer work membership for a character solely from wiki page ownership or realm membership.

#### Scenario: Work character list
- **GIVEN** work `work-fate` has SubjectAttribution rows to character Entities with role `primary_character`
- **WHEN** the wiki Zone renders a Characters section for that work
- **THEN** it SHALL query those SubjectAttribution rows
- **AND** it SHALL NOT require the character wiki pages themselves to belong to the work Unit

### Requirement: Entity-backed wiki creation requires eligible subject Entity
When a wiki creation or editing surface creates a wiki page for an entity-backed subject, it SHALL require or create the corresponding Entity before establishing subject attribution.

#### Scenario: Character wiki requires Entity
- **WHEN** a user creates a character wiki page from a realm wiki surface
- **THEN** the flow SHALL require selecting or creating a character Entity
- **AND** the wiki page SHALL be linked to that Entity through SubjectAttribution
