## ADDED Requirements

### Requirement: ShelfUnit kind render discriminator

Each `ShelfUnit` SHALL have a `kind` field (`String`, max 32 characters) that tells the frontend which component to render without first hydrating the referenced Unit. The system SHALL determine `kind` at write time from the source Unit's type and — for POSTs — the `Post.kind` subtype.

#### Scenario: Book unit stores book kind

- **WHEN** a BOOK Unit is added to a shelf
- **THEN** the `ShelfUnit` SHALL have `kind = "book"`

#### Scenario: Review post unit stores review kind

- **WHEN** a POST Unit with `Post.kind = REVIEW` is added to a shelf
- **THEN** the `ShelfUnit` SHALL have `kind = "review"`

#### Scenario: Tag unit stores tag kind

- **WHEN** a TAG Unit is added to a shelf
- **THEN** the `ShelfUnit` SHALL have `kind = "tag"`

### Requirement: ShelfUnit kind value set

The contract package SHALL export a `ShelfUnitKind` union type covering all supported stored kind values. The initial supported values SHALL match the previous shelf item kind vocabulary unless another spec narrows or widens it.

#### Scenario: Contract exports ShelfUnitKind

- **WHEN** the shared contract package is compiled
- **THEN** it SHALL export `ShelfUnitKind`
- **AND** code SHALL NOT export `ShelfItemKind` as the canonical type for new shelf APIs

### Requirement: ShelfUnit kind is stored at write time

The `kind` value SHALL be computed at the moment a shelf unit is created and stored directly on `ShelfUnit.kind`. The render path SHALL NOT re-derive `kind` from joined `Unit`/`Post` data at read time.

#### Scenario: Create review computes review kind once

- **WHEN** a REVIEW post is attached to a shelf
- **THEN** the service SHALL create or update the child `ShelfUnit` with `kind = "review"`
- **AND** the shelf items response SHALL return that stored kind
