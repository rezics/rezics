### Requirement: Server exposes a batch op endpoint for shelf items

The server SHALL expose a route at `PATCH /shelf/:shelfId/items/batch`
that accepts an op log payload and applies it atomically within one
Prisma transaction. The route SHALL require the same authentication and
ownership checks as the existing per-op item routes.

#### Scenario: Endpoint requires shelf ownership

- **WHEN** a request is made by a viewer who is not the shelf owner and is not an admin
- **THEN** the server SHALL respond with HTTP 403 and SHALL NOT apply any op

#### Scenario: Endpoint validates op union shape

- **WHEN** a request body contains an op with an unknown `op` discriminator
- **THEN** the server SHALL respond with HTTP 400 and SHALL NOT apply any op

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

#### Scenario: Attach op without position appends child to shelf end

- **GIVEN** the shelf's current maximum `ShelfUnit.position` is `m`
- **WHEN** an `attach` op for child `R` omits `position` and `ShelfUnit(R)` does not yet exist in the shelf
- **THEN** the server SHALL create `ShelfUnit(R)` with `position = keyAfter(m)`
- **AND** the existing positions of other shelf units SHALL NOT be modified

#### Scenario: Attach op with explicit position is persisted verbatim

- **WHEN** an `attach` op carries `position: "g5"` and `ShelfUnit(R)` does not yet exist in the shelf
- **THEN** the server SHALL create `ShelfUnit(R)` with `position = "g5"`

#### Scenario: Attach op skips ShelfUnit creation when child already in shelf

- **GIVEN** `ShelfUnit(R)` already exists in shelf `S` with `position = p`
- **WHEN** an `attach` op references child `R`
- **THEN** the server SHALL NOT modify `ShelfUnit(R).position`
- **AND** it SHALL only insert the `ShelfUnitRelation` row

#### Scenario: Attach op allows multi-parent

- **GIVEN** shelf `S` already has `ShelfUnitRelation(S, B1, T, 'tag')`
- **WHEN** an `attach` op attaches `T` to a different parent `B2` with the same role
- **THEN** the server SHALL insert `ShelfUnitRelation(S, B2, T, 'tag')`
- **AND** SHALL NOT reject the second attach as duplicate

#### Scenario: Attach op rejects self-relation

- **WHEN** an `attach` op specifies `parentUnitId === childUnitId`
- **THEN** the server SHALL record the op as `failed` with reason `self_relation_forbidden`
- **AND** no `ShelfUnitRelation` row SHALL be created

#### Scenario: setChildren auto-creates missing child shelf units

- **GIVEN** parent `B` is in shelf `S` and `S` does NOT yet contain `ShelfUnit(C1)` or `ShelfUnit(C2)`
- **WHEN** a `setChildren` op specifies `parentUnitId = B`, `role = 'tag'`, `childUnitIds = [C1, C2]`
- **THEN** the server SHALL upsert `ShelfUnit(S, C1)` and `ShelfUnit(S, C2)` using the same end-of-shelf position rule as a positionless `attach`
- **AND** it SHALL reconcile `ShelfUnitRelation(S, B, *, 'tag')` to exactly `[(B, C1, 'tag'), (B, C2, 'tag')]`
- **AND** any pre-existing relation `(S, B, X, 'tag')` for `X ∉ {C1, C2}` SHALL be deleted
- **AND** `ShelfUnit` rows that are no longer referenced by any relation SHALL remain in the shelf unless an explicit `delete` op removes them

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

#### Scenario: Database failure surfaces as 5xx

- **WHEN** the transaction fails to commit due to a database-level error
- **THEN** the server SHALL return a 5xx response
- **AND** no ops from the batch SHALL be persisted

### Requirement: Endpoint enforces a maximum op count per batch

The server SHALL enforce a configurable maximum number of ops per batch
request. Requests above the cap SHALL be rejected with HTTP 413 (Payload
Too Large) and an explanatory body. The default cap SHALL be 200 ops.

#### Scenario: Oversized batch is rejected

- **WHEN** a request contains more than the configured cap of ops
- **THEN** the server SHALL respond with HTTP 413
- **AND** no ops SHALL be applied
