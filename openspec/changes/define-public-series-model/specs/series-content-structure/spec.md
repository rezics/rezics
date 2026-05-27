## ADDED Requirements

### Requirement: Series content uses generic content structure

A Series SHALL use generic content structure as the source of truth for its
direct content, display hierarchy, ordering, grouping, node labels, and
history-bearing structure edits.

#### Scenario: Series displays direct content tree

- **WHEN** a Series detail surface renders its contents
- **THEN** it SHALL read hierarchy and ordering from the Series content structure
- **AND** it SHALL NOT read hierarchy or ordering from Series lookup indexes

### Requirement: Counted Series member nodes reference releases

A Series content-structure node that represents counted Series membership SHALL
reference a visible release Unit. Work Units SHALL NOT be counted Series member
nodes.

#### Scenario: Media Series contains displayable releases

- **WHEN** an anime media Series contains a TV release, a film release, and an OVA release
- **THEN** the content structure SHALL store direct member nodes for those visible release Units
- **AND** each direct release node SHALL remain an explicit public-knowledge assertion

### Requirement: Nested Series references are non-transitive

A Series content structure MAY contain another Series Unit as a structural or
cross-reference node where the contract allows that node kind. That nested
Series reference SHALL NOT be counted as inherited release membership, search
projection, or work-domain projection.

#### Scenario: Parent Series references child Series and direct releases

- **WHEN** Marvel franchise references the Marvel Cinematic Universe Series Unit
- **THEN** Marvel franchise SHALL NOT automatically inherit the MCU Series releases
- **AND** Marvel franchise SHALL directly include representative Iron Man, Avengers, or other releases that must count as Marvel franchise members

### Requirement: Series structure edits enter public history

Changes to Series content structure SHALL be recorded as public-knowledge
history events. This includes adding release nodes, removing release nodes,
moving nodes, changing node labels, changing node metadata, and replacing the
representative release for a work-level intent.

#### Scenario: Editor adds release to Series

- **WHEN** an editor adds a release node to a Series content structure
- **THEN** the system SHALL record a history event for the Series structure edit
- **AND** derived index or work-domain projection repair SHALL NOT be the source history event
