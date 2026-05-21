# entity-picker Specification

## Purpose

Defines `EntityPicker`, a Dialog-hosted command-palette composite for selecting (or inline-creating) an ENTITY unit during downstream flows like book authorship or attribution. The picker debounces searches against the Meili `entities` index, surfaces a sticky "+ Create new" affordance that opens an inline mini-form for creator-owned entity creation, and honors an optional `kindHint` to bias both search ranking and the inline form's pre-fill. Slug input is intentionally never exposed in this surface — slug assignment belongs to the admin page.

## Requirements

### Requirement: EntityPicker is a Dialog-hosted command-palette composite

EntityPicker SHALL render as a modal Dialog containing a search input, a debounced result list backed by the Meili `entities` index, and a sticky "+ Create new" affordance at the bottom of the result list. The component SHALL accept the following props at minimum: `open`, `onOpenChange`, `onSelect(unitId)`, optional `kindHint`.

#### Scenario: Opening the picker focuses the search input

- **WHEN** EntityPicker is mounted with `open = true`
- **THEN** the search input SHALL receive focus on next paint
- **AND** the result list SHALL be empty until the first query

#### Scenario: Typing a query returns matching entities

- **WHEN** the user types `"liu"`
- **THEN** after debounce, a request SHALL be issued against the `entities` index
- **AND** matching results SHALL render with primary title, kind chip, and verified badge (when applicable)

#### Scenario: Selecting an existing entity closes the picker

- **WHEN** the user clicks a result row
- **THEN** `onSelect(unitId)` SHALL be invoked with the selected entity's unitId
- **AND** the Dialog SHALL close

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

### Requirement: EntityPicker does not expose slug input to end users

The inline create form SHALL NOT expose a slug input. End users SHALL NOT be able to set or suggest an ENTITY slug through any field within the picker. Slug assignment is reserved for the admin surface.

#### Scenario: Inline form has no slug field

- **WHEN** the inline create form is rendered
- **THEN** no input bound to `slug` SHALL appear in the form
- **AND** the form payload submitted to `EntityService.create` SHALL omit the `slug` key

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
