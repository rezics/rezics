## 1. Schema and Migration

- [ ] 1.1 Add `UserUnitProgress` model and `UserUnitProgressStatus` enum (`BACKLOG | ACTIVE | COMPLETED | DROPPED`) to `package/server/prisma/schema.prisma` (composite PK `(userId, unitId)`, indexes on `(userId, lastSeenAt DESC)` and `(unitId, status)`).
- [ ] 1.2 Add `extra Json?` to the `User` model in the same `schema.prisma`.
- [ ] 1.3 Run `bun run prisma:migrate` in `package/server/` to generate one combined migration and regenerate the Prisma client.
- [ ] 1.4 Verify migration applies cleanly against a fresh local database and the generated client exposes `userUnitProgress` typings and the new `extra` field on `User`.

## 2. Contract Layer

- [ ] 2.1 Add Typebox schemas in `package/contract/` for: progress upsert request body, progress row DTO, list query (cursor + limit), and list response (rows + nextCursor). Status enum literal values MUST be `BACKLOG | ACTIVE | COMPLETED | DROPPED` and lowercase shelf kindKeys (`favorites`, `backlog`, `active`, `completed`) MUST be exposed as constants from the same module.
- [ ] 2.2 Add a Typebox schema for `UserExtra` describing the `extra.shelves` map (`Record<string, Uuid>` with the four known keys typed) and re-export from the contract entry point.
- [ ] 2.3 Re-export the new schemas from the package's public entry point following the existing convention.

## 3. Server Domain Module

- [ ] 3.1 Create `package/server/src/progress/progress.types.ts` defining the domain types and the status enum mapping.
- [ ] 3.2 Create `package/server/src/progress/progress.mapper.ts` converting Prisma rows to contract DTOs (BigInt to Number serialization, ISO timestamps).
- [ ] 3.3 Create `package/server/src/progress/progress.service.ts` with: `upsert(userId, unitId, body)` using a single Prisma `upsert` whose update branch increments `totalTimeMs` atomically and overwrites non-additive fields conditionally; `get(userId, unitId)`; `list(userId, { cursor, limit })`; `delete(userId, unitId)`. The service MUST NOT read or write any shelf row.
- [ ] 3.4 Validate inputs server-side: reject `progress` outside `[0, 1]`; reject negative `addTimeMs`; clamp page size in `list`.
- [ ] 3.5 Apply the "progress >= 1.0 implies status = COMPLETED" coercion rule on the upsert path (only when client did not explicitly set status to a different value). The coercion mutates only the progress row — no shelf side effect.
- [ ] 3.6 Create `package/server/src/progress/progress.api.ts` exposing the four endpoints under the existing auth-gated mount; bind handlers to the service and wire request/response Typebox schemas from contract.
- [ ] 3.7 Mount the progress module via `.use()` in `package/server/src/index.ts`.

## 3a. System Shelves and User Bootstrap

- [ ] 3a.1 In `package/server/src/shelf/`, add a `SYSTEM_KIND_KEYS = ["favorites", "backlog", "active", "completed"] as const` constant and a small typed accessor for `User.extra.shelves` (read + patch, with Typebox-validated shape).
- [ ] 3a.2 Refactor the existing `getFavoritesShelfId` lookup (`collection.service.ts`) to use the new accessor — first read `User.extra.shelves.favorites`, fall back to the existing `findFirst by kindKey` and patch the result back into `User.extra.shelves`.
- [ ] 3a.3 Add a generic `getOrCreateSystemShelf(userId, kindKey)` helper that the lazy-create fallback uses for `backlog`, `active`, `completed` (and any future system shelf). The helper bootstraps a `SHELF`-type Unit + `Shelf` row + the matching `User.extra.shelves[kindKey]` patch, all in one transaction.
- [ ] 3a.4 In the user registration / provisioning path, call `getOrCreateSystemShelf` for all four kindKeys inside the same transaction as the `User` insert so new users have `extra.shelves` fully populated up front.
- [ ] 3a.5 In the shelf service create path, reject any client-supplied `kindKey` that matches `SYSTEM_KIND_KEYS` with a clear validation error.

## 4. Frontend API Hooks

- [ ] 4.1 Add TanStack Query hooks in `package/api/` for: `useUnitProgress(unitId)`, `useUpdateUnitProgress(unitId)`, `useMyProgressList()`, `useDeleteUnitProgress(unitId)`.
- [ ] 4.2 Define query keys consistent with the project's existing key conventions; ensure the upsert mutation invalidates the affected single-unit and list queries.

## 5. Tests

- [ ] 5.1 Add server unit tests covering: first-time upsert creates row with defaults (`status` defaults to `BACKLOG`); partial upsert preserves untouched fields; `addTimeMs` accumulates atomically across two parallel upserts; out-of-range progress and negative `addTimeMs` are rejected; cross-user write is impossible through the endpoint; delete is idempotent; list orders by `lastSeenAt` descending and respects the cursor; `progress >= 1.0` coerces to `COMPLETED` when status is unset; coercion does not write to any shelf row.
- [ ] 5.2 Add system-shelf bootstrap tests: new user registration creates four shelves and populates `User.extra.shelves`; lazy-create fallback patches a missing key; reserved-kindKey guard rejects user attempts to create `favorites`/`backlog`/`active`/`completed` shelves.
- [ ] 5.3 Add an orthogonality test: a sequence of progress upserts (including a 1.0 coercion) followed by inspection of all shelf tables shows zero shelf-side changes for the affected user; symmetrically, a sequence of shelf collect/uncollect calls leaves `UserUnitProgress` unchanged.
- [ ] 5.4 Add a contract round-trip test ensuring server response shape matches the Typebox DTO (progress row, list response, and `User.extra` shape).

## 6. Validation

- [ ] 6.1 Run `bun test` inside `package/server/`, `package/contract/`, and `package/api/` and confirm all tests pass.
- [ ] 6.2 Run `bunx tsc --noEmit` per package across `package/server/`, `package/contract/`, `package/api/` and confirm no errors.
- [ ] 6.3 Run `bun run check:convention` from repo root and confirm it still passes.
- [ ] 6.4 Run `openspec validate add-user-unit-progress` and confirm the change is well-formed.
