# reaction-api Specification

## Purpose

Owns the reaction service's HTTP surface: JWT verification
of the server-issued `rezics-session-token` plus the
`x-internal-secret` shared secret that gates internal
endpoints; the user-facing `POST /reactions` and
`DELETE /reactions` create/delete flow (idempotent, allowlist-
validated, transactionally consistent with the summary
counter); the internal endpoints (`/internal/create`,
`/internal/remove`, `/internal/cleanup`, `/internal/by-user`)
that the main server proxies to; the public batch summary at
`GET /reactions/summary`; and the authenticated batch user-
state at `GET /reactions/my`. Previously split across
`reaction-auth`, `reaction-crud`, `reaction-internal-api`,
`reaction-summary`, and `reaction-user-state`.

## Authentication

### Requirement: JWT verification for read endpoints

Reaction service SHALL verify `rezics-session-token` (issued by server) on authenticated read endpoints (`GET /reactions/my`) using `createJwtVerifier()` and `createRemoteJWKSet()` from `@rezics/jwt` against the server's JWKS endpoint. The token is received via `Authorization: Bearer`.

#### Scenario: Valid rezics-session-token grants access to user reactions

- **WHEN** `GET /reactions/my` receives a request with `Authorization: Bearer <valid-rezics-session-token>`
- **THEN** the JWT is verified against the server's JWKS, `sub` is extracted as user identity, and the user's reactions are returned

#### Scenario: auth-session-token is rejected

- **WHEN** a request includes an `auth-session-token` in `Authorization: Bearer`
- **THEN** verification fails (issuer mismatch) and the endpoint returns 401

### Requirement: Shared secret for internal endpoints

Reaction service SHALL verify `x-internal-secret` header on internal endpoints. Secret SHALL match `REACTION_INTERNAL_SECRET` environment variable. Unchanged by this change.

#### Scenario: Internal write uses shared secret

- **WHEN** the server proxies a write operation to the reaction service
- **THEN** it authenticates via `x-internal-secret` header

### Requirement: Unauthenticated summary endpoint

`GET /reactions/summary` endpoint SHALL NOT require authentication. Reaction counts are public data. Unchanged.

#### Scenario: Summary endpoint is public

- **WHEN** `GET /reactions/summary` is called without any authorization header
- **THEN** the endpoint returns reaction counts normally

### Requirement: Main server proxies writes with JWT auth

Main server's `POST /reactions` and `DELETE /reactions` endpoints SHALL verify user identity via `rezics-session-token` using `requireLogin` macro, then call reaction service's internal endpoints with shared secret.

#### Scenario: Server verifies rezics-session-token before proxying

- **WHEN** a user calls `POST /reactions` on the main server
- **THEN** the server verifies the `rezics-session-token` via `requireLogin`, extracts the user identity, and proxies the request to the reaction service with `x-internal-secret`

## CRUD operations

### Requirement: Create reaction
The system SHALL allow an authenticated user to create a reaction on a target by providing a `targetId` and a `reaction` type. The write request goes to the **main server** (`POST /reactions`), which proxies it to the reaction service's internal API (`POST /internal/create`). The operation SHALL be idempotent — creating an already-existing reaction SHALL return the existing record without error. The `reaction` value SHALL be validated against the configured allowlist (default: `like`, `dislike`). The system SHALL reject reactions with types not in the allowlist with a 400 status.

#### Scenario: Create a new reaction
- **WHEN** an authenticated user sends `POST /reactions` to the main server with `{ targetId: "abc", reaction: "like" }`
- **THEN** the server calls `POST /internal/create` on the reaction service with `{ userId, targetId: "abc", reaction: "like" }`, which creates a Reaction row and returns `{ id, userId, targetId, reaction, createdAt, created: true }` with status 201

#### Scenario: Idempotent create
- **WHEN** an authenticated user sends `POST /reactions` with `{ targetId: "abc", reaction: "like" }` and a matching Reaction already exists
- **THEN** the reaction service returns the existing record with `{ created: false }` and status 200, no duplicate row is created, and the summary counter is not incremented

#### Scenario: Invalid reaction type
- **WHEN** an authenticated user sends `POST /reactions` with `{ targetId: "abc", reaction: "bookmark" }`
- **THEN** the reaction service returns status 400 with an error indicating the reaction type is not allowed

#### Scenario: Summary counter increment
- **WHEN** a new reaction is successfully created (not idempotent hit)
- **THEN** the corresponding ReactionSummary row is upserted with `count` incremented by 1, within the same database transaction

### Requirement: Delete reaction
The system SHALL allow an authenticated user to delete their own reaction by providing `targetId` and `reaction` type. The write request goes to the **main server** (`DELETE /reactions`), which proxies it to the reaction service's internal API (`POST /internal/remove`). The operation SHALL be idempotent — deleting a non-existent reaction SHALL return `{ deleted: false }` without error.

#### Scenario: Delete an existing reaction
- **WHEN** an authenticated user sends `DELETE /reactions?targetId=abc&reaction=like` to the main server
- **THEN** the server calls `POST /internal/remove` on the reaction service, which deletes the Reaction row, decrements the ReactionSummary counter, and returns `{ deleted: true }`

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

## Internal API

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

## Summary endpoints

### Requirement: Batch reaction summary

The system SHALL provide a `GET /reactions/summary` endpoint that returns aggregated reaction counts for one or more targets. The endpoint SHALL accept a `targetIds` query parameter (comma-separated or repeated). The endpoint SHALL NOT require authentication — reaction counts are public data.

