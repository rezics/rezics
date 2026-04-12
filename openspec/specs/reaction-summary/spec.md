## ADDED Requirements

### Requirement: Batch reaction summary
The system SHALL provide a `GET /reactions/summary` endpoint that returns aggregated reaction counts for one or more targets. The endpoint SHALL accept a `targetIds` query parameter (comma-separated or repeated). The endpoint SHALL NOT require authentication — reaction counts are public data.

#### Scenario: Single target summary
- **WHEN** a client sends `GET /reactions/summary?targetIds=abc`
- **THEN** the system returns `{ summaries: { "abc": { "like": 42, "dislike": 3 } } }`

#### Scenario: Multi-target summary
- **WHEN** a client sends `GET /reactions/summary?targetIds=abc,def,ghi`
- **THEN** the system returns summaries for all three targets, with empty objects `{}` for targets that have no reactions

#### Scenario: No targets provided
- **WHEN** a client sends `GET /reactions/summary` with no `targetIds`
- **THEN** the system returns `{ summaries: {} }` with status 200

#### Scenario: Target with no reactions
- **WHEN** a client requests summary for a targetId that has no reactions
- **THEN** the system returns an empty object for that target: `{ summaries: { "xyz": {} } }`

### Requirement: Summary reflects real-time state
ReactionSummary counts SHALL be updated synchronously within the same transaction as reaction create/delete operations. The summary endpoint SHALL always return the current committed count.

#### Scenario: Summary after create
- **WHEN** a user creates a `like` reaction on target `abc` (which had 5 likes)
- **THEN** an immediate `GET /reactions/summary?targetIds=abc` returns `{ "like": 6 }`

#### Scenario: Summary after delete
- **WHEN** a user deletes their `like` reaction on target `abc` (which had 6 likes)
- **THEN** an immediate `GET /reactions/summary?targetIds=abc` returns `{ "like": 5 }`
