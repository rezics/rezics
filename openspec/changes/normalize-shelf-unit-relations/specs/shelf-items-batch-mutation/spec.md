## MODIFIED Requirements

### Requirement: Batch payload is an ordered op log

The request body SHALL be a typed union of op records validated by a TypeBox schema. Supported op kinds SHALL include at minimum:

- `{ op: "add", unitId, kind, position }`
- `{ op: "reorder", unitId, position }`
- `{ op: "reorderToPage", unitId, toPage: number, edge: "first", pageSize?, order? }`
- `{ op: "delete", unitId }`
- `{ op: "attach", parentUnitId, childUnitId, childKind, role, position? }`
- `{ op: "detach", parentUnitId, childUnitId, role }`
- `{ op: "setChildren", parentUnitId, role, childUnitIds }`

Server-side handling SHALL preserve op order across the transaction. `position` strings supplied by the client SHALL be accepted as-is and persisted without recomputation except for `reorderToPage`, where the server computes the destination position.

#### Scenario: Ops are applied in submitted order

- **WHEN** a batch contains `[delete X, add X with new fields]`
- **THEN** the server SHALL apply the delete first and the add second
- **AND** the resulting `ShelfUnit` row SHALL reflect the add's fields

#### Scenario: Client-computed position is persisted verbatim

- **WHEN** an `add` op carries `position: "g5"`
- **THEN** the persisted `ShelfUnit.position` SHALL equal `"g5"`

#### Scenario: Attach op creates child unit and relation

- **WHEN** an `attach` op references parent `B` and child `R`
- **THEN** the server SHALL ensure `ShelfUnit(R)` exists in the same shelf
- **AND** it SHALL create `ShelfUnitRelation(B, R, role)`

### Requirement: Batch endpoint resolves cross-page reorders server-side

For `reorderToPage` ops, the server SHALL fetch the first shelf unit of the destination page using the same page size and manual sort order shown by the editor, then compute the moved unit's new `position`. If the destination page is out of range, the server SHALL fail just that op.

#### Scenario: Moving to a valid page lands at the first slot

- **WHEN** an op specifies `toPage: 3, edge: "first"`
- **AND** the first unit of page 3 has position `m`
- **THEN** the server SHALL compute a new position that places the moved unit at the visual top of page 3

#### Scenario: Out-of-range page targets fail per-op

- **WHEN** an op specifies `toPage: 99` on a shelf with 4 pages
- **THEN** that op SHALL be recorded as `failed` with a reason
- **AND** other ops in the same batch SHALL apply normally

### Requirement: Batch response reports per-op outcomes

The response body SHALL contain `results: Array<{ status: "ok" | "failed", op, unit?, relation?, reason? }>` in the same order as the request. Per-op failures SHALL NOT roll back the transaction; ops that succeed SHALL be persisted. Whole-transaction errors SHALL still surface as a 5xx error covering the entire batch.

#### Scenario: Mixed outcomes both persist successes and report failures

- **WHEN** a 6-op batch has 5 valid ops and 1 op targeting a deleted unit
- **THEN** the response SHALL contain 6 result entries in order
- **AND** the 5 valid ops SHALL be marked `ok` and persisted
- **AND** the 1 invalid op SHALL be marked `failed` with a reason string
