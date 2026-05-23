# editorial-patch-protocol Specification

## Purpose

Defines the PATCH submission semantics shared by every editorial Unit endpoint: sparse JSON sub-trees as input, `null` writing SQL `NULL`, explicit `$unset` for key removal, whole-array replacement (no index addressing), bidirectional prefix matching for lock comparison, and an externally-governed path list that is exempt from the editorial regime. This protocol is the path vocabulary referenced by `content-authority` (lock paths) and `content-history-service` (PATCH-shape payloads and derived changed-paths projection).

## Requirements

### Requirement: Editorial PATCH submissions are sparse JSON sub-trees

Editorial PATCH endpoints SHALL accept a sparse JSON sub-tree as the request body. Each path present in the sub-tree describes a sub-state to set on the Unit; paths absent from the sub-tree SHALL be left untouched. Object values SHALL be recursively merged into the current Unit state. Array values SHALL replace the existing array whole.

#### Scenario: Sparse PATCH updates only the submitted path

- **WHEN** a client submits PATCH `{ translations: { en: { description: "new" } } }` to an editorial endpoint for a Unit that has `translations.en.title`, `translations.en.summary`, `translations.de.*`, and `credits.*` populated
- **THEN** only `translations.en.description` SHALL be updated to `"new"`
- **AND** `translations.en.title`, `translations.en.summary`, every key under `translations.de`, and every key under `credits` SHALL retain their existing values

#### Scenario: Array values replace the array whole

- **WHEN** a client submits PATCH `{ credits: { authors: [{ targetUnitId: "u-2" }] } }` to an editorial endpoint for a Unit whose `credits.authors` is currently `[{ targetUnitId: "u-1" }, { targetUnitId: "u-2" }]`
- **THEN** `credits.authors` SHALL be replaced with the submitted single-element array
- **AND** `credits.translators` and other `credits.*` arrays SHALL retain their existing values

#### Scenario: Object values merge recursively

- **WHEN** a client submits PATCH `{ extension: { isbn13: "...", pageCount: 300 } }` to an editorial endpoint for a Unit whose `extension` already has `isbn13` and `publicationDate`
- **THEN** the new `isbn13` and `pageCount` SHALL be set
- **AND** `extension.publicationDate` SHALL retain its existing value

### Requirement: PATCH `null` writes SQL NULL

A PATCH leaf value of `null` SHALL write the corresponding column to SQL `NULL`. The protocol SHALL NOT use the RFC 7396 convention that `null` removes a key.

#### Scenario: Null leaf clears the column

- **WHEN** a client submits PATCH `{ translations: { en: { summary: null } } }`
- **THEN** the stored `UnitTranslation.summary` SHALL be set to SQL `NULL`
- **AND** the key SHALL remain present in any subsequent JSON projection of the Unit

### Requirement: Key removal requires explicit `$unset` directive

To remove a key from a stored JSON sub-tree, a PATCH SHALL include an explicit `$unset` directive listing the paths to remove. Plain absence of a key in the PATCH sub-tree means "leave untouched"; `null` means "set to SQL NULL"; only `$unset` means "remove the key."

#### Scenario: `$unset` removes the listed key

- **WHEN** a client submits PATCH `{ $unset: ["extension.publicationDate"] }`
- **THEN** the `publicationDate` key SHALL be removed from the stored `extension` sub-tree
- **AND** other keys under `extension` SHALL retain their existing values

#### Scenario: Absent key leaves stored sub-tree unchanged

- **WHEN** a client submits PATCH `{ extension: { isbn13: "..." } }` to a Unit whose `extension` has `isbn13`, `publicationDate`, and `pageCount`
- **THEN** only `isbn13` SHALL be updated
- **AND** `publicationDate` and `pageCount` SHALL retain their existing values
- **AND** they SHALL NOT be removed from the stored sub-tree

### Requirement: No index-level patching of arrays

The protocol SHALL NOT support index-based PATCH addressing (`credits.authors[2].targetUnitId`). Array-valued fields are replaced whole. Locks, history changed paths, and PATCH inputs SHALL NOT use array-index notation.

#### Scenario: Index-form path is rejected

- **WHEN** a client submits PATCH whose effective leaf path contains an array index (`credits.authors[1]`)
- **THEN** the editorial endpoint SHALL reject the PATCH with a 400-style error indicating that array-index PATCH is unsupported

#### Scenario: Logical-id object sub-tree replaces index addressing

- **WHEN** a feature needs per-entry editing of a collection
- **THEN** the input schema SHALL re-shape the collection as an object keyed by a logical identifier (e.g. `credits.authors.byTargetUnitId.<targetUnitId>`)
- **AND** the editorial protocol SHALL treat that object key as an ordinary path

### Requirement: Externally-governed paths are exempt from the editorial regime

`@rezics/contract` SHALL export a closed list `EXTERNALLY_GOVERNED_PATHS` of path prefixes whose state is governed by systems outside the editorial regime (vote ledgers, dedicated approval flows). The list SHALL include at least `tags` and `realmTagApplications`. Editorial PATCH endpoints SHALL reject PATCH whose paths intersect this list. The editorial history outbox SHALL NOT record changes to these paths. Editorial locks SHALL NOT apply to these paths, including the whole-Unit sentinel `*`.

