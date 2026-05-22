## MODIFIED Requirements

### Requirement: Slot-based editorial payloads

Editorial revision payloads SHALL be slot-based and SHALL use stable slot names such as `unit`, `translations`, `supportLanguages`, `extension`, `credits`, `subjects`, `tags`, and `post`. When supported main content changes, the `post` slot SHALL carry the full submitted `ContentDoc` payload directly (including any preserved `schema`, `version`, `main`, `slots`, and `layout`). Long-form description slots, where present in a revision payload, SHALL likewise carry `ContentDoc`. Legacy body strings SHALL NOT appear in any new revision payload. Payload references to other Units SHALL store ids, not denormalized display names.

#### Scenario: Attribution revision stores entity id

- **WHEN** a credit attribution changes on a book
- **THEN** the revision payload SHALL store the referenced entity Unit id
- **AND** it SHALL NOT copy the entity's current display name into the revision payload

#### Scenario: Wiki revision stores content document under the post slot

- **WHEN** wiki content is edited
- **THEN** the editorial revision payload SHALL include `slots.post` as a `ContentDoc` with `schema`, `version`, `main`, optional `slots`, and optional `layout`
- **AND** it SHALL NOT store a legacy `post.body` string anywhere in the payload

#### Scenario: Wiki revision ignores slot-only edit in v1

- **WHEN** only a non-main slot of a wiki content document changes
- **THEN** the server MAY persist the new full `ContentDoc`
- **AND** this change SHALL NOT emit a slot changed-field key or create a content revision solely for that slot-only change

#### Scenario: Main no-op creates no revision

- **WHEN** a wiki content update repeats the currently stored `content.main` value
- **THEN** no history outbox row, `UnitRevision`, or `RevisionContent` SHALL be created for that update solely by content-history handling
- **AND** the canonical server MAY still persist other non-main JSON differences because persistence is full JSON

## ADDED Requirements

### Requirement: ContentDoc snapshots preserve schema version

History snapshots for long-form content SHALL preserve the `ContentDoc.schema` and `ContentDoc.version` values exactly as committed by the canonical write. The history service SHALL NOT migrate stored payloads in place when a future schema version exists.

#### Scenario: Revision reads old content version

- **WHEN** a revision created under `ContentDoc.version = 1` is read after a future schema version exists
- **THEN** the history service SHALL return the stored version 1 payload without migrating it in place

### Requirement: Content-document field keys in changedFieldKeys

`UnitRevision.changedFieldKeys` for supported long-form content edits SHALL use content sub-path keys rather than the removed `post.body` key. Runtime v1 SHALL emit only `post.content.main` for supported content changes. The broader vocabulary is reserved for future slot/layout support:

- `post.content` — whole post `ContentDoc` replaced
- `post.content.main` — `main` block changed
- `post.content.slots.<slotId>` — reserved for future slot support; not emitted by this change
- `post.content.layout` — reserved for future layout support; not emitted by this change

Multiple keys MAY appear in future revisions when a single edit touches multiple supported sub-paths.

In this change, changed field keys SHALL be derived from `content.main` structural differences only. Differences in `schema`, `version`, `slots`, `layout`, or unknown fields SHALL NOT produce history changed-field keys until those parts are supported.

#### Scenario: Edit that changes main and infobox

- **WHEN** a single wiki edit modifies both `content.main.source` and `content.slots.infobox`
- **THEN** the emitted `changedFieldKeys` SHALL include `post.content.main`
- **AND** SHALL NOT include `post.content.slots.infobox` in this change
- **AND** SHALL NOT include `post.body`

#### Scenario: Edit that only changes layout

- **WHEN** a wiki edit only reorders existing slots in `content.layout` without changing slot contents
- **THEN** no content revision SHALL be emitted by this change solely for that layout-only edit

#### Scenario: Metadata does not create history

- **WHEN** a wiki edit changes only `schema` or `version`
- **THEN** the server SHALL treat the update as no-op for content history
- **AND** no revision SHALL be emitted

### Requirement: Restore writes ContentDoc back into Post.content

When a user restores a historical revision of a post / wiki / chapter, the restore SHALL write the stored `ContentDoc` payload back into `Post.content`. The restore SHALL NOT convert the payload back to a body string and SHALL NOT drop unknown slots.

#### Scenario: Restore preserves unknown slots

- **WHEN** a revision contains a slot with a type not recognized by the current renderer
- **AND** the user restores that revision
- **THEN** the resulting `Post.content` SHALL contain that slot byte-equivalent to its stored value
