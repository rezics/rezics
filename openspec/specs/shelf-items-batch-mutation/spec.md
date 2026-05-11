### Requirement: Server exposes a batch op endpoint for shelf items

The server SHALL expose a route at `PATCH /shelf/:shelfUnitId/items/batch`
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

The request body SHALL be a typed union of op records validated by a TypeBox
schema. Supported op kinds SHALL include at minimum:

- `{ op: "add", itemRef, kind, position, tagIds?, reviewIds? }`
- `{ op: "reorder", itemRef, position }`
- `{ op: "reorderToPage", itemRef, toPage: number, edge: "first" }`
- `{ op: "delete", itemRef }`
- `{ op: "setTags", itemRef, tagIds }`

Server-side handling SHALL preserve op order across the transaction.
`position` strings supplied by the client SHALL be accepted as-is and
persisted without recomputation (the client computes the fractional index).

#### Scenario: Ops are applied in submitted order

- **WHEN** a batch contains `[delete X, add X with new fields]`
- **THEN** the server SHALL apply the delete first and the add second
- **AND** the resulting row SHALL reflect the add's fields

#### Scenario: Client-computed position is persisted verbatim

- **WHEN** an `add` op carries `position: "g5"`
- **THEN** the persisted `ShelfItem.position` SHALL equal `"g5"`

### Requirement: Batch endpoint resolves cross-page reorders server-side

For `reorderToPage` ops, the server SHALL fetch the first item of the
destination page (using the same cursor pagination as the items list query)
and compute the target item's new `position` as `keyBefore(firstPosition)`
using the existing server-side fractional-index utility. If the destination
page is out of range (page index beyond `ceil(itemCount / pageSize)`) the
server SHALL fail just that op.

#### Scenario: Moving to a valid page lands at the first slot

- **WHEN** an op specifies `toPage: 3, edge: "first"`
- **AND** the first item of page 3 has position `m`
- **THEN** the server SHALL compute the new position as `keyBefore("m")`

#### Scenario: Out-of-range page targets fail per-op

- **WHEN** an op specifies `toPage: 99` on a shelf with 4 pages
- **THEN** that op SHALL be recorded as `failed` with a reason
- **AND** other ops in the same batch SHALL apply normally

### Requirement: Batch response reports per-op outcomes

The response body SHALL contain `results: Array<{ status: "ok" | "failed", op, item?, reason? }>`
in the same order as the request. Per-op failures SHALL NOT roll back the
transaction; ops that succeed SHALL be persisted. Whole-transaction errors
(database unavailable, etc.) SHALL still surface as a 5xx error covering the
entire batch.

#### Scenario: Mixed outcomes both persist successes and report failures

- **WHEN** a 6-op batch has 5 valid ops and 1 op targeting a deleted item
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