Frontend consumers SHALL obtain summaries exclusively via this endpoint (typically through `useReactionHydration` and the underlying `useBatchReactionSummary` query). List and detail responses from the main server SHALL NOT carry a `reactionSummaries` field — consumers cannot rely on a server-side join.

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

#### Scenario: List endpoints do not embed summaries
- **WHEN** a client receives a list/detail response (post, review, remark, excerpt, shelf, realm, book) from the main server
- **THEN** the response payload SHALL NOT contain a `reactionSummaries` field
- **AND** the client MUST call `GET /reactions/summary` directly to obtain counts

### Requirement: Summary reflects real-time state

ReactionSummary counts SHALL be updated synchronously within the same transaction as reaction create/delete operations. The summary endpoint SHALL always return the current committed count. Frontend optimistic updates write to client cache only; the canonical count is whatever this endpoint returns.

#### Scenario: Summary after create
- **WHEN** a user creates a `like` reaction on target `abc` (which had 5 likes)
- **THEN** an immediate `GET /reactions/summary?targetIds=abc` returns `{ "like": 6 }`

#### Scenario: Summary after delete
- **WHEN** a user deletes their `like` reaction on target `abc` (which had 6 likes)
- **THEN** an immediate `GET /reactions/summary?targetIds=abc` returns `{ "like": 5 }`

#### Scenario: Optimistic client cache reconciles with server
- **WHEN** a client has an optimistic count that diverges from the server-returned value (e.g. a concurrent reaction landed)
- **THEN** the client cache SHALL reconcile to the server value once the create/remove response is received
- **AND** the bar re-renders with the reconciled count

### Requirement: ReactionSummary changes invalidate ranking

Changes to `ReactionSummary` SHALL be treated as ranking invalidation inputs for the summary's `targetId`. The reaction service SHALL remain independent from ranking formulas and Meilisearch patching.

#### Scenario: Summary increment invalidates ranking
- **WHEN** a reaction create increments `ReactionSummary(targetId = "unit-1", reaction = "like")`
- **THEN** the CDC-to-queue path SHALL enqueue a ranking invalidation for `unit-1`

#### Scenario: Summary decrement invalidates ranking
- **WHEN** a reaction delete decrements `ReactionSummary(targetId = "unit-1", reaction = "like")`
- **THEN** the CDC-to-queue path SHALL enqueue a ranking invalidation for `unit-1`

### Requirement: Ranking consumes summaries through service boundary

Ranking recomputation SHALL obtain reaction counts through the reaction service summary API or an internal batch summary endpoint. Ranking SHALL NOT require direct writes to the reaction database and SHALL NOT make the main server embed reaction summaries in list responses.

#### Scenario: Ranking fetches current summary
- **WHEN** ranking recomputes scores for `unit-1`
- **THEN** it SHALL request the current reaction summary for `unit-1` through the reaction service boundary
- **AND** it SHALL use the returned current counts as ranking signals

#### Scenario: List responses remain summary-free
- **WHEN** a client receives a list/detail response from the main server
- **THEN** the response SHALL remain free of a `reactionSummaries` field

## User state endpoints

### Requirement: Batch user reaction state

The system SHALL provide a `GET /reactions/my` endpoint that returns the authenticated user's reaction types for one or more targets. The endpoint SHALL require a valid auth JWT.

Frontend consumers SHALL obtain the user's reaction state exclusively via this endpoint (typically through `useReactionHydration` calling `useBatchUserReactions` internally). List and detail responses from the main server SHALL NOT carry a `userReactions` field — consumers cannot rely on a server-side join. The hook SHALL be skipped automatically when no session is present so that logged-out users do not generate 401 traffic.

#### Scenario: Single target user state
- **WHEN** an authenticated user sends `GET /reactions/my?targetIds=abc` and they have a `like` reaction on `abc`
- **THEN** the system returns `{ userId: "user1", reactionsByTarget: { "abc": ["like"] } }`

#### Scenario: Multi-target user state
- **WHEN** an authenticated user sends `GET /reactions/my?targetIds=abc,def` and they have `like` on `abc` and `dislike` on `def`
- **THEN** the system returns `{ userId: "user1", reactionsByTarget: { "abc": ["like"], "def": ["dislike"] } }`

#### Scenario: No reactions on target
- **WHEN** an authenticated user sends `GET /reactions/my?targetIds=abc` and they have no reactions on `abc`
- **THEN** the system returns `{ userId: "user1", reactionsByTarget: { "abc": [] } }`

#### Scenario: No targets provided
- **WHEN** an authenticated user sends `GET /reactions/my` with no `targetIds`
- **THEN** the system returns `{ userId: "user1", reactionsByTarget: {} }` with status 200

#### Scenario: Unauthenticated request
- **WHEN** a client sends `GET /reactions/my` without a valid JWT
- **THEN** the system returns status 401

#### Scenario: List endpoints do not embed user reactions
- **WHEN** a client receives a list/detail response (post, review, remark, excerpt, shelf, realm, book) from the main server
- **THEN** the response payload SHALL NOT contain a `userReactions` field
- **AND** an authenticated client MUST call `GET /reactions/my` directly to obtain user-specific state

#### Scenario: Frontend skips the call when logged out
- **WHEN** an unauthenticated session triggers `useReactionHydration(targetIds)`
- **THEN** the underlying `GET /reactions/my` query SHALL NOT fire
- **AND** consumer hooks return an empty `userReactions` array for every target
