# reaction-summary Specification

## Purpose

Defines the public `GET /reactions/summary` endpoint that returns
aggregated reaction counts for one or more `targetIds`. Owns the
batch semantics (comma-separated or repeated query parameter),
the no-auth rule (reaction counts are public), and the contract
that main-server list and detail responses do not carry a
`reactionSummaries` field — every consumer hydrates summaries
exclusively through this endpoint, typically via
`useReactionHydration` and `useBatchReactionSummary`.

## Requirements

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
