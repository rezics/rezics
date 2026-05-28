# subject-attribution Specification

## Purpose

Defines subject attribution links between Units and Entity subjects, including
role semantics, eligibility, source evidence, and indexing behavior.
## Requirements
### Requirement: SubjectAttribution links Units to Entity subjects

The system SHALL provide a `SubjectAttribution` model that links a target Unit (`unitId`) to an Entity Unit (`entityId`) with a free-form `role` string. The relation SHALL represent subject indexing such as characters, factions, families, locations, artifacts, events, concepts, canonical wiki pages, and related setting objects. Both `unitId` and `entityId` SHALL reference `Unit.id`, and `entityId` SHALL refer to a Unit with `type = ENTITY`.

#### Scenario: Link a fan fiction to a primary character

- **WHEN** a SubjectAttribution is created with `unitId = "fanfic-1"`, `entityId = "character-1"`, and `role = "primary_character"`
- **THEN** the record SHALL be persisted as a subject relation
- **AND** the system SHALL be able to query all Units where `"character-1"` is a primary character

#### Scenario: Reject a non-Entity subject

- **WHEN** a caller attempts to create a SubjectAttribution with `entityId` referencing a Unit whose type is not `ENTITY`
- **THEN** the system SHALL reject the request with a validation error
- **AND** no SubjectAttribution row SHALL be created

### Requirement: SubjectAttribution role is a flexible string

The `role` field on SubjectAttribution SHALL be stored as a string with a maximum length of 64 characters and SHALL NOT be constrained by a database enum. Public API writes SHALL accept only role keys defined by the contract subject attribution role registry. Contract constants and registry entries define the product vocabulary, i18n keys, and Entity kind hints.

#### Scenario: Use a registered subject role

- **WHEN** creating a SubjectAttribution with `role = "featured_character"` and that role is registered
- **THEN** the record SHALL be persisted with that role

#### Scenario: Reject a custom subject role

- **WHEN** a public caller attempts to create a SubjectAttribution with `role = "sect_founder"` and that key is not registered
- **THEN** Elysia schema validation SHALL reject the request
- **AND** no SubjectAttribution row SHALL be created

### Requirement: SubjectAttribution uniqueness is per role

The system SHALL prevent duplicate SubjectAttribution rows for the same `(unitId, entityId, role)` while allowing the same Entity subject to hold multiple roles on the same Unit.

#### Scenario: Same subject has multiple roles on one Unit

- **WHEN** SubjectAttribution rows are created for `(unit-1, entity-1, "primary_character")` and `(unit-1, entity-1, "narrator")`
- **THEN** both rows SHALL coexist

#### Scenario: Duplicate subject role is rejected

- **GIVEN** SubjectAttribution `(unit-1, entity-1, "primary_character")` already exists
- **WHEN** a caller attempts to create another row with the same `(unitId, entityId, role)`
- **THEN** the system SHALL reject the request with a uniqueness error

### Requirement: SubjectAttribution supports ordered display and weighted indexing

SubjectAttribution SHALL include `sortOrder` for display ordering within a role and MAY include `weight` for search or ranking hints. Lower `sortOrder` values SHALL appear first when listing subjects for a Unit.

#### Scenario: Order featured characters

- **GIVEN** Unit "fanfic-1" has featured character subject rows with sort orders 2, 0, and 1
- **WHEN** the system lists featured characters for "fanfic-1"
- **THEN** the rows SHALL be returned in sort order 0, 1, and 2

### Requirement: SubjectAttribution service and API expose link, unlink, and list operations

The server SHALL expose service and HTTP operations to link a subject to a Unit, unlink by composite key, list subjects for a Unit, and list Units for a subject. Public link/unlink inputs SHALL validate role keys against the contract subject attribution role registry. Link writes SHALL also validate that the target Entity's `eligibleSubjectRoles` contains the requested subject role. DTOs SHALL include the linked Entity's translations and avatar so clients can resolve subject display through the existing multilingual fallback rules.

#### Scenario: List subjects for a Unit

- **GIVEN** Unit "fanfic-1" has SubjectAttribution rows to character and faction Entities
- **WHEN** a client requests the subject list for "fanfic-1"
- **THEN** the response SHALL include each role, sort order, and Entity DTO with translations
- **AND** the response SHALL include the Entity avatar when present

#### Scenario: List Units for a subject

- **GIVEN** Entity "character-1" is linked to multiple published Units through SubjectAttribution
- **WHEN** a client requests Units for subject "character-1" filtered by `role = "primary_character"`
- **THEN** the response SHALL include matching target Units only

#### Scenario: Eligible Entity can be linked as primary character

- **GIVEN** Entity "character-1" has `eligibleSubjectRoles = ["primary_character"]`
- **WHEN** a caller creates `SubjectAttribution(unitId = "fanfic-1", entityId = "character-1", role = "primary_character")`
- **THEN** the link SHALL be persisted

