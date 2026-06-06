---
title: Cross-Owner Timestamp Defaults Audit
status: active
created: 2026-06-06
completed:
supersededBy:
tags: [database, drizzle, server, auth, notify, history, ranking]
---

## Why

The database schema has a cross-owner timestamp convention gap: many columns
named `updatedAt` are `NOT NULL` but have no database default. Inserts that omit
`updatedAt` therefore fail at the database boundary even when the domain code
does not conceptually care about a distinct update timestamp at creation time.

This is not a `/post`-specific problem. A migration scan currently finds this
shape in `server` (48 columns), `auth` (7), `ranking` (4), `history` (2), and
`notify` (1); `reaction` currently has no `updatedAt` columns. The goal is to
make timestamp behavior explicit and consistent across schema owners, then
remove ad hoc per-callsite timestamp patches where a schema-level default is the
durable fix. The work should also improve database error unwrapping so future
Drizzle-wrapped constraint failures expose the real PostgreSQL code, table,
column, and constraint.

## Durable constraints & decisions

- `(type)` Timestamp helper definitions are the source of ordinary timestamp
  shape. In `@rezics/server`, `createdAt()` and `updatedAt()` should encode the
  intended insert defaults instead of requiring every service insert to remember
  `updatedAt`.
- `(test)` Inserting a row into representative tables with only required domain
  fields should not fail solely because `updatedAt` was omitted. Cover each
  affected owner: `server`, `auth`, `notify`, `history`, and `ranking`.
- `(test)` Drizzle-wrapped database errors must unwrap `cause` so `23502`,
  `23503`, `23505`, `23514`, and `22P02` still map to the existing API error
  response instead of falling through to 500.
- `(comment)` History event timestamps (`createdAt`, `ingestedAt`) are event
  time, not generic mutable record timestamps; do not rename or default them as
  `updatedAt` unless the table actually models mutable state.
- `(test)` Existing explicit `updatedAt` writes remain valid and should continue
  to win over defaults when code intentionally sets a domain timestamp.
- `(type)` Reaction schema has no `updatedAt` columns today; include it in the
  audit output as an explicit zero so the owner is not silently forgotten.

## 1. Audit Timestamp Shape

- [ ] 1.1 Add or run a small repository audit for schema columns named
  `updatedAt`, grouped by schema owner and whether they have a database default.
  Seed the expected affected-owner count from the current scan: server 48, auth
  7, ranking 4, history 2, notify 1, reaction 0.
- [ ] 1.2 Audit runtime insert callsites for tables with `updatedAt NOT NULL`
  and classify each as already explicit, covered by future default, or requiring
  deliberate explicit timestamp semantics.
- [ ] 1.3 Record the audited owner list in tests or a focused helper so future
  schema additions cannot silently reintroduce `updatedAt NOT NULL` without a
  default.

## 2. Normalize Schema Defaults

- [ ] 2.1 Update `package/server/src/db/schema/columns.ts` so the shared
  `updatedAt()` helper has the intended insert default.
- [ ] 2.2 Update non-server schema owners that define `updatedAt` inline
  (`auth`, `notify`, `history`, `ranking`) or introduce owner-local timestamp
  helpers where that keeps the schema readable.
- [ ] 2.3 Generate Drizzle migrations for each affected schema owner using the
  documented workflow.
- [ ] 2.4 Review generated SQL for existing rows and defaults; keep any manual
  SQL edits limited to documented Drizzle-generated defects.

## 3. Remove Local Workarounds

- [ ] 3.1 Revisit `/post` create flow changes made during debugging and remove
  `updatedAt` fields that become redundant under the schema default.
- [ ] 3.2 Keep explicit `updatedAt` on update/upsert conflict paths where it
  represents an actual mutation time.
- [ ] 3.3 Re-run `/post` create against the local server/database to confirm the
  original failure is gone without relying on per-insert timestamp filler.

## 4. Error Handling

- [ ] 4.1 Update the server database error reader to unwrap Drizzle
  `DrizzleQueryError.cause` before falling back to the wrapper error.
- [ ] 4.2 Add a focused test proving a wrapped PostgreSQL error with code
  `23502` maps to the existing 400 database response detail.
- [ ] 4.3 Check whether other services with public APIs need the same Drizzle
  error unwrapping pattern.

## 5. Validation

- [ ] 5.1 Run focused timestamp insertion tests for changed schema owners.
- [ ] 5.2 Run `bun run db:generate -- --package=<owner>` and
  `bun run db:migrate -- --package=<owner>` for each changed owner.
- [ ] 5.3 Before handoff, run the broader database validation required by
  `docs/guide/database-workflow.md`, or document any local environment blocker.

## Out of scope

- Adding automatic update triggers for every mutable table. This proposal is
  about insert defaults and explicit application-managed update timestamps.
- Changing event-time columns such as `createdAt`, `ingestedAt`, `computedAt`,
  `rankUpdatedAt`, or domain-specific timestamps.
- Reworking unrelated `/post`, notification, or realm-extra behavior beyond
  removing temporary timestamp workarounds and preserving already identified
  regression fixes.
