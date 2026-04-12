## MODIFIED Requirements

### Requirement: Internal create endpoint
The reaction service SHALL provide a `POST /internal/create` endpoint that creates a reaction for a given user. The endpoint SHALL be protected by the `x-internal-secret` header matching `REACTION_INTERNAL_SECRET`. This endpoint is called by the main server to proxy write requests.

#### Scenario: Successful create
- **WHEN** the server sends `POST /internal/create` with `{ userId: "u1", targetId: "abc", reaction: "like" }` and valid `x-internal-secret` header
- **THEN** the system creates the Reaction row, upserts the ReactionSummary counter, and returns `{ id, userId, targetId, reaction, createdAt, created: true }` with status 201

#### Scenario: Idempotent create
- **WHEN** the server sends `POST /internal/create` with a reaction that already exists
- **THEN** the system returns the existing record with `{ created: false }` and status 200

#### Scenario: Invalid reaction type
- **WHEN** the server sends `POST /internal/create` with an invalid reaction type
- **THEN** the system returns status 400 with an error message

#### Scenario: Invalid or missing secret
- **WHEN** a client sends `POST /internal/create` without a valid `x-internal-secret` header
- **THEN** the system returns status 401

### Requirement: Internal remove endpoint
The reaction service SHALL provide a `POST /internal/remove` endpoint that deletes a reaction for a given user. The endpoint SHALL be protected by the `x-internal-secret` header.

#### Scenario: Successful remove
- **WHEN** the server sends `POST /internal/remove` with `{ userId: "u1", targetId: "abc", reaction: "like" }` and valid secret
- **THEN** the system deletes the Reaction row, decrements the ReactionSummary counter, and returns `{ deleted: true }`

#### Scenario: Idempotent remove
- **WHEN** the server sends `POST /internal/remove` for a reaction that doesn't exist
- **THEN** the system returns `{ deleted: false }`

#### Scenario: Invalid or missing secret
- **WHEN** a client sends `POST /internal/remove` without a valid `x-internal-secret` header
- **THEN** the system returns status 401

### Requirement: Cleanup reactions on unit deletion
The system SHALL provide a `POST /internal/cleanup` endpoint that deletes all Reaction and ReactionSummary rows for a given `targetId`. The endpoint SHALL be protected by the `x-internal-secret` header matching `REACTION_INTERNAL_SECRET`.

#### Scenario: Successful cleanup
- **WHEN** the server sends `POST /internal/cleanup` with `{ targetId: "abc" }` and valid `x-internal-secret` header
- **THEN** the system deletes all Reaction rows where `targetId = "abc"`, deletes all ReactionSummary rows where `targetId = "abc"`, and returns `{ deleted: true, count: <number_of_reactions_deleted> }`

#### Scenario: Cleanup for target with no reactions
- **WHEN** the server sends `POST /internal/cleanup` with `{ targetId: "xyz" }` and no reactions exist for that target
- **THEN** the system returns `{ deleted: true, count: 0 }`

#### Scenario: Invalid or missing secret
- **WHEN** a client sends `POST /internal/cleanup` without a valid `x-internal-secret` header
- **THEN** the system returns status 401

### Requirement: Server calls cleanup on unit deletion
The main server (`@rezics/server`) SHALL call the reaction service's `POST /internal/cleanup` endpoint when a Unit is deleted. The call SHALL be synchronous — the server waits for the cleanup response before completing the deletion.

#### Scenario: Unit deletion triggers cleanup
- **WHEN** the server deletes a Unit with `id = "abc"`
- **THEN** the server sends `POST /internal/cleanup { targetId: "abc" }` to the reaction service before completing the deletion transaction

#### Scenario: Cleanup call failure
- **WHEN** the reaction service is unavailable during unit deletion
- **THEN** the server logs the error and proceeds with the deletion. Orphan reactions are acceptable and cleaned up by periodic reconciliation.
