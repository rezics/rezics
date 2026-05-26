## ADDED Requirements

### Requirement: Content Structure Uses Generic Content Terminology

The system SHALL use generic `contentStructure` terminology for release content
trees instead of treating the concept as book-only in API and frontend-facing
vocabulary. Existing book table-of-contents behavior remains the first
implementation, but contracts and UI copy introduced by this change SHALL avoid
new book/chapter-only naming where a generic content structure concept is meant.

#### Scenario: Book content structure remains supported

- **WHEN** a book release loads its table of contents
- **THEN** the data MAY still be backed by the existing book content structure
  storage during migration
- **AND** new DTO/API terminology SHALL expose it as `contentStructure` where the
  concept is not book-specific

### Requirement: contentUnitId Replaces chapterId For Content Unit Identity

Content structure nodes and reader/editor DTOs SHALL use `contentUnitId` for the
Unit identity of a concrete content node. `contentUnitId` replaces old
chapter-specific `chapterId` language in new contracts and UI work. For book
chapters, `contentUnitId` points to the materialized chapter content Unit.

`targetUnitId` SHALL remain reserved for interaction targets such as posts,
reviews, ratings, and comments. It SHALL NOT be reused as the content-structure
node identity field.

#### Scenario: Materialized book chapter exposes contentUnitId

- **GIVEN** a book content structure node has a materialized chapter Unit
  `chapter-unit-1`
- **WHEN** the content structure DTO is returned
- **THEN** the node SHALL expose `contentUnitId = "chapter-unit-1"`
- **AND** it SHALL NOT require clients to read a `chapterId` field for the same
  identity

#### Scenario: Interactions continue to use targetUnitId

- **WHEN** a user creates a review or discussion post for a content Unit
- **THEN** the interaction write SHALL use `targetUnitId` for the reviewed or
  discussed Unit
- **AND** content structure DTOs SHALL use `contentUnitId` only to identify the
  content node's Unit

### Requirement: Migration Keeps Legacy Compatibility Explicit

During migration, existing book-specific storage and helper names MAY remain as
implementation details, but any remaining public `chapterId` or
`BookContentStructure` contract names SHALL be treated as legacy compatibility
and scheduled for replacement by `contentUnitId` and `contentStructure`.

#### Scenario: Legacy field is documented or removed

- **WHEN** a contract or frontend DTO still exposes `chapterId`
- **THEN** the change implementation SHALL either remove it in favor of
  `contentUnitId` or document it as transitional compatibility
- **AND** new call sites SHALL prefer `contentUnitId`
