## ADDED Requirements

### Requirement: Post extra carries an optional poll reference

The `postExtraSchema` SHALL include an optional `poll` object with a required
`unitId` string identifying an existing `Unit(type=POLL)`. The field is additive
and optional: posts that do not embed a poll SHALL omit it, and existing posts
and reads SHALL be unaffected. The reference SHALL be stored and returned in
`post.extra` as-is by the existing post write/read paths, with no new server
endpoint and no migration.

#### Scenario: Creating a post with a poll reference

- **WHEN** a post is created with `extra.poll.unitId` set to an existing poll unit id
- **THEN** the post SHALL be persisted with that `extra.poll.unitId`
- **AND** reading the post SHALL return `extra.poll.unitId` unchanged

#### Scenario: Post without a poll reference omits the field

- **WHEN** a post is created without a poll
- **THEN** `extra.poll` SHALL be absent
- **AND** the post SHALL validate and persist exactly as before this change
