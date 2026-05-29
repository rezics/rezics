## ADDED Requirements

### Requirement: Thread read exposes viewer promotion capability

The thread read response SHALL carry a viewer-derived boolean `viewerCanPromote`
indicating whether the current caller may pin or accept within this thread. This
value SHALL be computed from the same authorization predicate used by the write
guard (`assertCanPromoteInThread`): true for the thread author (OP), a realm
moderator/owner of the thread's realm, or a platform admin; false otherwise. The
field SHALL be `false` for an unauthenticated caller. Exposing this signal SHALL NOT
change who is actually authorized to promote — the write guard remains the single
source of truth.

#### Scenario: OP sees promotion capability on their thread
- **WHEN** the thread author reads their own thread
- **THEN** the read response SHALL report `viewerCanPromote = true`

#### Scenario: Unrelated viewer sees no capability
- **WHEN** a user who is neither OP nor a realm moderator/owner nor admin reads the thread
- **THEN** the read response SHALL report `viewerCanPromote = false`

#### Scenario: Anonymous read reports no capability
- **WHEN** an unauthenticated caller reads the thread
- **THEN** the read response SHALL report `viewerCanPromote = false`

#### Scenario: Read capability matches the write guard
- **WHEN** `viewerCanPromote` is `false` for a caller who then attempts to pin
- **THEN** the write guard SHALL also reject that caller with an authorization error

### Requirement: Thread read exposes question-thread eligibility

The thread read response SHALL carry a boolean `isQuestionThread` indicating whether
the thread root bears the official question tag, reusing the existing
`isQuestionThread()` service check. This signal SHALL allow clients to gate the
accept-answer affordance without a separate query, and SHALL NOT alter the server's
own accept-answer validation.

#### Scenario: Question thread is flagged
- **WHEN** a thread whose root bears the official question tag is read
- **THEN** the read response SHALL report `isQuestionThread = true`

#### Scenario: Non-question thread is flagged false
- **WHEN** a thread whose root does not bear the official question tag is read
- **THEN** the read response SHALL report `isQuestionThread = false`
