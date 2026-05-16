## ADDED Requirements

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

The sticky "+ Create new" affordance SHALL open an inline mini-form within the same Dialog. The form SHALL require at minimum one `UnitTranslation` (language + title) plus `kind`. Bio fields SHALL NOT be required. On submit, the form SHALL call `EntityService.create` with the caller as owner (no `mode` parameter, no custodian lookup) and, on success, SHALL invoke `onSelect(newUnitId)` and close the Dialog.

#### Scenario: Empty result state surfaces the create affordance

- **WHEN** a query returns zero results
- **THEN** the empty-state message SHALL read "No matching entities — create one?"
- **AND** the "+ Create new" affordance SHALL be the primary actionable element

#### Scenario: Inline create with minimum required fields

- **WHEN** the user submits the inline form with `{ kind: "person", translations: [{ language: "zh", title: "新作者" }] }`
- **THEN** `EntityService.create` SHALL be called with those fields plus an implicit `userId = caller.unitId`
- **AND** on success, `onSelect(unitId)` SHALL be invoked
- **AND** the Dialog SHALL close

#### Scenario: Inline create rejects empty translation title

- **WHEN** the user submits the inline form with `translations: [{ language: "zh", title: "" }]`
- **THEN** the form SHALL display a validation error and SHALL NOT call EntityService.create

### Requirement: EntityPicker honors the kindHint prop

When `kindHint` is provided, the inline create form SHALL pre-fill the `kind` field with that value, and the Meili query SHALL prefer (but SHALL NOT exclusively show) entities of that kind by using kind as a Meili `filter` weight rather than a hard filter.

#### Scenario: Book author picker passes kindHint="person"

- **WHEN** EntityPicker is opened with `kindHint = "person"`
- **THEN** the inline-create kind field SHALL be pre-filled with `"person"`
- **AND** person-kind entities SHALL rank higher in the result list than other-kind entities matching the same query

### Requirement: EntityPicker does not expose slug input to end users

The inline create form SHALL NOT expose a slug input. End users SHALL NOT be able to set or suggest an ENTITY slug through any field within the picker. Slug assignment is reserved for the admin surface.

#### Scenario: Inline form has no slug field

- **WHEN** the inline create form is rendered
- **THEN** no input bound to `slug` SHALL appear in the form
- **AND** the form payload submitted to `EntityService.create` SHALL omit the `slug` key
