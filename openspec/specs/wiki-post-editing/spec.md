# wiki-post-editing Specification

## Purpose

Defines `PostKind.WIKI`, a collaborative post kind that reuses the existing `Unit(type=POST)` and `Post` primitives rather than a separate wiki-page model. Wiki posts route through the collaborative authority gate using `post.content` / `post.content.main` as field keys, emit history through the same transactional outbox as other collaborative edits, and expose a wiki-aware editor and timeline UI. Ordinary post kinds (`POST`, `REVIEW`, `REMARK`, `REPLY`, `EXCERPT`, `CHAPTER`) remain author/owner-controlled, and `Post.isLocked` retains its existing thread-lock semantics distinct from `UnitFieldLock`.
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

### Requirement: Ordinary posts remain non-collaborative
Ordinary post kinds SHALL retain existing author/owner permission semantics. `POST`, `REVIEW`, `REMARK`, `REPLY`, `EXCERPT`, and `CHAPTER` SHALL NOT be community-editable merely because field locks are absent.

#### Scenario: Review cannot be community edited
- **WHEN** user B attempts to edit user A's REVIEW post
- **AND** there is no lock row for that post Unit
- **THEN** the edit SHALL still be rejected by ordinary post permissions

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

### Requirement: Wiki post editor UI

The frontend SHALL provide a wiki post editor for creating and editing `PostKind.WIKI` content. The editor SHALL display locked-field errors keyed by `post.content.main` / `post.content` and SHALL distinguish wiki edits from ordinary reply/review editors. In v1 the editor surface writes Markdown into `content.main.source`; structured slot editing UI (infobox, entity-list, layout controls) is out of scope for this change and is delivered by the follow-up rendering / editing change.

#### Scenario: Locked content error

- **WHEN** a user attempts to save a wiki post and the server returns a locked field error for `post.content.main` or `post.content`
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

#### Scenario: Thread lock does not equal content lock
- **WHEN** a wiki post has `Post.isLocked = true` but no `UnitFieldLock("post.content")` or `UnitFieldLock("post.content.main")`
- **THEN** reply creation MAY be blocked by thread-lock rules
- **AND** wiki content editing SHALL still be controlled by `UnitFieldLock` and collaborative authority rules

### Requirement: Wiki translations use TranslationGroup
Parallel language variants of the same wiki page SHALL be represented as separate WIKI Post Units grouped by TranslationGroup. Wiki page body translations SHALL NOT be modeled as UnitTranslation rows on a single wiki Unit.

#### Scenario: Wiki page has parallel translations
- **GIVEN** English and Japanese wiki pages describe the same Entity
- **WHEN** the pages are linked as translations
- **THEN** each language variant SHALL remain a separate WIKI Post Unit
- **AND** the variants SHALL share a TranslationGroup

### Requirement: Featured wiki references use TranslationGroup by default
Wiki navigation and homepage configuration SHALL reference TranslationGroup ids when the intended link is a multilingual wiki page. A specific wiki Unit id SHALL be used only when the configuration intentionally targets one language-specific Unit.

#### Scenario: Homepage stores translation group
- **WHEN** a manager features the Artoria wiki page on a wiki Zone homepage
- **THEN** the configuration SHOULD store the Artoria wiki TranslationGroup id
- **AND** rendering SHALL select the viewer's best language wiki Unit

