## ADDED Requirements

### Requirement: Shelf documents include containedUnitIds

Every content document with `type = "SHELF"` SHALL contain a `containedUnitIds: string[]` field listing the unit ids of every item the shelf currently holds. Documents whose `type` is not `SHELF` SHALL omit the field or carry an empty array. The field SHALL be sourced from `ShelfItem` rows where `ShelfItem.shelfUnitId = <document.id>`.

#### Scenario: Shelf with three items has the three ids

- **GIVEN** a published shelf `s-1` with `ShelfItem` rows pointing to `b-1`, `b-2`, `b-3`
- **WHEN** the shelf is synced to Meilisearch
- **THEN** the shelf document SHALL have `containedUnitIds: ["b-1", "b-2", "b-3"]` (order is implementation-defined)

#### Scenario: Empty shelf has empty array

- **GIVEN** a published shelf with no items
- **WHEN** the shelf is synced
- **THEN** the document SHALL have `containedUnitIds: []`

#### Scenario: Non-shelf documents are unaffected

- **GIVEN** a published BOOK document
- **WHEN** the document is read
- **THEN** the `containedUnitIds` field SHALL be absent or `[]`
- **AND** SHALL NOT be populated with anything related to the BOOK's own contents

### Requirement: ShelfItem mutations trigger partial resync

The system SHALL trigger a Meilisearch partial-update of the parent shelf document whenever a `ShelfItem` row is inserted or deleted. The update SHALL touch only the `containedUnitIds` field on the document; the rest of the document SHALL NOT be re-queried. The sync SHALL be fire-and-forget and SHALL mirror the structure of the existing `RealmUnit` → post `realmIds` sync triggers.

When a shelf is mutated by a batched operation (e.g., adding N items at once), the orchestrator SHOULD coalesce the multi-row writes into a single partial-update by computing the post-state `containedUnitIds` once, rather than emitting N partial-updates.

#### Scenario: Adding an item resyncs the shelf

- **GIVEN** shelf `s-1` is indexed with `containedUnitIds: ["b-1"]`
- **WHEN** a `ShelfItem(s-1, b-2)` row is inserted via `ShelfService.addItem`
- **THEN** the system SHALL push a partial-update for shelf `s-1`
- **AND** the resulting document SHALL have `containedUnitIds: ["b-1", "b-2"]`

#### Scenario: Removing an item resyncs the shelf

- **GIVEN** shelf `s-1` is indexed with `containedUnitIds: ["b-1", "b-2"]`
- **WHEN** the `ShelfItem(s-1, b-1)` row is deleted via `ShelfService.removeItem`
- **THEN** the system SHALL push a partial-update for shelf `s-1`
- **AND** the resulting document SHALL have `containedUnitIds: ["b-2"]`

#### Scenario: Batched bulk-add coalesces

- **GIVEN** an empty shelf `s-1`
- **WHEN** `ShelfService` adds three items in a single batch
- **THEN** the system SHALL emit at most a small constant number of partial-update tasks (one per batch boundary), not three
- **AND** the final document SHALL have all three ids in `containedUnitIds`

### Requirement: Full resync helper for containedUnitIds

The `@rezics/search` package SHALL expose a `syncAllContainedUnitIds(client: SearchClient)` helper that cursor-paginates over `Unit` rows where `type = "SHELF"` and pushes a partial update with the freshly computed `containedUnitIds` for each shelf. The helper SHALL be invocable via a CLI script analogous to `package/server/src/script/resync-post-root-targets.ts` and SHALL be idempotent.

#### Scenario: Helper updates only containedUnitIds

- **WHEN** `syncAllContainedUnitIds(client)` is invoked
- **THEN** the helper SHALL emit partial-updates that contain only `{ id, containedUnitIds }`
- **AND** SHALL NOT touch any other field on the shelf documents

#### Scenario: Helper is safe to re-run

- **GIVEN** a clean run of `syncAllContainedUnitIds` has completed
- **WHEN** the helper is run again with no source changes
- **THEN** the resulting documents SHALL be unchanged
- **AND** the helper SHALL complete without error

## MODIFIED Requirements

### Requirement: Index filterable attributes cover all filter dimensions

The content index SHALL configure the following as filterable attributes: `type`, `tagIds`, `realmIds`, `realmTagKeys`, `languages`, `nsfw`, `visibility`, `isLicensed`, `userId`, `containedUnitIds`.

#### Scenario: Filter by type

- **WHEN** a search query includes filter `type = "BOOK"`
- **THEN** only documents with `type = "BOOK"` SHALL be returned

#### Scenario: Filter by realm and realm-scoped tag

- **WHEN** a search query includes filter `realmTagKeys = "{realmId}:{tagId}"`
- **THEN** only documents that have that exact compound key in their `realmTagKeys` array SHALL be returned

#### Scenario: Filter shelves by contained unit id

- **GIVEN** the federated `book` scope querying for shelves containing book `b-9`
- **WHEN** the orchestrator builds the content sub-query
- **THEN** the filter SHALL include `type = "SHELF" AND containedUnitIds = "b-9"`
- **AND** Meilisearch SHALL accept this filter against the configured `filterableAttributes`

#### Scenario: Filter content by author userId

- **WHEN** a search query includes filter `userId = "u-3"`
- **THEN** only documents authored by that user SHALL be returned
