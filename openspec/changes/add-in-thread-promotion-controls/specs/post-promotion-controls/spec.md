## ADDED Requirements

### Requirement: In-thread promotion controls render through the overflow seam

Interactive pin/unpin and accept/unaccept controls SHALL be injected through the
existing `renderOverflowContent` seam on `PostTreeNode` / `PostReply` (rendered in
the `ReactionBar` overflow menu), not as a new top-level prop chain. `PostTreeSection`
SHALL own the `renderOverflowContent` callback so the rest of the tree presentation
stays unchanged. A reply with no available promotion action SHALL render no extra
overflow entries.

#### Scenario: Controls appear in the reply overflow menu
- **WHEN** a reply is rendered for a viewer who may promote within the thread
- **THEN** the reply's overflow menu SHALL contain promotion control entries
- **AND** they SHALL be supplied via `renderOverflowContent`, not a bespoke prop on `PostReply`

#### Scenario: No actions yields no overflow entries
- **WHEN** a reply has no promotion action available to the viewer
- **THEN** `renderOverflowContent` SHALL contribute no entries for that reply

### Requirement: Promotion controls are gated by viewer authority and thread context

The controls SHALL be shown only when the thread read response reports the viewer
may promote (`viewerCanPromote === true`). The pin/unpin control SHALL be available
on any reply (`depth >= 1`) within the thread. The accept/unaccept control SHALL be
available only when the thread is a question thread (`isQuestionThread === true`)
AND the target reply is a direct child of the thread root (`depth === 1`), mirroring
the server's accept-answer rules. An anonymous viewer (no session) SHALL see no
promotion controls.

#### Scenario: Viewer without promotion authority sees no controls
- **WHEN** the thread read reports `viewerCanPromote === false`
- **THEN** no pin/unpin or accept/unaccept controls SHALL render on any reply

#### Scenario: Accept is hidden on non-question threads
- **WHEN** `viewerCanPromote === true` but `isQuestionThread === false`
- **THEN** the pin/unpin control MAY render
- **AND** the accept/unaccept control SHALL NOT render on any reply

#### Scenario: Accept is hidden on deep replies
- **WHEN** `viewerCanPromote === true` and `isQuestionThread === true` and a reply has `depth > 1`
- **THEN** the accept/unaccept control SHALL NOT render on that reply
- **AND** the pin/unpin control MAY still render

#### Scenario: Anonymous viewer sees no controls
- **WHEN** there is no current user session
- **THEN** no promotion controls SHALL render regardless of other signals

### Requirement: Controls reflect current promotion state

Each control SHALL reflect the reply's current `pinKind`. A reply with no promotion
SHALL offer Pin (and Accept when eligible). A reply with `pinKind = PINNED` SHALL
offer Unpin. A reply with `pinKind = ACCEPTED_ANSWER` SHALL offer Unaccept. The
control labels SHALL come from i18n keys, consistent with the existing promotion
badge copy.

#### Scenario: Pinned reply offers unpin
- **WHEN** a reply has `pinKind = PINNED` and the viewer may promote
- **THEN** the control SHALL offer Unpin rather than Pin

#### Scenario: Accepted reply offers unaccept
- **WHEN** a reply has `pinKind = ACCEPTED_ANSWER` and the viewer may promote
- **THEN** the control SHALL offer Unaccept rather than Accept

### Requirement: Controls invoke the existing endpoints and refresh the thread

Activating a control SHALL call the corresponding existing endpoint — `POST /pins`,
`DELETE /pins/:scopeUnitId/:postUnitId`, `POST /accepted-answers`, or
`DELETE /accepted-answers/:scopeUnitId/:postUnitId` — with `scopeUnitId` set to the
thread root id and `postUnitId` set to the target reply. On success the thread query
SHALL be invalidated so promotion badges and sibling ordering reflect the change. The
client SHALL NOT re-implement server authorization; a `403` response SHALL surface a
non-destructive error and re-sync state rather than leave a falsely-applied control.

#### Scenario: Pinning refreshes ordering and badge
- **WHEN** the viewer activates Pin on an ordinary reply
- **THEN** `POST /pins` SHALL be called with `scopeUnitId` = thread root and `postUnitId` = the reply
- **AND** on success the thread query SHALL be invalidated so the reply renders its pin badge and leading order

#### Scenario: Stale authority is handled gracefully
- **WHEN** a control is activated but the server returns `403`
- **THEN** no client-only promotion state SHALL persist
- **AND** the thread state SHALL re-sync to the server truth
