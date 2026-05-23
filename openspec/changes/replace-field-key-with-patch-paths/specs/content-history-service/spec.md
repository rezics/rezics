## MODIFIED Requirements

### Requirement: Editorial revision storage

The history service SHALL store editorial Unit revisions as content-addressed snapshots using `UnitRevision` and `RevisionContent`-style records. For post-cutover revisions, the canonical payload is the submitted editorial PATCH sub-tree. Identical PATCH payloads SHALL share the same content hash. Pre-cutover revisions retain their stored `slots`-shape payload byte-for-byte.

#### Scenario: Revision stores patch by hash

- **WHEN** the history service consumes a post-cutover editorial outbox event
- **THEN** it SHALL store the submitted PATCH sub-tree in `RevisionContent` keyed by the canonical hash of that sub-tree
- **AND** it SHALL create a `UnitRevision` row pointing to that hash

#### Scenario: Duplicate patch deduplicates content

- **WHEN** two post-cutover revisions have identical PATCH payloads
- **THEN** they SHALL point to the same `RevisionContent` hash
- **AND** only one `RevisionContent` row SHALL be stored for that payload

#### Scenario: Pre-cutover revisions are read in their stored shape

- **WHEN** the history reader serves a revision created before this change landed
- **THEN** it SHALL return the stored `slots`-shape payload unchanged
- **AND** it SHALL NOT rewrite the payload into `patch`-shape

### Requirement: PATCH-shape editorial payloads

Editorial revision payloads SHALL carry a `patch` field containing the submitted sparse JSON sub-tree exactly as the client submitted it. Payloads SHALL NOT include a `slots` field. Payload references to other Units SHALL store ids, not denormalized display names.

#### Scenario: Attribution revision stores referenced entity id in the patch

- **WHEN** a credit attribution change submits PATCH `{ credits: { authors: [{ targetUnitId: "ent-7" }] } }`
- **THEN** the revision payload's `patch.credits.authors[0].targetUnitId` SHALL be `"ent-7"`
- **AND** it SHALL NOT copy the entity's current display name into the payload

#### Scenario: Editorial payload omits the slots field

- **WHEN** the history service consumes a post-cutover editorial outbox event
- **THEN** the persisted payload SHALL contain a `patch` field
- **AND** SHALL NOT contain a `slots` field

#### Scenario: Externally-governed paths produce no editorial revision

- **WHEN** a write to `tags` or `realmTagApplications` occurs through the dedicated governance API
- **THEN** no editorial `HistoryOutbox` row SHALL be created for that write
- **AND** the dedicated governance system SHALL retain its own audit trail

### Requirement: `changedFieldKeys` is a derived projection

`UnitRevision.changedFieldKeys` SHALL NOT be persisted as a stored column on post-cutover revisions. The history service SHALL derive the changed-paths list at read time by walking the stored `patch` sub-tree and emitting one entry per leaf path. Each entry is a free-form JSON path string consistent with the editorial PATCH path vocabulary. The derived list MAY be cached in the read DTO but SHALL NOT be persisted as canonical state.

For pre-cutover revisions, the history reader SHALL read `changedFieldKeys` from the legacy data preserved by the cutover migration (`legacyChangedKeys` inside the payload).

#### Scenario: Edit that changes English description and authors

- **WHEN** a client submits PATCH `{ translations: { en: { description: "..." } }, credits: { authors: [...] } }`
- **AND** the history service serves the resulting post-cutover revision
- **THEN** the derived `changedFieldKeys` SHALL include `translations.en.description` and `credits.authors`
- **AND** the derived list SHALL NOT include `translations.en.title` or any other untouched path

#### Scenario: Pre-cutover revision uses preserved changed keys

- **WHEN** the history reader serves a revision created before this change landed
- **THEN** `changedFieldKeys` SHALL be read from the preserved legacy data
- **AND** the values SHALL remain whatever the pre-cutover system emitted (e.g. `post.body`)

#### Scenario: Metadata-only PATCH does not create a revision

- **WHEN** a PATCH is submitted but produces no effective change after sparse merge (every leaf already equals the stored value)
- **THEN** the editorial endpoint SHALL NOT write a `HistoryOutbox` row
- **AND** no `UnitRevision` SHALL be created

### Requirement: Revision content hash is based on the patch payload

The history system SHALL compute `UnitRevision.contentHash` from the canonical serialization of the stored PATCH sub-tree (for post-cutover revisions) or the stored `slots` payload (for pre-cutover revisions). Two editorial revisions with identical canonical payloads SHALL point to the same `RevisionContent` row even when authored by different actors or at different sequences.

#### Scenario: Identical patches deduplicate across sequences

- **WHEN** the history service ingests two editorial revision payloads whose `patch` sub-trees are byte-identical
- **AND** the revisions have different sequence values or actors
- **THEN** both `UnitRevision` rows SHALL reference the same `RevisionContent.hash`
- **AND** only one `RevisionContent` row SHALL be stored

#### Scenario: Restore reuses patch hash

- **WHEN** a restore re-submits the patch from a previous revision verbatim
- **THEN** the resulting new revision SHALL receive a new sequence
- **AND** the new revision SHALL reuse the previous revision's content hash

## REMOVED Requirements

### Requirement: Slot-based editorial payloads

**Reason:** Replaced by PATCH-shape payloads. The `revisionSlotName` vocabulary (`unit`, `translations`, `supportLanguages`, `extension`, `credits`, `subjects`, `tags`, `post`) is removed. Post-cutover payloads carry the submitted PATCH sub-tree directly under `patch`; pre-cutover payloads retain their stored `slots` shape and are read in that shape without rewrite.

**Migration:** Existing pre-cutover `RevisionContent` rows are not rewritten. The history reader detects shape from payload structure (`"patch" in payload`) and renders both. Externally-governed paths (`tags`, `realmTagApplications`) that previously appeared in the `slots` snapshot are excluded from new revisions entirely.
