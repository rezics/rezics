# wiki-post-editing Specification

## Purpose

Defines `PostKind.WIKI`, a collaborative post kind that reuses the existing `Unit(type=POST)` and `Post` primitives rather than a separate wiki-page model. Wiki posts route through the collaborative authority gate using `post.body` as a field key, emit history through the same transactional outbox as other collaborative edits, and expose a wiki-aware editor and timeline UI. Ordinary post kinds (`POST`, `REVIEW`, `REMARK`, `REPLY`, `EXCERPT`, `CHAPTER`) remain author/owner-controlled, and `Post.isLocked` retains its existing thread-lock semantics distinct from `UnitFieldLock`.

## Requirements

### Requirement: Wiki post kind
The contract SHALL define `PostKind.WIKI` for collaborative wiki-style post content. Wiki posts SHALL use the existing `Unit(type=POST)` and `Post` model rather than a separate wiki page model.

#### Scenario: Contract includes wiki post kind
- **WHEN** app, API, and server code import `PostKind`
- **THEN** `PostKind.WIKI` SHALL be available as a typed value

### Requirement: Wiki post creation
Wiki post creation SHALL create a POST Unit and Post row with `Post.kind = WIKI`. Wiki-mode wiki post creation SHALL set `Unit.userId = rezicsWikiUser.unitId`, while `Post.authorUserId` SHALL record the user who created the first version.

#### Scenario: Ordinary user creates wiki post
- **WHEN** an authenticated ordinary user creates a wiki post for a book
- **THEN** the system SHALL create `Unit(type=POST)` with `userId = rezicsWikiUser.unitId`
- **AND** it SHALL create `Post.kind = WIKI`
- **AND** it SHALL set `Post.authorUserId` to the creating user's Unit id

### Requirement: Wiki post target
Wiki posts MAY target another Unit through `Post.targetUnitId`. When present, the target SHALL identify the subject that the wiki post documents or extends.

#### Scenario: Wiki post targets book
- **WHEN** a user creates a wiki post on a book detail page
- **THEN** the created Post SHALL store the book Unit id in `targetUnitId`

### Requirement: Wiki post collaborative edit path
Wiki post body edits SHALL use the collaborative Unit field authority gate with changed field key `post.body`. Locked wiki post bodies SHALL reject community edits; unlocked wiki post bodies SHALL accept community edits on collaborative endpoints.

#### Scenario: Community edits unlocked wiki post
- **WHEN** a wiki post has no `UnitFieldLock("*")` or `UnitFieldLock("post.body")`
- **AND** a community editor submits a wiki post body edit through the wiki edit endpoint
- **THEN** the edit SHALL be accepted after authority checks

#### Scenario: Locked wiki post blocks community edit
- **WHEN** a wiki post has a `UnitFieldLock("post.body")`
- **AND** a community editor submits a body edit
- **THEN** the edit SHALL be rejected with locked field metadata

### Requirement: Ordinary posts remain non-collaborative
Ordinary post kinds SHALL retain existing author/owner permission semantics. `POST`, `REVIEW`, `REMARK`, `REPLY`, `EXCERPT`, and `CHAPTER` SHALL NOT be community-editable merely because field locks are absent.

#### Scenario: Review cannot be community edited
- **WHEN** user B attempts to edit user A's REVIEW post
- **AND** there is no lock row for that post Unit
- **THEN** the edit SHALL still be rejected by ordinary post permissions

### Requirement: Wiki post history
Wiki post creation and edits SHALL emit history outbox records. The history payload SHALL include the current markdown body in the `post` slot and changed field keys including `post.body` when the body changes.

#### Scenario: Wiki post edit records revision
- **WHEN** a user edits a wiki post body
- **THEN** the main server SHALL write a `HistoryOutbox` row in the same transaction
- **AND** the history service SHALL persist a Unit revision for the wiki post

### Requirement: Wiki post editor UI
The frontend SHALL provide a wiki post editor for creating and editing `PostKind.WIKI` content. The editor SHALL display locked-field errors and SHALL distinguish wiki edits from ordinary reply/review editors.

#### Scenario: Locked body error
- **WHEN** a user attempts to save a wiki post body and the server returns a locked `post.body` error
- **THEN** the editor SHALL show an actionable locked-field error state
- **AND** it SHALL preserve the user's unsaved draft

### Requirement: Wiki post timeline link
Wiki post detail surfaces SHALL expose a history link that loads the wiki post's Unit revision timeline.

#### Scenario: User opens wiki post history
- **WHEN** a user opens the history link for a wiki post
- **THEN** the frontend SHALL request the wiki post's revision timeline from the history service client
- **AND** it SHALL render an empty state if no revisions have been ingested yet

### Requirement: Post isLocked remains thread lock
`Post.isLocked` SHALL keep its existing reply/thread locking meaning and SHALL NOT be reused as the wiki field-lock mechanism.

#### Scenario: Thread lock does not equal body lock
- **WHEN** a wiki post has `Post.isLocked = true` but no `UnitFieldLock("post.body")`
- **THEN** reply creation MAY be blocked by thread-lock rules
- **AND** wiki body editing SHALL still be controlled by `UnitFieldLock` and collaborative authority rules
