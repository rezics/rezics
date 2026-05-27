## ADDED Requirements

### Requirement: Generic ContentStructure Backend Model

The system SHALL store content structures in generic backend tables keyed by
the Unit that owns the structure. The container SHALL be modeled as
`ContentStructure(ownerUnitId)` and the node rows SHALL be modeled as
`ContentStructureNode(ownerUnitId, contentUnitId)`.

`ownerUnitId` identifies the release, Series, or other Unit whose structure is
being edited. `contentUnitId` identifies the concrete Unit referenced by a
node. Book-specific `bookUnitId` and chapter-specific `chapterUnitId` SHALL NOT
be the canonical storage names for generic content structure.

#### Scenario: Book content structure uses generic rows

- **GIVEN** a book release Unit `book-release-1`
- **WHEN** its table of contents is stored
- **THEN** the container SHALL be `ContentStructure(ownerUnitId = "book-release-1")`
- **AND** each node SHALL be stored as `ContentStructureNode(ownerUnitId = "book-release-1", ...)`
- **AND** materialized chapter identity SHALL be stored in `contentUnitId`

#### Scenario: Series content structure uses the same model

- **GIVEN** a Series Unit `series-1`
- **WHEN** its direct member tree is stored
- **THEN** the container SHALL be `ContentStructure(ownerUnitId = "series-1")`
- **AND** release member nodes SHALL reference visible releases through
  `contentUnitId`

### Requirement: Generic ContentStructure Preserves Normalized Tree Semantics

The generic content-structure model SHALL preserve the normalized one-row-per
node behavior previously implemented for books. Each node SHALL carry stable
node id, nullable `parentId`, LexoRank `sortKey`, nullable `contentUnitId`,
title cache, `noContent`, optional rating cache, created/updated timestamps,
and non-unique content-unit references.

#### Scenario: Duplicate contentUnitId references are supported

- **GIVEN** one content Unit `content-1`
- **WHEN** two nodes in the same or different owner structures reference it
- **THEN** both `ContentStructureNode` rows SHALL be valid
- **AND** no uniqueness constraint SHALL reject the duplicate `contentUnitId`

#### Scenario: Content unit delete keeps structure placeholder

- **GIVEN** a node references `contentUnitId = "content-1"`
- **WHEN** `content-1` is deleted
- **THEN** the node row SHALL remain
- **AND** `contentUnitId` SHALL be set to null

### Requirement: Generic ContentStructure Service Owns Tree Operations

The system SHALL provide a backend content-structure domain that owns generic
tree assembly, path parsing, path resolution, diff planning, batch save, and
history event writing. Book services MAY expose compatibility wrappers, but
generic tree mutation logic SHALL NOT remain owned by the book domain.

#### Scenario: Generic owner read returns content structure

- **GIVEN** `ContentStructure(ownerUnitId = "unit-1")` exists
- **WHEN** a client reads the content structure for `unit-1`
- **THEN** the server SHALL assemble `ContentStructureNode` rows into the nested
  content-structure DTO
- **AND** the DTO SHALL expose node identity through `contentUnitId`

#### Scenario: Book wrapper delegates to generic service

- **WHEN** a caller uses a compatibility book content-structure endpoint
- **THEN** the endpoint SHALL delegate storage reads and writes to the generic
  content-structure service
- **AND** no separate `BookContentStructure` storage path SHALL be maintained

### Requirement: ContentStructure History Is Generic

Content-structure mutations SHALL record generic structure history events.
Book-specific event names such as `book.contentStructure.batch` MAY remain only
as compatibility aliases while consumers migrate.

#### Scenario: Generic structure edit records generic event

- **WHEN** a content-structure batch save inserts, updates, moves, links,
  unlinks, deletes, or replaces nodes
- **THEN** the history payload SHALL identify the owner Unit
- **AND** the event type SHALL use generic content-structure terminology
- **AND** node link/unlink payloads SHALL use `contentUnitId`

