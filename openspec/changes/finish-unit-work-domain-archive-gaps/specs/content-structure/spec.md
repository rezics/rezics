## MODIFIED Requirements

### Requirement: contentUnitId Replaces chapterId For Content Unit Identity

Content structure nodes and reader/editor DTOs SHALL use `contentUnitId` for
the Unit identity of a concrete content node. `contentUnitId` replaces old
chapter-specific `chapterId` and `chapterUnitId` language in new contracts and
UI work. For book chapters, `contentUnitId` points to the materialized chapter
content Unit.

`targetUnitId` SHALL remain reserved for interaction targets such as posts,
reviews, ratings, and comments. It SHALL NOT be reused as the content-structure
node identity field.

#### Scenario: Materialized book chapter exposes contentUnitId

- **GIVEN** a book content structure node has a materialized chapter Unit
  `chapter-unit-1`
- **WHEN** the content structure DTO is returned
- **THEN** the node SHALL expose `contentUnitId = "chapter-unit-1"`
- **AND** new clients SHALL NOT need to read a `chapterId` or `chapterUnitId`
  field for the same identity

#### Scenario: Reader progress stores contentUnitId

- **WHEN** a reader saves progress for a materialized content-structure node
- **THEN** the progress payload SHALL use `contentUnitId` for the materialized
  content Unit
- **AND** any legacy `chapterUnitId` payload support SHALL be read-only
  compatibility

### Requirement: Migration Keeps Legacy Compatibility Explicit

The system SHALL keep any legacy content-structure compatibility explicit
during migration. Existing book-specific storage, route params, and helper names
MAY remain as implementation details only when documented as compatibility, but
new public contracts and call sites SHALL prefer `contentUnitId` and
`contentStructure`.

#### Scenario: Legacy route param is compatibility only

- **WHEN** a route still uses `$chapterId` for compatibility with existing URLs
- **THEN** the component implementation SHALL treat the value as a
  `contentUnitId`
- **AND** new DTOs, query keys, and mutation payloads SHALL avoid introducing
  additional `chapterId` identity names
