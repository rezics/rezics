## MODIFIED Requirements

### Requirement: Sparse field locks

The system SHALL store protected Unit fields in a sparse `UnitFieldLock` table. A row with `fieldKey = "*"` SHALL lock the entire Unit against community edits. Field keys SHALL be contract-defined semantic keys rather than raw database column names. Long-form content field keys SHALL reference content document sub-paths such as the whole content document, the main block, or specific slot ids. The removed `post.body` field key SHALL NOT be used for new content edits.

#### Scenario: Field lock blocks community edit

- **WHEN** Unit A has a `UnitFieldLock` row for `fieldKey = "identity.title"`
- **AND** a community editor attempts to edit `identity.title`
- **THEN** the edit SHALL be rejected with a 403-style authority error

#### Scenario: Whole-object lock blocks community edit

- **WHEN** Unit A has a `UnitFieldLock` row for `fieldKey = "*"`
- **AND** a community editor attempts to edit any collaborative field on Unit A
- **THEN** the edit SHALL be rejected with a 403-style authority error

#### Scenario: Unlocked field admits community edit

- **WHEN** Unit A has no `UnitFieldLock` rows for `"*"` or the changed field keys
- **AND** the endpoint surface is collaborative
- **THEN** the lock layer SHALL NOT block a community edit

#### Scenario: Content main lock blocks body-equivalent edit

- **WHEN** Unit A has a `UnitFieldLock` row for `fieldKey = "post.content.main"`
- **AND** a community editor attempts to change `content.main`
- **THEN** the edit SHALL be rejected with a 403-style authority error

#### Scenario: Slot lock blocks only that slot

- **WHEN** Unit A has a `UnitFieldLock` row for `fieldKey = "post.content.slots.infobox"`
- **AND** a community editor attempts to change `content.slots.infobox`
- **THEN** the edit SHALL be rejected with a 403-style authority error
- **AND** an edit to `content.main` on the same Unit (with no other matching lock) SHALL be admitted

## ADDED Requirements

### Requirement: Content field keys replace post body key

The field-key vocabulary SHALL replace the legacy `post.body` key with content document sub-path keys. Wiki and chapter content mutations SHALL report changed field keys using the content document vocabulary. New lock rows SHALL NOT be created with `fieldKey = "post.body"`.

The first-class content sub-path keys SHALL be:

- `post.content` — locks or marks the whole `ContentDoc`
- `post.content.main` — locks or marks the `main` block
- `post.content.slots.<slotId>` — locks or marks one specific slot
- `post.content.layout` — locks or marks the layout array

#### Scenario: Wiki content edit records content key

- **WHEN** a wiki page main Markdown source is updated
- **THEN** authority checks and history payloads SHALL reference `post.content.main`
- **AND** they SHALL NOT reference `post.body`

#### Scenario: Whole-content lock blocks all content edits

- **WHEN** Unit A has `UnitFieldLock("post.content")`
- **AND** a community editor attempts to change any sub-path of `content` (main, any slot, or layout)
- **THEN** the edit SHALL be rejected
