## MODIFIED Requirements

### Requirement: Progress fact source schema

The system SHALL persist a single `UserUnitProgress` row per `(userId, unitId)` pair as the canonical fact source for that user's interaction with that unit. The row MUST carry: a fractional `progress` value in the closed interval `[0, 1]`, a `status` enum (`BACKLOG` | `ACTIVE` | `PAUSED` | `COMPLETED` | `DROPPED`), a `completedCount` non-negative integer, a cumulative `totalTimeMs` non-negative integer, an opaque `lastPosition` string (nullable), `firstSeenAt` and `lastSeenAt` timestamps, and an `extra` JSON payload constrained to a per-status domain map (the `ProgressExtra` shape). The pair `(userId, unitId)` MUST be the primary key.

The `extra` payload SHALL conform to the following narrow schema (Typebox in `@rezics/contract`):

```ts
{
  paused?:  { reasonPostUnitIds: string[] },
  dropped?: { reasonPostUnitIds: string[] },
}
```

with `additionalProperties: false`. Additional per-status domains MAY be added in the future, but writes SHALL be rejected for unknown top-level keys. Reads SHALL be lenient: rows whose stored `extra` does not match the current schema (e.g., legacy `null`, `{}`, or unknown keys) SHALL be returned to clients with the unrecognized portions of `extra` stripped from the DTO.

#### Scenario: One row per user-unit pair

- **WHEN** a user has interacted with a given unit in any way recorded by the API
- **THEN** the system stores exactly one row keyed by `(userId, unitId)` and rejects any attempt to insert a second row for the same pair

#### Scenario: Out-of-range progress is rejected

- **WHEN** a write request specifies `progress` outside the closed interval `[0, 1]`
- **THEN** the system rejects the request with a validation error and does not modify the row

#### Scenario: Negative time delta is rejected

- **WHEN** a write request specifies a negative `addTimeMs`
- **THEN** the system rejects the request with a validation error and does not modify the row

#### Scenario: Extra with unknown top-level key is rejected on write

- **WHEN** a write request specifies `extra = { foo: { bar: 1 } }` where `foo` is not a recognized per-status domain
- **THEN** the system rejects the request with a validation error and does not modify the row

#### Scenario: Extra with valid per-status domain is accepted

- **WHEN** a write request specifies `extra = { paused: { reasonPostUnitIds: ["<uuid>"] } }`
- **THEN** the system stores the value as-is and returns it in subsequent fetches

#### Scenario: Legacy or unknown stored extra is sanitized on read

- **WHEN** a stored row contains `extra = { legacy: 1, paused: { reasonPostUnitIds: ["<uuid>"] } }`
- **THEN** the GET response SHALL surface only the recognized portion (`{ paused: { reasonPostUnitIds: [...] } }`) and SHALL NOT raise an error

### Requirement: Progress and shelf are orthogonal stores

The system SHALL treat `UserUnitProgress` and `Shelf` / `ShelfItem` / `ShelfUnit` as independent stores. A write to `UserUnitProgress` MUST NOT create, modify, or delete any shelf row as a side effect. A write to a shelf row (collect, uncollect, reorder, kindKey change) MUST NOT create, modify, or delete any `UserUnitProgress` row as a side effect. Cross-user aggregate queries over progress state (e.g. how many users have a unit in a given status) SHALL be answered by the Meilisearch projection of `UserUnitProgress` (built by a sibling change), never by aggregating shelf membership.

System-shelf membership that mirrors progress status SHALL be maintained exclusively by the frontend as a dual-write against the existing shelf API:

- The `backlog` and `active` system shelves SHALL mirror the user's current status. When a user transitions into `BACKLOG` (respectively `ACTIVE`), the frontend SHALL add the unit to that shelf; when leaving, the frontend SHALL remove it.
- The `completed` system shelf SHALL be add-only with respect to status. When a user transitions into `COMPLETED` for the first time the frontend SHALL add the unit; subsequent transitions out of `COMPLETED` SHALL NOT remove it. Re-entering `COMPLETED` (re-read) is naturally idempotent against the shelf primary key.
- The `PAUSED` and `DROPPED` statuses SHALL NOT have any system-shelf membership. Frontends SHALL NOT create or expect a `paused` or `dropped` system shelf.

The "Remove progress" action (`DELETE /me/units/:unitId/progress`) SHALL ALSO be paired by the frontend with shelf operations: a `remove` against any mirrored shelf currently containing the unit, and SHALL leave the `completed` shelf untouched.

#### Scenario: Progress upsert does not write to shelf

- **WHEN** an authenticated user calls `PUT /me/units/:unitId/progress` with any combination of fields, including the case where the upsert coerces `status` to `COMPLETED`
- **THEN** the system writes only to the `UserUnitProgress` row and makes no insert, update, or delete on any `Shelf`, `ShelfItem`, or `ShelfUnit` row

#### Scenario: Shelf collect does not write to progress

- **WHEN** an authenticated user adds a unit to one of their shelves through the existing shelf collect endpoints
- **THEN** the system writes only to the shelf-related rows and makes no insert, update, or delete on any `UserUnitProgress` row

#### Scenario: Frontend dual-write tolerates partial failure

- **WHEN** a client issues two independent requests (one progress upsert, one shelf collect) representing the same user intent and one of them fails while the other succeeds
- **THEN** the succeeding request is durable, the failing request can be retried independently, and no backend reconciliation is required for the system to remain correct from the perspective of either store

#### Scenario: Mirrored shelves follow status

- **WHEN** the frontend executes a transition from `BACKLOG` to `ACTIVE` for a unit
- **THEN** the frontend SHALL issue a remove from the user's `backlog` shelf and an add to the user's `active` shelf in addition to the progress `PUT`
- **AND** the backend SHALL accept the shelf operations through the existing shelf endpoints with no special-casing

#### Scenario: Completed shelf is add-only on status leave

- **WHEN** the frontend executes a transition from `COMPLETED` back to `ACTIVE` (re-read)
- **THEN** the frontend SHALL add the unit to the `active` shelf
- **AND** the frontend SHALL NOT remove the unit from the `completed` shelf
- **AND** the underlying `ShelfItem` primary key (`shelfUnitId, itemRef`) ensures the existing `completed` membership is preserved

#### Scenario: Paused and Dropped statuses produce no shelf membership

- **WHEN** the frontend executes a transition into `PAUSED` or `DROPPED`
- **THEN** the frontend SHALL NOT add the unit to any system shelf
- **AND** if the prior status was `BACKLOG` or `ACTIVE`, the frontend SHALL remove the unit from that mirrored shelf

#### Scenario: Remove progress sweeps mirrored shelves

- **WHEN** the frontend invokes "Remove progress" (`DELETE /me/units/:unitId/progress`) for a unit currently mirrored in `active`
- **THEN** the frontend SHALL also `DELETE` the unit from the user's `active` shelf
- **AND** SHALL NOT remove the unit from the `completed` shelf if present
