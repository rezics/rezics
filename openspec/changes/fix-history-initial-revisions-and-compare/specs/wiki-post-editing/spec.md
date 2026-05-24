## MODIFIED Requirements

### Requirement: Wiki post history

Wiki post creation and edits SHALL emit history outbox records only when supported main content changes or when the wiki post is first created with supported main content. The history payload SHALL include the effective `post.content` editorial patch. Changed field keys SHALL use `post.content.main` and SHALL NOT include `post.body`, slot keys, or layout keys in this change.

#### Scenario: Wiki post creation records initial revision

- **WHEN** a user creates a wiki post with supported main content
- **THEN** the main server SHALL write a `HistoryOutbox` row in the same transaction
- **AND** the history service SHALL persist a Unit revision whose payload includes the created `post.content`
- **AND** the revision's `changedFieldKeys` SHALL include `post.content.main`

#### Scenario: Wiki post edit records revision

- **WHEN** a user edits a wiki post and changes `content.main.source`
- **THEN** the main server SHALL write a `HistoryOutbox` row in the same transaction
- **AND** the history service SHALL persist a Unit revision whose payload includes the new `post.content`
- **AND** the revision's `changedFieldKeys` SHALL include `post.content.main`

#### Scenario: Wiki infobox edit records sub-path key

- **WHEN** a user edits a wiki post and changes only `content.slots.infobox`
- **THEN** this change SHALL NOT emit a content history revision solely for that slot-only change
- **AND** SHALL NOT include `post.body` or `post.content.slots.infobox`
