## ADDED Requirements

### Requirement: History persistence excludes draft and autosave records

The history service SHALL persist only canonical history records delivered through `HistoryOutbox`. `UnitRevision`, `RevisionContent`, and `StructureEvent` SHALL NOT be used as storage for editor draft state, autosave snapshots, uncommitted operation logs, or frontend recovery data.

#### Scenario: Autosave is stored outside history

- **WHEN** a future editor autosaves unsaved user work
- **THEN** that autosave SHALL NOT create a `UnitRevision` or `StructureEvent`
- **AND** any persistent autosave storage SHALL be specified separately from content history

#### Scenario: Batch commit is history eligible

- **WHEN** a server endpoint applies a canonical batch mutation that is in history scope
- **THEN** the resulting `HistoryOutbox` payload MAY be ingested as a `UnitRevision` or `StructureEvent`
- **AND** the persisted history record SHALL represent the semantic batch commit rather than each local UI operation

### Requirement: History schema comments explain canonical commit semantics

The history service Prisma schema SHALL include comments on `UnitRevision`, `RevisionContent`, and `StructureEvent` explaining that they store canonical history commits. The comments SHALL distinguish editorial PATCH revisions from high-change structure batch events and SHALL warn that editor autosave/draft/op-log persistence belongs outside these models.

#### Scenario: UnitRevision comment identifies editorial commit semantics

- **WHEN** a maintainer inspects the history service Prisma schema
- **THEN** the `UnitRevision` model comment SHALL identify it as an editorial commit record
- **AND** the comment SHALL state that it is not an autosave or draft log

#### Scenario: StructureEvent comment identifies batch event semantics

- **WHEN** a maintainer inspects the history service Prisma schema
- **THEN** the `StructureEvent` model comment SHALL identify it as a high-change structure batch event record
- **AND** the comment SHALL state that it is not a per-drag or per-click UI operation log
