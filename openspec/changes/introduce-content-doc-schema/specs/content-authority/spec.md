## MODIFIED Requirements

### Requirement: Sparse field locks
The system SHALL store protected Unit fields in a sparse `UnitFieldLock` table. A row with `fieldKey = "*"` SHALL lock the entire Unit against community edits. Field keys SHALL be contract-defined semantic keys rather than raw database column names. Content document field keys SHALL refer to content semantics such as whole content, main content, slots, or specific slot ids; the removed `post.body` field key SHALL NOT be used for new content edits.

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
- **WHEN** Unit A has a content main field lock
- **AND** a community editor attempts to change `ContentDoc.main`
- **THEN** the edit SHALL be rejected with a 403-style authority error

## ADDED Requirements

### Requirement: Content field keys replace post body key
The field-key vocabulary SHALL replace the legacy `post.body` key with content document keys. Wiki and chapter content mutations SHALL report changed field keys using the content document vocabulary.

#### Scenario: Wiki content edit records content key
- **WHEN** a wiki page main Markdown source is updated
- **THEN** authority checks and history payloads SHALL reference a content document field key
- **AND** they SHALL NOT reference `post.body`
