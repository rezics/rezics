## MODIFIED Requirements

### Requirement: Threaded reply view sorted by sort path

When a user opens a thread, the system SHALL display all replies in threaded
mode as a tree grouped by parent. Sibling order within the tree SHALL be
derived from a database-expressible `ORDER BY` key (default `createdAt`
ascending); it SHALL NOT be derived from a materialized `sortPath` column.
The thread subtree SHALL be bounded by `rootPostUnitId` (whole thread) or by
`path <@ anchor.path` (continue-thread anchor), not by a `sortPath` prefix.

Thread loading SHALL be bounded by server-enforced depth: the client SHALL
query with `mode: "threaded"` and `maxDepth: 5` (or a documented override).
Replies deeper than `maxDepth` SHALL NOT be returned in the initial response.
The visual indentation applied on the client SHALL cap at a configurable
`VISUAL_MAX_DEPTH` (default 4); replies whose `depth` exceeds this value render
with the capped indentation while the real `depth` remains available for
logical operations.

When a loaded reply sits at the loaded depth limit and still has further
replies (`directReplyCount > 0` on a truncated branch), the reply SHALL expose
a "continue thread" affordance. Activating the affordance SHALL anchor a fresh
thread view with that reply as the new root, issuing a new query for its
subtree via `path <@ anchor.path` scoped to the anchor's `rootPostUnitId`.

Collapse state for branches SHALL be owned by the thread orchestrator
(`PostTreeSection`) rather than the reply component. Replies at `depth >= 2`
SHALL be collapsed by default on initial render; the user SHALL be able to
expand any branch.

#### Scenario: Thread with nested replies

- **WHEN** a user opens a thread that has direct replies and nested replies to those replies
- **THEN** replies SHALL be displayed as a tree grouped by parent, siblings ordered by the DB `ORDER BY` key (default `createdAt`)
- **AND** the nesting depth SHALL be visually indicated using the `depth` field capped at `VISUAL_MAX_DEPTH`

#### Scenario: Flat display mode

- **WHEN** the display mode is set to flat
- **THEN** all replies in the thread SHALL be displayed in `createdAt` order without nesting indentation

#### Scenario: Thread truncated at server maxDepth

- **WHEN** a thread contains replies at `depth > 5`
- **THEN** the initial query SHALL NOT return those replies
- **AND** the deepest loaded reply on that branch SHALL, if it has further replies, render a "continue thread" affordance
- **AND** activating the affordance SHALL load a new thread view rooted on that reply via `path <@ anchor.path`

#### Scenario: Default collapse beyond depth 2

- **WHEN** a thread with replies at depth 0, 1, 2, and 3 first renders
- **THEN** replies at `depth >= 2` SHALL be collapsed by default
- **AND** the user SHALL be able to expand any subtree by activating its collapse control
