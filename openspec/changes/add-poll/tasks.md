## 1. Schema & Migration

- [x] 1.1 Add `POLL` to the `UnitType` enum in `package/server/prisma/schema.prisma`
- [x] 1.2 Add `Poll` model (1:1 on `Unit`): `unitId` PK/FK, `voteMode` (SINGLE|MULTI), `resultVisibility` (LIVE|AFTER_CLOSE), `anonymous Boolean`, `closesAt DateTime?`; add `PollVoteMode` and `PollResultVisibility` enums
- [x] 1.3 Add `PollOption` model: `pollUnitId`, `optionId`, `position`, `voteCount Int @default(0)`, `label String?`, `unitId String? FK → Unit (onDelete: SetNull)`; index `(pollUnitId, position)`
- [x] 1.4 Add `PollVote` model with `(pollUnitId, userId, optionId)` PK plus a partial unique index on `(pollUnitId, userId)` for SINGLE polls (or the chosen equivalent that enforces single-choice at the DB layer); index `(pollUnitId, optionId)`
- [x] 1.5 Generate the Prisma migration and run `prisma:generate`

## 2. Contract

- [x] 2.1 Add poll DTOs in `package/contract/src/poll.ts`: `PollDTO`, `PollOptionDTO` (label xor unitId), and the vote-mode/result-visibility literals
- [x] 2.2 Add request schemas: create poll (with options), cast/change vote, withdraw vote
- [x] 2.3 Add tally response schema with conditional fields (no counts before close for AFTER_CLOSE; no voter↔option mapping when anonymous; caller's own vote always included)

## 3. Backend Domain

- [x] 3.1 Create `package/server/src/poll/poll.types.ts` and `poll.mapper.ts`
- [x] 3.2 Implement `poll.service.ts`: create poll + options (validate label-xor-unitId, ≥2 options); reject voteMode change once any vote exists
- [x] 3.3 Implement cast/change/withdraw vote with `voteCount` denormalization maintained on every change (mirror tag-score maintenance)
- [x] 3.4 Enforce single-choice via the DB constraint; for MULTI allow multiple rows per user
- [x] 3.5 Implement result read with `resultVisibility` gating (withhold tallies before close for AFTER_CLOSE) and `anonymous` gating (never serialize voter↔option mapping)
- [x] 3.6 Reject votes after the poll is closed / past `closesAt`
- [x] 3.7 Create `poll.api.ts` and mount it from `package/server/src/index.ts`

## 4. API Client

- [x] 4.1 Add `@rezics/api` hooks for poll read (poll + options + tallies) and write (cast/change/withdraw) with query invalidation

## 5. Tests

- [x] 5.1 Single-choice: changing vote updates the same row and adjusts both tallies; DB prevents a duplicate row
- [x] 5.2 Multi-choice: a user holds multiple option votes
- [x] 5.3 Option validation: reject neither/both of label and unitId
- [x] 5.4 AFTER_CLOSE: tallies hidden before close, revealed after; votes rejected after close
- [x] 5.5 Anonymous: results expose aggregate tallies but never the voter↔option mapping; caller sees only their own vote
- [x] 5.6 Withdraw decrements `voteCount` and removes the vote row

## 6. Quality

- [x] 6.1 `bun run format` and `bun run check:convention`
- [x] 6.2 `bun test` for the poll package/domain