The prefix match SHALL use path-boundary semantics: a PATCH path `P` intersects an entry `E` if and only if `P == E`, `P.startsWith(E + ".")`, or `E.startsWith(P + ".")`. Raw string `startsWith` SHALL NOT be used (so `tagSummary` does not match the entry `tags`).

#### Scenario: PATCH targeting tags is rejected

- **WHEN** a client submits PATCH `{ tags: [...] }` to an editorial endpoint
- **THEN** the endpoint SHALL reject the request with a 400-style error
- **AND** the error body SHALL identify `tags` as the externally-governed path
- **AND** the error body SHALL hint at the dedicated tag governance API

#### Scenario: PATCH targeting realm tag applications is rejected

- **WHEN** a client submits PATCH `{ realmTagApplications: [...] }` to an editorial endpoint
- **THEN** the endpoint SHALL reject the request with a 400-style error pointing at the realm tag application API

#### Scenario: Whole-Unit lock does not extend into externally-governed paths

- **WHEN** Unit A has a `UnitFieldLock` row with `path = "*"`
- **AND** a client submits a tag PATCH through the dedicated tag governance API
- **THEN** the tag governance API SHALL NOT consult `UnitFieldLock` for that operation
- **AND** the tag governance API SHALL apply its own vote and owner gating

#### Scenario: Editorial lock cannot be created for externally-governed paths

- **WHEN** an operator attempts to create a `UnitFieldLock` row with `path = "tags"` or `path = "realmTagApplications.x"`
- **THEN** the lock creation API SHALL reject the request with an error explaining that the path is externally governed

#### Scenario: Path-boundary semantics distinguish `tags` from `tagSummary`

- **WHEN** a Unit has an editorial field whose canonical PATCH path is `tagSummary`
- **AND** a client submits PATCH `{ tagSummary: "..." }`
- **THEN** the PATCH SHALL NOT be rejected as externally governed
- **AND** the PATCH SHALL proceed through normal editorial admission

### Requirement: Lock comparison is bidirectional prefix matching

A submitted PATCH path `P` SHALL be blocked by a stored `UnitFieldLock` row whose `path = L` if and only if `P == L`, `P.startsWith(L + ".")`, or `L.startsWith(P + ".")`. The whole-Unit sentinel `*` SHALL match every editorial path. Externally-governed paths SHALL be excluded from this check entirely.

A PATCH SHALL be rejected atomically: if any of its leaf paths is blocked by any lock path, the entire PATCH SHALL be rejected and no part of it SHALL be persisted. The rejection error SHALL identify both the offending lock path and the offending PATCH leaf path.

#### Scenario: PATCH equal to lock path is blocked

- **WHEN** Unit A has lock `path = "credits.authors"`
- **AND** a client submits PATCH `{ credits: { authors: [...] } }`
- **THEN** the PATCH SHALL be rejected
- **AND** the error SHALL identify lock `credits.authors` and PATCH `credits.authors`

#### Scenario: PATCH covers lock area

- **WHEN** Unit A has lock `path = "credits.authors"`
- **AND** a client submits PATCH `{ credits: { authors: [...], translators: [...] } }`
- **THEN** the PATCH SHALL be rejected because the patch sub-tree contains the locked path

#### Scenario: PATCH lies inside lock area

- **WHEN** Unit A has lock `path = "credits"`
- **AND** a client submits PATCH `{ credits: { translators: [...] } }`
- **THEN** the PATCH SHALL be rejected because the patch path lies inside the locked path

#### Scenario: Disjoint PATCH and lock are not blocked

- **WHEN** Unit A has lock `path = "credits.authors"`
- **AND** a client submits PATCH `{ credits: { translators: [...] } }`
- **THEN** the PATCH SHALL proceed (subject to other authority checks) because the paths are disjoint

#### Scenario: Whole-Unit lock blocks any editorial PATCH

- **WHEN** Unit A has lock `path = "*"`
- **AND** a client submits PATCH `{ translations: { en: { title: "..." } } }`
- **THEN** the PATCH SHALL be rejected
- **AND** an editorial PATCH targeting any non-externally-governed path SHALL also be rejected

#### Scenario: Whole-Unit lock does not block externally-governed PATCH

- **WHEN** Unit A has lock `path = "*"`
- **AND** a client submits a tag application through the dedicated tag governance API
- **THEN** the tag API SHALL NOT consult `UnitFieldLock`
- **AND** the operation SHALL be governed only by the tag system's own rules

### Requirement: PATCH path canonicalization is API-design discipline

The editorial PATCH protocol SHALL NOT enforce a canonical mapping from logical fields to PATCH paths at the contract layer. Two PATCH endpoints submitting different paths for the same logical field is permitted by the protocol but constitutes a design defect that SHALL be caught in API review.

Input schemas in `@rezics/contract` SHALL define a single canonical PATCH path for every editable field. Reviewers SHALL verify new editorial endpoints conform to existing canonical paths before merge.

#### Scenario: Each editable field has one canonical PATCH path in contract

- **WHEN** a new editorial endpoint is added to `@rezics/contract`
- **THEN** its PATCH input schema SHALL reference existing canonical paths for any field that is already editable elsewhere
- **AND** review SHALL reject the endpoint if it introduces a parallel path for the same logical field
