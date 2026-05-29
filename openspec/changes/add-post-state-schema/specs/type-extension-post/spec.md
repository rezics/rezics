## ADDED Requirements

### Requirement: Post carries a generic lifecycle state field

The `Post` extension SHALL have an optional `state` field of generic string type
and an `extra.stateSchemaTag` key. When present, `state` SHALL be a kebab-case
slug whose legal values are governed by the schema named by
`extra.stateSchemaTag`; it SHALL NOT be a database enum and SHALL NOT gate
backend behavior. The lifecycle SHALL be a single axis (no separate
outcome/resolution field). Each value SHALL resolve to a tag for rendering, with
fallback to the raw slug. Both fields default to absent (`state = null`, no
`stateSchemaTag`) so existing and non-stateful posts are unaffected.

#### Scenario: Existing posts are unaffected

- **WHEN** the migration adds `Post.state`
- **THEN** all existing posts SHALL have `state = null`
- **AND** their behavior SHALL be unchanged

#### Scenario: Lifecycle is tag-schema driven, not enum driven

- **WHEN** a post bears a stateful tag
- **THEN** its valid `state` values SHALL come from that tag's schema
- **AND** there SHALL be no fixed `kind`/state enum column governing lifecycle

#### Scenario: State value is a renderable slug

- **GIVEN** a post with a non-null `state`
- **WHEN** the value is rendered
- **THEN** the value SHALL be a kebab-case slug resolving to a tag, or rendered
  as the raw slug when no tag exists
</content>
