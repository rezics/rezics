## ADDED Requirements

### Requirement: Create reaction
The system SHALL allow an authenticated user to create a reaction on a target by providing a `targetId` and a `reaction` type. The operation SHALL be idempotent — creating an already-existing reaction SHALL return the existing record without error. The `reaction` value SHALL be validated against the configured allowlist (default: `like`, `dislike`). The system SHALL reject reactions with types not in the allowlist with a 400 status.

#### Scenario: Create a new reaction
- **WHEN** an authenticated user sends `POST /reactions` with `{ targetId: "abc", reaction: "like" }`
- **THEN** the system creates a Reaction row and returns `{ id, userId, targetId, reaction, createdAt }` with status 201

#### Scenario: Idempotent create
- **WHEN** an authenticated user sends `POST /reactions` with `{ targetId: "abc", reaction: "like" }` and a matching Reaction already exists
- **THEN** the system returns the existing Reaction record with status 200, no duplicate row is created, and the summary counter is not incremented

#### Scenario: Invalid reaction type
- **WHEN** an authenticated user sends `POST /reactions` with `{ targetId: "abc", reaction: "bookmark" }`
- **THEN** the system returns status 400 with an error indicating the reaction type is not allowed

#### Scenario: Summary counter increment
- **WHEN** a new reaction is successfully created (not idempotent hit)
- **THEN** the corresponding ReactionSummary row is upserted with `count` incremented by 1, within the same database transaction

### Requirement: Delete reaction
The system SHALL allow an authenticated user to delete their own reaction by providing `targetId` and `reaction` type. The operation SHALL be idempotent — deleting a non-existent reaction SHALL return `{ deleted: false }` without error.

#### Scenario: Delete an existing reaction
- **WHEN** an authenticated user sends `DELETE /reactions?targetId=abc&reaction=like` and the reaction exists
- **THEN** the system deletes the Reaction row, decrements the ReactionSummary counter, and returns `{ deleted: true }`

#### Scenario: Idempotent delete
- **WHEN** an authenticated user sends `DELETE /reactions?targetId=abc&reaction=like` and no matching reaction exists
- **THEN** the system returns `{ deleted: false }` with status 200

#### Scenario: Summary counter decrement
- **WHEN** a reaction is successfully deleted
- **THEN** the corresponding ReactionSummary `count` is decremented by 1 within the same transaction. The count SHALL NOT go below 0.

### Requirement: Reaction type allowlist is configurable
The allowed reaction types SHALL be configurable via the `REACTION_TYPES` environment variable as a comma-separated list. If the variable is not set, the default set SHALL be `like,dislike`.

#### Scenario: Custom reaction types
- **WHEN** `REACTION_TYPES` is set to `like,dislike,laugh,cry`
- **THEN** the system accepts `laugh` and `cry` as valid reaction types in addition to `like` and `dislike`

#### Scenario: Default types when unset
- **WHEN** `REACTION_TYPES` is not set
- **THEN** only `like` and `dislike` are accepted as valid reaction types