### Requirement: Existing BookContentStructure Data Migrates To Generic Storage

The system SHALL migrate existing `BookContentStructure` and
`BookContentStructureNode` data to generic `ContentStructure` and
`ContentStructureNode` storage. Migration SHALL preserve node ids, ordering,
parent links, timestamps, title/noContent/rating caches, and materialized
content Unit references.

#### Scenario: Migration preserves existing book tree

- **GIVEN** a book has existing `BookContentStructureNode` rows
- **WHEN** the migration runs
- **THEN** equivalent generic `ContentStructureNode` rows SHALL exist with the
  same tree shape
- **AND** every previous `chapterUnitId` value SHALL be represented as
  `contentUnitId`
- **AND** parity checks SHALL be able to reconstruct the same nested tree

## MODIFIED Requirements

### Requirement: Content Structure Uses Generic Content Terminology

The system SHALL use generic `contentStructure` terminology for release content
trees instead of treating the concept as book-only in API, frontend-facing
vocabulary, and backend persistence. Existing book table-of-contents behavior
remains the first implementation, but contracts, service boundaries, storage
models, and UI copy introduced by this capability SHALL avoid new
book/chapter-only naming where a generic content structure concept is meant.

#### Scenario: Book content structure remains supported

- **WHEN** a book release loads its table of contents
- **THEN** the data MAY still be exposed through book compatibility APIs during
  migration
- **AND** canonical storage and service terminology SHALL expose it as
  `contentStructure`
- **AND** the owner SHALL be the release Unit id, not a book-specific storage
  key

### Requirement: contentUnitId Replaces chapterId For Content Unit Identity

Content structure nodes and reader/editor DTOs SHALL use `contentUnitId` for
the Unit identity of a concrete content node. `contentUnitId` replaces old
chapter-specific `chapterId` and `chapterUnitId` language in contracts, backend
storage, service code, API clients, and UI work. For book chapters,
`contentUnitId` points to the materialized chapter content Unit.

`targetUnitId` SHALL remain reserved for interaction targets such as posts,
reviews, ratings, and comments. It SHALL NOT be reused as the content-structure
node identity field.

#### Scenario: Materialized book chapter exposes contentUnitId

- **GIVEN** a book content structure node has a materialized chapter Unit
  `chapter-unit-1`
- **WHEN** the content structure DTO is returned
- **THEN** the node SHALL expose `contentUnitId = "chapter-unit-1"`
- **AND** canonical storage SHALL persist the same value as `contentUnitId`
- **AND** clients SHALL NOT need to read a `chapterId` or `chapterUnitId` field
  for the same identity

#### Scenario: Interactions continue to use targetUnitId

- **WHEN** a user creates a review or discussion post for a content Unit
- **THEN** the interaction write SHALL use `targetUnitId` for the reviewed or
  discussed Unit
- **AND** content structure DTOs and storage SHALL use `contentUnitId` only to
  identify the content node's Unit

### Requirement: Migration Keeps Legacy Compatibility Explicit

The system SHALL keep any legacy content-structure compatibility explicit
during migration. Existing book-specific APIs, route params, and helper names
MAY remain as compatibility wrappers, but any remaining public `chapterId`,
`chapterUnitId`, or `BookContentStructure` contract names SHALL be treated as
legacy compatibility and scheduled for replacement by `contentUnitId` and
`contentStructure`.

#### Scenario: Legacy field is documented or removed

- **WHEN** a contract or frontend DTO still exposes `chapterUnitId`
- **THEN** the implementation SHALL either remove it in favor of
  `contentUnitId` or document it as transitional compatibility
- **AND** new call sites SHALL prefer `contentUnitId`

#### Scenario: Legacy book endpoint is compatibility wrapper

- **WHEN** a legacy `/book/:bookUnitId/content-structure` endpoint remains
- **THEN** it SHALL be documented as a compatibility wrapper
- **AND** it SHALL delegate to generic content-structure storage
