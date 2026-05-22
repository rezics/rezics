## MODIFIED Requirements

### Requirement: Wiki post collaborative edit path

Wiki post content edits SHALL submit and persist full `ContentDoc` JSON. The supported collaborative edit surface in this change is only `content.main`; slots, layout, inline directives, and unknown JSON parts are preserved but not processed. The primary runtime keys SHALL be `post.content` and `post.content.main`. Slot/layout field keys are reserved for follow-up work and SHALL NOT be enforced or emitted by this change. The legacy field key `post.body` SHALL NOT be used.

#### Scenario: Community edits unlocked wiki post main content

- **WHEN** a wiki post has no `UnitFieldLock("*")`, `UnitFieldLock("post.content")`, or `UnitFieldLock("post.content.main")`
- **AND** a community editor submits full `ContentDoc` JSON whose `main` value changes the stored main content
- **THEN** the edit SHALL be accepted after authority checks

#### Scenario: Locked main content blocks community edit

- **WHEN** a wiki post has `UnitFieldLock("post.content.main")`
- **AND** a community editor submits full `ContentDoc` JSON whose `main` value changes the stored main content
- **THEN** the edit SHALL be rejected with locked-field metadata

#### Scenario: Slot-only edit is persisted but not supported

- **WHEN** a community editor submits full `ContentDoc` JSON that changes only `content.slots.infobox`
- **THEN** the server MAY persist the submitted JSON
- **AND** this change SHALL NOT render, index, lock-check, or emit history for that slot-only change

#### Scenario: Main null clears wiki main content

- **WHEN** a community editor submits full `ContentDoc` JSON with `main = null`
- **AND** the stored `content.main` is not null or absent
- **THEN** the edit SHALL clear main content after authority checks
- **AND** the emitted changed field key SHALL be `post.content.main`

#### Scenario: Repeated main is history no-op

- **WHEN** a community editor submits full `ContentDoc` JSON whose `main` value is structurally equal to the stored `content.main`
- **THEN** the server SHALL NOT emit a history outbox row for main content
- **AND** non-main JSON differences MAY still be persisted because create/update stores full JSON

### Requirement: Wiki post history

Wiki post creation and edits SHALL emit history outbox records only when supported main content changes. The history payload SHALL include the full submitted `ContentDoc` in the `post` editorial slot. Changed field keys SHALL use `post.content.main` and SHALL NOT include `post.body`, slot keys, or layout keys in this change.

#### Scenario: Wiki post edit records revision

- **WHEN** a user edits a wiki post and changes `content.main.source`
- **THEN** the main server SHALL write a `HistoryOutbox` row in the same transaction
- **AND** the history service SHALL persist a Unit revision whose `post` slot is the new `ContentDoc`
- **AND** the revision's `changedFieldKeys` SHALL include `post.content.main`

#### Scenario: Wiki infobox edit records sub-path key

- **WHEN** a user edits a wiki post and changes only `content.slots.infobox`
- **THEN** this change SHALL NOT emit a content history revision solely for that slot-only change
- **AND** SHALL NOT include `post.body` or `post.content.slots.infobox`

### Requirement: Wiki post editor UI

The frontend SHALL provide a wiki post editor for creating and editing `PostKind.WIKI` content. The editor SHALL display locked-field errors keyed by `post.content.main` / `post.content` and SHALL distinguish wiki edits from ordinary reply/review editors. In v1 the editor surface writes Markdown into `content.main.source`; structured slot editing UI (infobox, entity-list, layout controls) is out of scope for this change and is delivered by the follow-up rendering / editing change.

#### Scenario: Locked content error

- **WHEN** a user attempts to save a wiki post and the server returns a locked field error for `post.content.main` or `post.content`
- **THEN** the editor SHALL show an actionable locked-field error state
- **AND** it SHALL preserve the user's unsaved draft

## REMOVED Requirements

### Requirement: Wiki post body edits via post.body field key

**Reason**: The `post.body` column and field key are removed by this change. Supported v1 edits, locks, and history are now keyed by `post.content.main`.

**Migration**: All wiki-post-editing call sites that previously emitted, checked, or rendered the `post.body` field key SHALL be updated to use the content sub-path vocabulary. The "Wiki post collaborative edit path" and "Wiki post history" requirements above replace the previous wording.
