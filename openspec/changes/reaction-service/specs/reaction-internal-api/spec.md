## ADDED Requirements

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

### Requirement: Server exposes owner resolution endpoint
The main server SHALL expose a `GET /internal/units/owner` endpoint, protected by `x-internal-secret`, that resolves a Unit's owner by ID.

#### Scenario: Resolve existing unit owner
- **WHEN** the reaction service sends `GET /internal/units/owner?id=abc` with valid secret
- **THEN** the server returns `{ ownerId: "user123" }`

#### Scenario: Unit not found
- **WHEN** the reaction service sends `GET /internal/units/owner?id=nonexistent` with valid secret
- **THEN** the server returns status 404

#### Scenario: Missing secret
- **WHEN** a client sends `GET /internal/units/owner` without a valid `x-internal-secret` header
- **THEN** the server returns status 401
