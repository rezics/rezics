## ADDED Requirements

### Requirement: Post carries a generic lifecycle state field

The `Post` extension SHALL have an optional `state` field of generic string type
and an `extra.stateSchemaTag` key. `state` SHALL be a presentation label whose
legal values are governed by the schema named by `extra.stateSchemaTag`; it
SHALL NOT be a database enum and SHALL NOT gate backend behavior. Both default to
absent (`state = null`, no `stateSchemaTag`) so existing and non-stateful posts
are unaffected.

#### Scenario: Existing posts are unaffected

- **WHEN** the migration adds `Post.state`
- **THEN** all existing posts SHALL have `state = null`
- **AND** their behavior SHALL be unchanged

#### Scenario: Lifecycle is tag-schema driven, not enum driven

- **WHEN** a post bears a stateful tag
- **THEN** its valid `state` values SHALL come from that tag's schema
- **AND** there SHALL be no fixed `kind`/state enum column governing lifecycle
