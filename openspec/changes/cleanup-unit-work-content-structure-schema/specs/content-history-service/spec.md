## MODIFIED Requirements

### Requirement: Structure batch events

The history service SHALL support a `contentStructure.content.batch` structure
event payload that represents one logical `ContentStructure` save. The event
payload SHALL contain an ordered `operations` array whose entries describe
node-level domain changes such as create, update, move, delete, link, unlink,
or bulk replace.

For new writes, content-structure operation payloads SHALL use generic fields
such as `contentUnitId`, `beforeContentUnitId`, and `afterContentUnitId`.
Book-specific fields such as `chapterUnitId`, `beforeChapterUnitId`, and
`afterChapterUnitId` SHALL NOT be emitted by canonical writers.

The history service MAY continue to read pre-cutover
`book.contentStructure.batch` rows for display and migration support, but those
rows SHALL be treated as legacy history.

#### Scenario: History service persists batch event

- **WHEN** the outbox consumer receives a structure event with
  `eventType = "contentStructure.content.batch"`
- **THEN** the history service SHALL persist one `StructureEvent` row for the
  Unit sequence
- **AND** the persisted payload SHALL preserve the ordered `operations` array

#### Scenario: Reprocessing batch event is idempotent

- **WHEN** the outbox consumer retries the same
  `contentStructure.content.batch` outbox row
- **THEN** the history service SHALL NOT create a duplicate `StructureEvent`
- **AND** the existing event SHALL remain unchanged

#### Scenario: Link operation uses contentUnitId

- **WHEN** a content-structure node is linked to content Unit `content-1`
- **THEN** the persisted operation SHALL include `afterContentUnitId = "content-1"`
- **AND** it SHALL NOT include `afterChapterUnitId`

#### Scenario: Legacy book event remains readable

- **WHEN** the history UI reads a pre-cutover `book.contentStructure.batch`
  event
- **THEN** the history service MAY return it for display
- **AND** new canonical writes SHALL still use `contentStructure.content.batch`
