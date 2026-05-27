## MODIFIED Requirements

### Requirement: contentUnitId Replaces chapterId For Content Unit Identity

Content structure nodes and reader/editor DTOs SHALL use `contentUnitId` for
the Unit identity of a concrete content node. `contentUnitId` replaces old
chapter-specific `chapterId` and `chapterUnitId` language in contracts, backend
storage, service code, API clients, and UI work. For book chapters,
`contentUnitId` points to the materialized chapter content Unit.

Generic content-structure contracts, service responses, write inputs, mappers,
and history operation payloads SHALL NOT expose `chapterId` or `chapterUnitId`.
Book/chapter adapters MAY keep local route params or compatibility names only
when the surrounding surface is explicitly book-specific.

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

#### Scenario: Generic response omits chapterUnitId

- **WHEN** a client reads `/content-structure/:ownerUnitId`
- **THEN** every returned node SHALL use `contentUnitId` for linked content Unit
  identity
- **AND** the response SHALL NOT include `chapterUnitId`

### Requirement: Migration Keeps Legacy Compatibility Explicit

The system SHALL keep legacy content-structure compatibility only at
book-specific adapter boundaries that still need URL or product-surface
compatibility. Existing book routes and helper names MAY remain temporarily
when they are explicitly documented as adapters over generic content-structure
storage. Generic contracts, service boundaries, storage models, and reusable
app/API helpers SHALL use `contentStructure`, `ownerUnitId`, and
`contentUnitId`.

#### Scenario: Legacy field is removed from generic contracts

- **WHEN** a generic content-structure contract or frontend DTO describes node
  identity
- **THEN** it SHALL expose `contentUnitId`
- **AND** it SHALL NOT expose `chapterUnitId`

#### Scenario: Legacy book endpoint is compatibility wrapper

- **WHEN** a legacy `/book/:bookUnitId/content-structure` endpoint remains
- **THEN** it SHALL be documented as a compatibility wrapper
- **AND** it SHALL delegate to generic content-structure storage
- **AND** internal callers that do not require book-specific compatibility SHALL
  use generic content-structure clients instead

### Requirement: Generic ContentStructure Service Owns Tree Operations

The system SHALL provide a backend content-structure domain that owns generic
tree assembly, path parsing/resolution, diff planning, batch save, and history
event writing. Book services MAY expose compatibility wrappers, but generic tree
mutation logic SHALL NOT remain owned by the book domain.

Generic tree operations SHALL accept and return `contentUnitId` only for linked
content Unit identity. They SHALL NOT synthesize `chapterUnitId` aliases in
generic mapper output or operation planning.

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

#### Scenario: Generic write rejects chapterUnitId-only identity

- **WHEN** a generic content-structure update receives a node identity through
  `chapterUnitId` without `contentUnitId`
- **THEN** the generic service SHALL reject the payload or require the caller to
  use a book compatibility adapter
- **AND** canonical writes SHALL persist only `contentUnitId`

### Requirement: ContentStructure History Is Generic

Content-structure mutations SHALL record generic structure history events.
Book-specific event names such as `book.contentStructure.batch` MAY be displayed
for pre-cutover legacy rows, but new canonical writes SHALL use generic
content-structure event names and payload fields.

#### Scenario: Generic structure edit records generic event

- **WHEN** a content-structure batch save inserts, updates, moves, links,
  unlinks, deletes, or replaces nodes
- **THEN** the history payload SHALL identify the owner Unit
- **AND** the event type SHALL use generic content-structure terminology
- **AND** node link/unlink payloads SHALL use `contentUnitId`
- **AND** node link/unlink payloads SHALL NOT include chapter-specific aliases
