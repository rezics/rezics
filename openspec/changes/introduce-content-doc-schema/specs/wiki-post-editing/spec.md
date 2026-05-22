## MODIFIED Requirements

### Requirement: Wiki post collaborative edit path

Wiki post content edits SHALL use the collaborative Unit field authority gate with content document sub-path field keys. The primary keys SHALL be `post.content`, `post.content.main`, and `post.content.slots.<slotId>`. Locked wiki post content SHALL reject community edits; unlocked wiki post content SHALL accept community edits on collaborative endpoints. The legacy field key `post.body` SHALL NOT be used.

#### Scenario: Community edits unlocked wiki post main content

- **WHEN** a wiki post has no `UnitFieldLock("*")`, `UnitFieldLock("post.content")`, or `UnitFieldLock("post.content.main")`
- **AND** a community editor submits a wiki edit that changes `content.main.source` through the wiki edit endpoint
- **THEN** the edit SHALL be accepted after authority checks

#### Scenario: Locked main content blocks community edit

- **WHEN** a wiki post has `UnitFieldLock("post.content.main")`
- **AND** a community editor submits an edit that changes `content.main.source`
- **THEN** the edit SHALL be rejected with locked-field metadata

#### Scenario: Slot-level lock blocks only that slot

- **WHEN** a wiki post has `UnitFieldLock("post.content.slots.infobox")` and no other content locks
- **AND** a community editor submits an edit that changes only `content.slots.infobox`
- **THEN** the edit SHALL be rejected
- **AND** a separate edit that changes only `content.main.source` SHALL be admitted

### Requirement: Wiki post history

Wiki post creation and edits SHALL emit history outbox records. The history payload SHALL include the current `ContentDoc` in the `post` editorial slot. Changed field keys SHALL use content sub-paths (`post.content`, `post.content.main`, `post.content.slots.<slotId>`, `post.content.layout`) and SHALL NOT include `post.body`.

#### Scenario: Wiki post edit records revision

- **WHEN** a user edits a wiki post and changes `content.main.source`
- **THEN** the main server SHALL write a `HistoryOutbox` row in the same transaction
- **AND** the history service SHALL persist a Unit revision whose `post` slot is the new `ContentDoc`
- **AND** the revision's `changedFieldKeys` SHALL include `post.content.main`

#### Scenario: Wiki infobox edit records sub-path key

- **WHEN** a user edits a wiki post and changes only `content.slots.infobox`
- **THEN** the emitted revision's `changedFieldKeys` SHALL include `post.content.slots.infobox`
- **AND** SHALL NOT include `post.body`

### Requirement: Wiki post editor UI

The frontend SHALL provide a wiki post editor for creating and editing `PostKind.WIKI` content. The editor SHALL display locked-field errors keyed by content sub-paths and SHALL distinguish wiki edits from ordinary reply/review editors. In v1 the editor surface writes Markdown into `content.main.source`; structured slot editing (infobox, entity-list, layout) is out of scope for this change and is delivered by the follow-up rendering / editing change.

#### Scenario: Locked content error

- **WHEN** a user attempts to save a wiki post and the server returns a locked field error for `post.content.main` or `post.content`
- **THEN** the editor SHALL show an actionable locked-field error state
- **AND** it SHALL preserve the user's unsaved draft

## REMOVED Requirements

### Requirement: Wiki post body edits via post.body field key

**Reason**: The `post.body` column and field key are removed by this change. Edits, locks, and history are now keyed by content document sub-paths under `post.content.*`.

**Migration**: All wiki-post-editing call sites that previously emitted, checked, or rendered the `post.body` field key SHALL be updated to use the content sub-path vocabulary. The "Wiki post collaborative edit path" and "Wiki post history" requirements above replace the previous wording.
