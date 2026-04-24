## MODIFIED Requirements

### Requirement: BookIndex for chapter table of contents

The BookIndex model SHALL store a JSON-based chapter table of contents for a Book. It has a 1:1 relationship with Book via `bookUnitId` as its primary key. The `index` field (Json, required) contains the structured chapter listing. Deleting the parent Book SHALL cascade-delete the BookIndex.

Each node in `index` SHALL conform to the following shape:

```
{
  id: string,               // chapter Unit id
  title: string,
  noContent: boolean,
  children?: IndexNode[],
  rating?: ContentRating    // OPTIONAL override; see write rule below
}
```

The `rating` field on a node is a denormalized cache of the chapter Unit's `rating` value, stored ONLY when it differs from the parent Book Unit's `rating`. It is NOT the source of truth for chapter rating; the chapter `Unit.rating` is. Consumers that need the authoritative chapter rating SHALL read from the chapter Unit directly; consumers rendering the TOC SHALL use `node.rating` (if present) or treat absence as "same as the Book's rating".

#### Scenario: Create a chapter index for a book

- GIVEN a Book with `unitId = "unit-1"`
- WHEN the system creates a BookIndex with `bookUnitId = "unit-1"` and `index = [{"id": "ch-1", "title": "Chapter One", "noContent": false}]`
- THEN the BookIndex record SHALL be persisted with the provided JSON index
- AND the BookIndex SHALL be accessible via the Book's `chapterIndex` relation

#### Scenario: Node rating is omitted when matching Book rating

- GIVEN a Book Unit "book-1" with `rating = R_15` and a chapter Unit "ch-1" with `rating = R_15`
- WHEN the frontend writes the BookIndex
- THEN the node for "ch-1" SHALL NOT contain a `rating` field

#### Scenario: Node rating is written when differing from Book rating

- GIVEN a Book Unit "book-1" with `rating = R_15` and a chapter Unit "ch-2" with `rating = R_18`
- WHEN the frontend writes the BookIndex
- THEN the node for "ch-2" SHALL include `rating: "R_18"`

#### Scenario: Update an existing chapter index

- GIVEN a BookIndex with `bookUnitId = "unit-1"` and an existing index
- WHEN the owner updates the `index` field with a new chapter listing
- THEN the BookIndex SHALL reflect the updated JSON
- AND `updatedAt` SHALL be set to the current timestamp

#### Scenario: Cascade delete BookIndex when Book is deleted

- GIVEN a Book with `unitId = "unit-1"` and an associated BookIndex
- WHEN the Book record is deleted
- THEN the associated BookIndex record SHALL also be deleted via cascade

## ADDED Requirements

### Requirement: BookIndex cache write rule is frontend-owned

The BookIndex `index` JSON SHALL be constructed and written by the frontend TOC editor. The server SHALL persist the JSON as-opaque and SHALL NOT enforce the write rule. The chapter Unit's `rating` field remains the source of truth; BookIndex acts as a render-time cache of deltas.

When the frontend writes a node for a chapter, it SHALL apply the rule:

```
if (chapter.rating !== book.rating) node.rating = chapter.rating
else omit node.rating
```

#### Scenario: Frontend omits matching rating

- GIVEN book `rating = GENERAL` and chapter `rating = GENERAL`
- WHEN the frontend serializes the node
- THEN the serialized node object SHALL NOT include a `rating` key

#### Scenario: Frontend includes diverging rating

- GIVEN book `rating = GENERAL` and chapter `rating = R_18`
- WHEN the frontend serializes the node
- THEN the serialized node SHALL include `rating: "R_18"`

### Requirement: TOC editor — resync index overrides action

The TOC editor SHALL expose an action (button) that recomputes every node's `rating` override from scratch using the current Book Unit rating and each chapter Unit's current rating. The action SHALL NOT modify any chapter Unit's `rating`. The action SHALL write the updated BookIndex in a single save.

#### Scenario: Resync after Book rating change

- GIVEN a Book Unit with `rating` changed from `R_18` to `GENERAL`
- AND 10 chapter Units that still have `rating = R_18`
- WHEN the maintainer clicks the "Resync index overrides" action
- THEN every node in the BookIndex SHALL include `rating: "R_18"`
- AND no chapter Unit's `rating` field SHALL be changed

#### Scenario: Resync removes stale overrides

- GIVEN a BookIndex where node "ch-1" has `rating: "R_15"` but the chapter Unit's `rating` is now `GENERAL` and the Book Unit's `rating` is also `GENERAL`
- WHEN the maintainer clicks "Resync index overrides"
- THEN the updated node "ch-1" SHALL NOT include a `rating` field

### Requirement: TOC editor — multi-select batch rating edit

The TOC editor SHALL allow the maintainer to select multiple chapter entries and apply a single `ContentRating` value to all selected chapters in one operation. Each selected chapter's `Unit.rating` SHALL be updated on the server. After the batch update completes, the BookIndex node overrides SHALL be recomputed per the standard write rule and persisted.

#### Scenario: Batch-edit three chapters

- GIVEN a Book Unit with `rating = R_15` and chapter Units "ch-1", "ch-2", "ch-3" each with `rating = R_15`
- WHEN the maintainer selects "ch-1" and "ch-2" in the TOC editor and applies `rating = R_18`
- THEN the chapter Units "ch-1" and "ch-2" SHALL be updated to `rating = R_18`
- AND the chapter Unit "ch-3" SHALL remain at `rating = R_15`
- AND the BookIndex nodes for "ch-1" and "ch-2" SHALL include `rating: "R_18"`
- AND the BookIndex node for "ch-3" SHALL NOT include a `rating` field

#### Scenario: Batch-edit is explicit (no implicit propagation)

- GIVEN a Book Unit whose `rating` changed from `GENERAL` to `R_15`
- WHEN no batch-edit action is invoked
- THEN no chapter Unit's `rating` value SHALL be changed by the Book rating update alone
