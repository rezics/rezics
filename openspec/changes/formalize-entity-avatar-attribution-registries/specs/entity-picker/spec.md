## MODIFIED Requirements

### Requirement: EntityPicker inline create produces a creator-owned entity
EntityPicker inline creation SHALL use an explicit creation context. Catalog/public editing surfaces SHALL create wiki-owned Entity units with `creationMode = "wiki"`. Personal work and self-claim surfaces SHALL create personal Entity units with `creationMode = "personal"`. In both contexts, the form SHALL require at minimum one UnitTranslation (language + title) plus a registered Entity kind key.

#### Scenario: Catalog inline create uses wiki mode
- **WHEN** a user creates a new author entity from inside a public catalog book form
- **THEN** EntityPicker SHALL submit `creationMode = "wiki"`
- **AND** the created ENTITY Unit's owner SHALL be the seeded `rezics-wiki` user
- **AND** the current user SHALL be recorded as the actor where history/audit applies

#### Scenario: Personal inline create uses personal mode
- **WHEN** a user creates a new author entity from inside a personal work flow
- **THEN** EntityPicker SHALL submit `creationMode = "personal"`
- **AND** the created ENTITY Unit's owner SHALL be the current user

#### Scenario: Inline create rejects empty translation title
- **WHEN** the user submits the inline form with `translations: [{ language: "zh", title: "" }]`
- **THEN** the form SHALL display a validation error
- **AND** it SHALL NOT call EntityService.create

### Requirement: EntityPicker honors the kindHint prop
When `kindHint` is provided, the inline create form SHALL pre-fill the kind field with that registered kind key, and the search request SHALL use the hint to rank or filter relevant entities without hiding valid global matches unless the calling surface explicitly requests a hard kind filter.

#### Scenario: Book author picker passes kindHint
- **WHEN** EntityPicker is opened for a selected `author` credit role
- **THEN** the picker SHALL receive kind hints from the credit role registry
- **AND** person or organization entities matching the query MAY rank higher than other-kind matches

## ADDED Requirements

### Requirement: Role is selected before entity selection
Attribution editing flows SHALL select a registered credit or subject role before committing an Entity selection. The selected role SHALL determine the stored role key, role label, EntityPicker kind hints, and whether the attribution is displayed in Metadata or in a general attribution section.

#### Scenario: Author role opens person-biased EntityPicker
- **WHEN** a user selects the `author` credit role in a book attribution editor
- **THEN** the next EntityPicker interaction SHALL use the registry kind hints for `author`
- **AND** the saved attribution SHALL use `role = "author"`

### Requirement: Catalog EntityPicker uses global search
Catalog/public EntityPicker flows SHALL search globally across the `entities` index. They SHALL NOT rank current-user entities above other matches solely due to ownership.

#### Scenario: Public book form searches globally
- **WHEN** EntityPicker is opened from a public catalog book form
- **THEN** results SHALL come from global entity search
- **AND** current-user-owned entities SHALL NOT receive an ownership boost

### Requirement: Personal EntityPicker can bias owned entities
Personal EntityPicker flows SHALL preserve global results but MAY rank entities owned by the current user first.

#### Scenario: Personal work form shows own entity first
- **WHEN** a personal work EntityPicker query finds both a current-user entity and a global entity with similar match quality
- **THEN** the current-user entity MAY appear first
- **AND** the global entity SHALL still be selectable
