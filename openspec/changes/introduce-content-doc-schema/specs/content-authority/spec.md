## MODIFIED Requirements

### Requirement: Sparse field locks

The system SHALL store protected Unit fields in a sparse `UnitFieldLock` table. A row with `fieldKey = "*"` SHALL lock the entire Unit against community edits. Field keys SHALL be contract-defined semantic keys rather than raw database column names. Runtime v1 SHALL wire long-form content locks only for the supported main block (`post.content.main`) and broad whole-content lock (`post.content`). The removed `post.body` field key SHALL NOT be used for new content edits. Slot/layout field keys are contract-reserved but not enforced by this change.

Authority SHALL compare the submitted full JSON's `content.main` against the stored `content.main` to decide whether a supported content edit is being attempted. Authority SHALL NOT recursively validate `ContentDoc` shape, parse markdown directives, or inspect slots/layout to decide locks in this change.

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

#### Scenario: Slot lock is not enforced in runtime v1

- **WHEN** Unit A has a `UnitFieldLock` row for `fieldKey = "post.content.slots.infobox"`
- **AND** a community editor attempts to change only `content.slots.infobox`
- **THEN** this change SHALL NOT reject the edit based on that slot lock
- **AND** slot/layout lock enforcement SHALL be added only when slot/layout runtime support is designed

#### Scenario: Main no-op does not trip lock

- **WHEN** Unit A has a `UnitFieldLock` row for `fieldKey = "post.content.main"`
- **AND** a community editor submits full content JSON whose `main` value is structurally equal to the stored `content.main`
- **THEN** the lock layer SHALL treat the update as no-op for that field
- **AND** it SHALL NOT reject the request solely because `main` was present

## ADDED Requirements

### Requirement: Content field keys replace post body key

The field-key vocabulary SHALL replace the legacy `post.body` key with content document sub-path keys. Wiki and chapter content mutations SHALL report changed field keys using the content document vocabulary. New lock rows SHALL NOT be created with `fieldKey = "post.body"`.

The content sub-path vocabulary SHALL be:

- `post.content` — locks the whole supported content surface
- `post.content.main` — locks or marks the supported `main` block
- `post.content.slots.<slotId>` — reserved for future slot support; not enforced by this change
- `post.content.layout` — reserved for future layout support; not enforced by this change

#### Scenario: Wiki content edit records content key

- **WHEN** a wiki page main Markdown source is updated
- **THEN** authority checks and history payloads SHALL reference `post.content.main`
- **AND** they SHALL NOT reference `post.body`

#### Scenario: Whole-content lock blocks all content edits

- **WHEN** Unit A has `UnitFieldLock("post.content")`
- **AND** a community editor attempts to change supported `content.main`
- **THEN** the edit SHALL be rejected