#### Scenario: Ineligible Entity cannot be linked as primary character

- **GIVEN** Entity "person-1" has `eligibleSubjectRoles = ["about"]`
- **WHEN** a caller creates `SubjectAttribution(unitId = "fanfic-1", entityId = "person-1", role = "primary_character")`
- **THEN** the service SHALL reject the write with a typed eligibility error
- **AND** no SubjectAttribution row SHALL be created

### Requirement: Subject role registry

The contract package SHALL export a subject attribution role registry. Each entry SHALL include a stable key, an i18n label key, Entity kind hints, and display grouping metadata.

#### Scenario: Character role provides kind hint

- **WHEN** the frontend prepares a subject attribution picker for `primary_character`
- **THEN** the registry SHALL provide a character-oriented kind hint
- **AND** the role label SHALL be rendered from its i18n key

### Requirement: Subject role selector uses registry keys

Subject attribution editing UI SHALL present role choices from the subject role registry. The UI SHALL NOT expose an arbitrary text field for ordinary users to create new subject role keys.

#### Scenario: User selects a registered subject role

- **WHEN** a user edits subject attributions
- **THEN** the role selector SHALL show registered subject roles
- **AND** saving shall persist the selected registry key in `SubjectAttribution.role`

### Requirement: Wiki pages use SubjectAttribution for subject linkage

Wiki POST Units SHALL link to the Entity subject they describe through SubjectAttribution roles such as `canonical_wiki_page` or `about`. Parallel translations of those wiki POST Units SHALL continue to use `TranslationGroup`.

#### Scenario: Link a translated wiki page to its character

- **GIVEN** a Japanese wiki POST and an English wiki POST share a TranslationGroup
- **WHEN** both Units are linked to Entity "character-1" with `role = "canonical_wiki_page"`
- **THEN** the system SHALL treat the Units as wiki pages for the same Entity subject
- **AND** translation grouping SHALL remain governed by TranslationGroup rather than SubjectAttribution

### Requirement: Subject attribution batch reconciliation

The system SHALL support batch reconciliation of subject attribution rows through the unit-scoped entity attribution batch endpoint. A `setSubjects` batch operation SHALL validate the submitted subject role key, validate every referenced Entity's subject-role eligibility, and reconcile the target Unit's `SubjectAttribution` rows for that role to the submitted final ordered set.

#### Scenario: Reconcile primary character subjects

- **GIVEN** Unit `post-1` has existing primary character subjects `[entity-a, entity-b]`
- **WHEN** a batch request submits `setSubjects(role = "primary_character", entries = [entity-b, entity-c])`
- **THEN** the system SHALL remove the primary character subject for `entity-a`
- **AND** it SHALL keep or update the primary character subject for `entity-b`
- **AND** it SHALL create the primary character subject for `entity-c`

#### Scenario: Batch validates subject eligibility

- **GIVEN** Entity `entity-x` does not include `primary_character` in `eligibleSubjectRoles`
- **WHEN** a batch request submits `setSubjects(role = "primary_character", entries = [entity-x])`
- **THEN** the system SHALL reject the batch with an eligibility error
- **AND** no subject attribution rows from that batch SHALL be committed

### Requirement: Subject batch history stores final role state

Subject attribution changes made through entity attribution batch editing SHALL produce at most one editorial history revision for a successful canonical commit. The revision patch SHALL contain the final sparse subject state for changed roles and SHALL NOT contain the client's local add/remove/reorder operation log.

#### Scenario: Multiple subject changes produce one history revision

- **WHEN** a user locally removes one character, adds another character, reorders the character list, and saves once
- **THEN** the server SHALL write one editorial history revision for the changed subject role path
- **AND** the revision content SHALL represent the final ordered subject set including any submitted weights

### Requirement: Platform availability and worldview subject roles

The subject attribution role registry SHALL include the `available_on` role for
platform availability, with an Entity kind hint of `game_platform`. The existing
`setting` role SHALL additionally hint the `universe` Entity kind so worldview
subjects can be attached to works.

The registry SHALL NOT include an `age_rating` subject role; external age ratings
are catalog tags, not subjects.

#### Scenario: Platform uses available_on role

- **WHEN** a GAME release is linked to a `game_platform` Entity with `role = "available_on"` and the role is registered
- **THEN** the SubjectAttribution SHALL be persisted with `role = "available_on"`

#### Scenario: Worldview uses setting role

- **WHEN** a work is linked to a `universe` Entity with `role = "setting"`
- **THEN** the SubjectAttribution SHALL be persisted with `role = "setting"`

#### Scenario: Age rating subject role is rejected

- **WHEN** a caller attempts to create a SubjectAttribution with `role = "age_rating"`
- **THEN** the request SHALL be rejected because `age_rating` is not a registered subject role

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

