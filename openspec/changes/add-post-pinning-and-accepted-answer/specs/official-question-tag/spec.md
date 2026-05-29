## ADDED Requirements

### Requirement: A platform-reserved question tag marks Q&A threads

The contract SHALL define a platform-reserved question tag slug constant. A `Unit(type=TAG)` whose slug equals that constant SHALL be the official question tag, uniform across all realms. A thread SHALL be a Q&A thread when its root post bears the official question tag (via `UnitTag` or an equivalent application), and SHALL NOT be a Q&A thread otherwise.

#### Scenario: Root post bearing the question tag makes a Q&A thread

- **GIVEN** the official question tag with the reserved slug
- **WHEN** a root post is tagged with that tag
- **THEN** its thread SHALL be recognized as a Q&A thread

#### Scenario: Thread without the question tag is not Q&A

- **WHEN** a root post bears no official question tag
- **THEN** its thread SHALL NOT be a Q&A thread
- **AND** `ACCEPTED_ANSWER` promotion SHALL be rejected for posts in that thread

### Requirement: Accepted answer is a gated ACCEPTED_ANSWER promotion

An accepted answer SHALL be a `PostPin` with `kind = ACCEPTED_ANSWER` and `scopeUnitId` equal to the thread root post's unit id. Accepting SHALL be permitted only when the thread is a Q&A thread and the target post satisfies `depth == 1` and `parentPostUnitId == rootPostUnitId` (a direct reply to the question). A question MAY have multiple accepted answers; their relative order SHALL be given by `position`.

#### Scenario: Accept a direct reply to a question

- **GIVEN** a Q&A thread rooted at `R` and a direct reply `A` with `depth == 1` and `parentPostUnitId == R.unitId`
- **WHEN** an authorized actor accepts `A`
- **THEN** a `PostPin` row SHALL be created with `kind = ACCEPTED_ANSWER` and `scopeUnitId = R.unitId`

#### Scenario: Reject accepting a non-direct reply

- **GIVEN** a Q&A thread and a nested reply `B` with `depth >= 2`
- **WHEN** an actor attempts to accept `B`
- **THEN** the request SHALL be rejected with a validation error

#### Scenario: Multiple accepted answers ordered by position

- **GIVEN** a Q&A thread with two accepted direct replies
- **WHEN** the thread is rendered
- **THEN** both SHALL appear as accepted answers ordered by `position`

### Requirement: Accept and unaccept are authorized by OP or moderator

Accepting or unaccepting an answer SHALL be permitted to the thread author (OP) or a realm moderator/owner of a realm the thread belongs to. Other actors SHALL be rejected.

#### Scenario: OP accepts an answer

- **WHEN** the thread author accepts a qualifying direct reply
- **THEN** the accepted-answer promotion SHALL be created

#### Scenario: Moderator accepts on behalf of an inactive OP

- **WHEN** a realm moderator/owner of a realm the thread belongs to accepts a qualifying direct reply
- **THEN** the accepted-answer promotion SHALL be created

#### Scenario: Unauthorized accept is rejected

- **WHEN** a user who is neither OP nor moderator/owner attempts to accept an answer
- **THEN** the request SHALL be rejected with an authorization error

### Requirement: Accepted answers render with an accepted badge ahead of pins

An accepted answer SHALL render ahead of `PINNED` posts and ordinary replies within its sibling group, and SHALL carry a `pinKind = ACCEPTED_ANSWER` so the UI shows an accepted-answer badge distinct from a general pin badge.

#### Scenario: Accepted answer leads its sibling group with a distinct badge

- **GIVEN** a Q&A sibling group containing an accepted answer, a pinned reply, and ordinary replies
- **WHEN** the group is rendered
- **THEN** the accepted answer SHALL appear first with an accepted-answer badge
- **AND** the pinned reply SHALL appear next with a general pin badge
