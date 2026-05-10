## MODIFIED Requirements

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
