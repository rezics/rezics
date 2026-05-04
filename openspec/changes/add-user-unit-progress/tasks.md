## 1. Schema and Migration

- [ ] 1.1 Add `UserUnitProgress` model and `UserUnitProgressStatus` enum to `package/server/prisma/schema.prisma` (composite PK `(userId, unitId)`, indexes on `(userId, lastSeenAt DESC)` and `(unitId, status)`).
- [ ] 1.2 Run `bun run prisma:migrate` in `package/server/` to generate the migration and regenerate the Prisma client.
- [ ] 1.3 Verify migration applies cleanly against a fresh local database and the generated client exposes `userUnitProgress` typings.

## 2. Contract Layer

- [ ] 2.1 Add Typebox schemas in `package/contract/` for: progress upsert request body, progress row DTO, list query (cursor + limit), and list response (rows + nextCursor).
- [ ] 2.2 Re-export the new schemas from the package's public entry point following the existing convention.

## 3. Server Domain Module

- [ ] 3.1 Create `package/server/src/progress/progress.types.ts` defining the domain types and the status enum mapping.
- [ ] 3.2 Create `package/server/src/progress/progress.mapper.ts` converting Prisma rows to contract DTOs (BigInt to Number serialization, ISO timestamps).
- [ ] 3.3 Create `package/server/src/progress/progress.service.ts` with: `upsert(userId, unitId, body)` using a single Prisma `upsert` whose update branch increments `totalTimeMs` atomically and overwrites non-additive fields conditionally; `get(userId, unitId)`; `list(userId, { cursor, limit })`; `delete(userId, unitId)`.
- [ ] 3.4 Validate inputs server-side: reject `progress` outside `[0, 1]`; reject negative `addTimeMs`; clamp page size in `list`.
- [ ] 3.5 Apply the "progress >= 1.0 implies status = COMPLETED" coercion rule on the upsert path (only when client did not explicitly set status to a different value).
- [ ] 3.6 Create `package/server/src/progress/progress.api.ts` exposing the four endpoints under the existing auth-gated mount; bind handlers to the service and wire request/response Typebox schemas from contract.
- [ ] 3.7 Mount the progress module via `.use()` in `package/server/src/index.ts`.

## 4. Frontend API Hooks

- [ ] 4.1 Add TanStack Query hooks in `package/api/` for: `useUnitProgress(unitId)`, `useUpdateUnitProgress(unitId)`, `useMyProgressList()`, `useDeleteUnitProgress(unitId)`.
- [ ] 4.2 Define query keys consistent with the project's existing key conventions; ensure the upsert mutation invalidates the affected single-unit and list queries.

## 5. Tests

- [ ] 5.1 Add server unit tests covering: first-time upsert creates row with defaults; partial upsert preserves untouched fields; `addTimeMs` accumulates atomically across two parallel upserts; out-of-range progress and negative `addTimeMs` are rejected; cross-user write is impossible through the endpoint; delete is idempotent; list orders by `lastSeenAt` descending and respects the cursor.
- [ ] 5.2 Add a contract round-trip test ensuring server response shape matches the Typebox DTO.

## 6. Validation

- [ ] 6.1 Run `bun test` inside `package/server/`, `package/contract/`, and `package/api/` and confirm all tests pass.
- [ ] 6.2 Run `bunx tsc --noEmit` per package across `package/server/`, `package/contract/`, `package/api/` and confirm no errors.
- [ ] 6.3 Run `bun run check:convention` from repo root and confirm it still passes.
- [ ] 6.4 Run `openspec validate add-user-unit-progress` and confirm the change is well-formed.
