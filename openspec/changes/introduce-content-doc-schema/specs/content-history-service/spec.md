## MODIFIED Requirements

### Requirement: Slot-based editorial payloads

Editorial revision payloads SHALL be slot-based and SHALL use stable slot names such as `unit`, `translations`, `supportLanguages`, `extension`, `credits`, `subjects`, `tags`, and `post`. The `post` slot SHALL carry the full `ContentDoc` payload directly (including `schema`, `version`, `main`, `slots`, and `layout`). Long-form description slots, where present in a revision payload, SHALL likewise carry `ContentDoc`. Legacy body strings SHALL NOT appear in any new revision payload. Payload references to other Units SHALL store ids, not denormalized display names.

#### Scenario: Attribution revision stores entity id

- **WHEN** a credit attribution changes on a book
- **THEN** the revision payload SHALL store the referenced entity Unit id
- **AND** it SHALL NOT copy the entity's current display name into the revision payload

#### Scenario: Wiki revision stores content document under the post slot

- **WHEN** wiki content is edited
- **THEN** the editorial revision payload SHALL include `slots.post` as a `ContentDoc` with `schema`, `version`, `main`, optional `slots`, and optional `layout`
- **AND** it SHALL NOT store a legacy `post.body` string anywhere in the payload

#### Scenario: Wiki revision with infobox edit

- **WHEN** only the infobox slot of a wiki content document changes
- **THEN** the revision payload SHALL still include the full `ContentDoc` (the entire `post` slot)
- **AND** `changedFieldKeys` SHALL include `post.content.slots.infobox`
- **AND** the new `RevisionContent.hash` SHALL differ from the previous revision's hash because the canonical payload differs

## ADDED Requirements

### Requirement: ContentDoc snapshots preserve schema version

History snapshots for long-form content SHALL preserve the `ContentDoc.schema` and `ContentDoc.version` values exactly as committed by the canonical write. The history service SHALL NOT migrate stored payloads in place when a future schema version exists.

#### Scenario: Revision reads old content version

- **WHEN** a revision created under `ContentDoc.version = 1` is read after a future schema version exists
- **THEN** the history service SHALL return the stored version 1 payload without migrating it in place

### Requirement: Content-document field keys in changedFieldKeys

`UnitRevision.changedFieldKeys` for long-form content edits SHALL use content sub-path keys rather than the removed `post.body` key. The vocabulary SHALL be:

- `post.content` — whole post `ContentDoc` replaced
- `post.content.main` — `main` block changed
- `post.content.slots.<slotId>` — a specific slot changed (e.g. `post.content.slots.infobox`)
- `post.content.layout` — layout changed

Multiple keys MAY appear in the same revision when a single edit touches multiple sub-paths.

#### Scenario: Edit that changes main and infobox

- **WHEN** a single wiki edit modifies both `content.main.source` and `content.slots.infobox`
- **THEN** the emitted `changedFieldKeys` SHALL include both `post.content.main` and `post.content.slots.infobox`
- **AND** SHALL NOT include `post.body`

#### Scenario: Edit that only changes layout

- **WHEN** a wiki edit only reorders existing slots in `content.layout` without changing slot contents
- **THEN** the emitted `changedFieldKeys` SHALL include `post.content.layout` only

### Requirement: Restore writes ContentDoc back into Post.content

When a user restores a historical revision of a post / wiki / chapter, the restore SHALL write the stored `ContentDoc` payload back into `Post.content`. The restore SHALL NOT convert the payload back to a body string and SHALL NOT drop unknown slots.

#### Scenario: Restore preserves unknown slots

- **WHEN** a revision contains a slot with a type not recognized by the current renderer
- **AND** the user restores that revision
- **THEN** the resulting `Post.content` SHALL contain that slot byte-equivalent to its stored value
