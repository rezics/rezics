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

### Requirement: Internal by-user lookup endpoint

The reaction service SHALL provide `POST /internal/by-user` (protected by `x-internal-secret` matching `REACTION_INTERNAL_SECRET`) that returns reaction events placed on a given target id set, optionally filtered. This endpoint exists to support the main server's profile-scoped Received view without giving the reaction service knowledge of Unit ownership.

Request body:

```ts
{
  targetIds: string[];          // up to 1000 per call; 400 if exceeded
  reactions?: string[];         // optional reaction-type allowlist
  excludeUserId?: string;       // exclude self-reactions
  cursor?: string;              // opaque continuation token
  limit?: number;               // default 20, max 50; clamped
}
```

Response shape:

```ts
{
  items: Array<{
    id: string;
    userId: string;
    targetId: string;
    reaction: string;
    createdAt: string; // ISO 8601
  }>;
  nextCursor: string | null;
}
```

Rows SHALL be ordered `createdAt desc, id desc`. The cursor encoding SHALL be opaque and stable, identical in shape to the cursors emitted by `GET /reaction/given`.

#### Scenario: Successful lookup
- **WHEN** the main server sends `POST /internal/by-user` with `targetIds: ["t1","t2"]`, `excludeUserId: "owner"` and a valid secret
- **THEN** the system returns up to `limit` reactions on those targets where `userId != "owner"`, ordered correctly
- **AND** `nextCursor` reflects continuation availability

#### Scenario: Empty targetIds returns empty result
- **WHEN** the main server sends `POST /internal/by-user` with `targetIds: []`
- **THEN** the system returns `{ items: [], nextCursor: null }`

#### Scenario: targetIds size cap
- **WHEN** the main server sends more than 1000 targetIds in a single request
- **THEN** the system returns status 400 with an error indicating the cap

#### Scenario: Invalid or missing secret
- **WHEN** a client sends `POST /internal/by-user` without a valid `x-internal-secret`
- **THEN** the system returns status 401

#### Scenario: Reaction type filter
- **WHEN** the main server sends `POST /internal/by-user` with `reactions: ["like"]`
- **THEN** the system returns only rows where `reaction = "like"`
