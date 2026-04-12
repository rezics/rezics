## ADDED Requirements

### Requirement: Batch user reaction state
The system SHALL provide a `GET /reactions/my` endpoint that returns the authenticated user's reaction types for one or more targets. The endpoint SHALL require a valid auth JWT.

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
