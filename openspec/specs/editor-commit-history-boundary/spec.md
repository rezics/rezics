# editor-commit-history-boundary Specification

## Purpose

Defines the repository-wide distinction between editor draft/op-log/autosave state and canonical history commits. `HistoryOutbox`, `UnitRevision`, `RevisionContent`, and `StructureEvent` represent canonical commits that passed server authorization and were applied to canonical state; they SHALL NOT store autosave snapshots, keystrokes, per-click UI operations, picker selections, or uncommitted frontend operation logs. This capability also requires Prisma schema documentation of the version model so maintainers can see commit semantics at the persistence layer, and it requires any multi-edit editor surface to define an explicit commit boundary before connecting to canonical history.

## Requirements

### Requirement: History records represent canonical commits

History persistence models SHALL represent canonical commits that passed server authorization and were applied to canonical state. The system SHALL NOT use `HistoryOutbox`, `UnitRevision`, `RevisionContent`, or `StructureEvent` as storage for editor draft state, autosave ticks, keystrokes, drag events, picker selections, or uncommitted frontend operation logs.

#### Scenario: Local editor operation does not create history

- **WHEN** a user adds, removes, reorders, or selects an item inside an editor before pressing save
- **THEN** the client MAY update local draft or op-log state
- **AND** the server SHALL NOT write a `HistoryOutbox` row for that local operation

#### Scenario: Save creates one canonical history record

- **WHEN** a user saves a group of local editor changes as one canonical commit
- **THEN** the server SHALL apply the canonical mutation in one transaction
- **AND** the server SHALL write at most one history record for that semantic save

### Requirement: Prisma schema documents the history version model

The Prisma schemas SHALL document the version model at the persistence models that enforce it. The main server schema SHALL document `UnitHistoryClock` and `HistoryOutbox`; the history service schema SHALL document `UnitRevision`, `RevisionContent`, and `StructureEvent`. These comments SHALL state that the models represent canonical history commits and SHALL NOT be used for editor autosave, draft, or uncommitted op-log persistence.

#### Scenario: Maintainer inspects main history outbox schema

- **WHEN** a maintainer reads the main server Prisma schema
- **THEN** `HistoryOutbox` and `UnitHistoryClock` SHALL have comments explaining canonical commit sequencing
- **AND** the comments SHALL warn against using those models for autosave or local editor operations

#### Scenario: Maintainer inspects history service schema

- **WHEN** a maintainer reads the history service Prisma schema
- **THEN** `UnitRevision`, `RevisionContent`, and `StructureEvent` SHALL have comments explaining their canonical history role
- **AND** the comments SHALL distinguish editorial revisions from high-change structure batch events

### Requirement: Editor commit boundaries are explicit

Any editor surface that can perform multiple add, remove, reorder, or text-edit operations before a user-visible save SHALL define a commit boundary before connecting to canonical history. The commit boundary MAY be an editorial PATCH, a structure batch event, or a domain-specific batch endpoint, but it SHALL NOT be a replay of every local UI operation as separate history-scoped mutations.

#### Scenario: New high-change editor defines a batch boundary

- **WHEN** a new editor allows multiple local operations before saving
- **THEN** its specification SHALL identify how those operations are committed to canonical state
- **AND** it SHALL identify whether the resulting history record is an editorial revision or a structure event

#### Scenario: Autosave is not treated as product history by default

- **WHEN** a future feature adds autosave for an editor
- **THEN** autosave persistence SHALL be specified separately from canonical history
- **AND** autosave SHALL NOT write `UnitRevision` or `StructureEvent` records unless a separate proposal explicitly changes the history semantics
