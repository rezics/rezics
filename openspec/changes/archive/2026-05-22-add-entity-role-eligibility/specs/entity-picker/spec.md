## MODIFIED Requirements

### Requirement: EntityPicker inline create produces a creator-owned entity

EntityPicker inline creation SHALL use an explicit creation context. Catalog/public editing surfaces SHALL create wiki-owned Entity units with `creationMode = "wiki"`. Personal work and self-claim surfaces SHALL create personal Entity units with `creationMode = "personal"`. In both contexts, the form SHALL require at minimum one UnitTranslation (language + title), a registered Entity kind key, and persisted role eligibility arrays. The form MAY prefill eligibility arrays from the selected kind and selected attribution role, but the submitted arrays SHALL be explicit payload values.

#### Scenario: Catalog inline create uses wiki mode

- **WHEN** a user creates a new author entity from inside a public catalog book form
- **THEN** EntityPicker SHALL submit `creationMode = "wiki"`
- **AND** the created ENTITY Unit's owner SHALL be the seeded `rezics-wiki` user
- **AND** the current user SHALL be recorded as the actor where history/audit applies

#### Scenario: Personal inline create uses personal mode

- **WHEN** a user creates a new author entity from inside a personal work flow
- **THEN** EntityPicker SHALL submit `creationMode = "personal"`
- **AND** the created ENTITY Unit's owner SHALL be the current user

#### Scenario: Inline create pre-fills eligibility from kind

- **WHEN** the user selects `kind = "character"` while creating an Entity inline
- **THEN** the form SHALL prefill subject eligibility suggestions appropriate for character Entities
- **AND** the user SHALL be able to add or remove eligibility roles before submitting

#### Scenario: Inline create rejects empty translation title

- **WHEN** the user submits the inline form with `translations: [{ language: "zh", title: "" }]`
- **THEN** the form SHALL display a validation error
- **AND** it SHALL NOT call EntityService.create

### Requirement: EntityPicker honors the kindHint prop

When `kindHint` is provided, the inline create form SHALL pre-fill the kind field with that registered kind key, and the search result ordering MAY use the hint to rank relevant entities. The search request SHALL NOT use kind hints as a substitute for role eligibility filtering when a selected credit or subject role is available.

#### Scenario: Book author picker passes kindHint

- **WHEN** EntityPicker is opened for a selected `author` credit role
- **THEN** the picker SHALL receive kind hints from the credit role registry
- **AND** person or organization entities matching the query MAY rank higher than other-kind matches
- **AND** the search predicate SHALL still be based on `eligibleCreditRoles = "author"`

### Requirement: Role is selected before entity selection

Attribution editing flows SHALL select a registered credit or subject role before committing an Entity selection. The selected role SHALL determine the stored role key, role label, EntityPicker kind hints, eligibility search predicate, and whether the attribution is displayed in Metadata or in a general attribution section. The selected role SHALL NOT be interpreted as an actual-role history filter.

#### Scenario: Author role opens eligibility-filtered EntityPicker

- **WHEN** a user selects the `author` credit role in a book attribution editor
- **THEN** the next EntityPicker interaction SHALL search for Entities with `eligibleCreditRoles` containing `author`
- **AND** the saved attribution SHALL use `role = "author"`
- **AND** Entities that have never previously been linked as authors SHALL remain selectable when they are eligible for `author`

#### Scenario: Character subject role opens eligibility-filtered EntityPicker

- **WHEN** a user selects the `primary_character` subject role in a subject attribution editor
- **THEN** the next EntityPicker interaction SHALL search for Entities with `eligibleSubjectRoles` containing `primary_character`
- **AND** the saved attribution SHALL use `role = "primary_character"`
