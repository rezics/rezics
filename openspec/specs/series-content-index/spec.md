# series-content-index Specification

## Purpose

Defines direct Series release indexing derived from counted Series content-structure release member nodes. The `SeriesContentIndex` exists only for direct release lookup and repair: it carries no hierarchy, ordering, path, depth, inherited membership, or work-domain authority, never recursively expands nested Series, and is treated as a derived, repairable projection.

## Requirements

### Requirement: Series content index is direct release only

The system SHALL maintain a direct `SeriesContentIndex` derived from counted
Series release member nodes. The index SHALL include direct release nodes only
and SHALL NOT recursively expand nested Series Units or store Work Units as
members.

#### Scenario: Nested Series does not expand index

- **WHEN** parent Series `A` references child Series `B`
- **THEN** the direct Series content index for `A` SHALL NOT include `B`'s child releases
- **AND** it SHALL include only release nodes directly present in `A`

### Requirement: Series content index has no hierarchy authority

The direct Series content index SHALL exist only for release lookup and repair.
It SHALL NOT store path, depth, ordering, parentage, inherited membership, or
work-domain membership authority.

#### Scenario: Consumer needs node hierarchy

- **WHEN** a consumer needs the parent, order, depth, or display path for a Series release entry
- **THEN** it SHALL read the Series content-structure node by `contentNodeId`
- **AND** it SHALL NOT infer hierarchy from the Series content index

### Requirement: Series content index supports direct release lookup

The direct Series content index SHALL support lookup from Series to directly
contained release Units and from release Unit to directly containing Series
Units. Each index row SHALL identify the source content-structure node.

#### Scenario: Find Series that directly contain a release

- **WHEN** the system queries Series that directly contain `release-a`
- **THEN** it SHALL use direct Series content index rows for `releaseUnitId = release-a`
- **AND** each result SHALL include or resolve the `contentNodeId` that caused the direct containment

### Requirement: Series content index is repairable

The direct Series content index SHALL be treated as a derived, repairable
projection of Series release member nodes. Content-structure edits and repair
jobs SHALL be able to rebuild index rows without changing Series history.

#### Scenario: Index drift is repaired

- **WHEN** diagnostics detect a mismatch between Series release member nodes and direct Series content index rows
- **THEN** repair SHALL rebuild the index from direct release member nodes
- **AND** the repair SHALL NOT create a new Series structure history event unless the structure itself changes
