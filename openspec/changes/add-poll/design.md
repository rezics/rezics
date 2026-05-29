## Context

The codebase already implements "scored junction + per-user vote row" twice:

- `UnitTag(unitId, tagUnitId, score, voteCount)` + `TagVote(userId, unitId,
  tagUnitId, value)` — global tag scoring (`tag-scoring`).
- `RealmTagApplication(realmUnitId, tagUnitId, unitId, score, voteCount)` +
  `RealmTagApplicationVote(..., userId, value)` — realm-scoped tagging.

Reactions (`Reaction(userId, targetId, reaction)` + `ReactionSummary`) are a
different shape: unipolar, additive, with a unique key of `(userId, targetId,
reaction)` and no notion of a fixed option set or "exactly one" selection.

A poll is structurally the third instance of the junction+vote pattern, not an
extension of reactions. The decisive property is the **single-choice
invariant** — "choose exactly one of N" is a cross-row mutual-exclusivity
constraint. Reactions cannot express it (a user can react to every option);
tags cannot express it (multi-valued by nature). Only a junction whose primary
key includes the voter can enforce it in the database.

## Goals / Non-Goals

**Goals:**

- A poll primitive that enforces single-choice at the database layer and
  supports multi-choice by configuration.
- Options that are either ad-hoc text or references to existing units, without
  minting a `Unit` per option.
- One model that serves both named and anonymous polls, and both live and
  after-close result reveal, with the distinction living in read/authorization
  paths rather than storage.
- Reuse the established denormalized-tally maintenance pattern.

**Non-Goals:**

- Poll rendering / UI (follow-up).
- Ranked-choice, weighted, or quadratic voting (future schema; out of scope).
- Cross-poll aggregation or analytics.
- Migrating any existing reaction usage into polls.

## Decisions

### D1: Poll is a `Unit(type=POLL)`; options and votes are plain rows

Only the act of polling is a first-class unit (so it can be authored, addressed,
moderated, and live in feeds like other content). Options are lightweight rows
in `PollOption`; votes are rows in `PollVote`. Minting a `Unit` per option
(considered and rejected) is heavy — every option would carry status,
visibility, translations, moderation, and tag machinery it does not need — and
still would not enforce single-choice.

### D2: Single-choice exclusivity via primary key

- Single-choice poll: `PollVote` primary key `(pollUnitId, userId)` — the
  database guarantees at most one row per user per poll. Changing a vote is an
  `UPDATE` of `optionId`.
- Multi-choice poll: `PollVote` primary key `(pollUnitId, userId, optionId)` —
  one row per (user, option). `Poll.voteMode` (`SINGLE` | `MULTI`) selects which
  invariant applies; the service enforces option bounds and, for `MULTI`,
  optional min/max selections.

Enforcing exclusivity in application code (considered) is rejected: it races,
requires read-modify-write, and drifts. The primary key makes it impossible to
violate.

### D3: Dual-form options — `label` xor `unitId`

`PollOption(pollUnitId, optionId, position, voteCount, label String?, unitId
String? FK → Unit)`. Exactly one of `label` / `unitId` is set:

- `label`: ad-hoc text option ("Pizza").
- `unitId`: reference to an existing unit (vote for a book, a review, an
  answer). No new unit is created.

The client renders whichever field is present. `position` (fractional index)
orders options, consistent with existing pin/position ordering.

### D4: Denormalized tallies

`PollOption.voteCount` is maintained on cast / change / withdraw, exactly as
`UnitTag.score`/`voteCount` is maintained on `TagVote` changes. Reads of results
hit the denormalized counts, not an aggregate over `PollVote`. (Precedent:
`Post.replyCount`, `Post.lastReplyAt`.)

### D5: One model, two behaviors for named/anonymous and live/closed

Storage is invariant: `PollVote` always stores `userId`. This is required to
guarantee one-vote-per-user and to allow vote changes — even for anonymous
polls. The two behaviors are read-path/authorization concerns, gated by
poll-level flags:

- `Poll.anonymous: Boolean` — when true, the identity-bearing
  `userId`↔`optionId` mapping SHALL NOT be exposed through any read path; only
  aggregate tallies are returned. Anonymity is a presentation guarantee, not
  reduced storage.
- `Poll.resultVisibility: LIVE | AFTER_CLOSE` — `LIVE` exposes tallies at any
  time; `AFTER_CLOSE` withholds tallies (to non-privileged callers) until
  `Poll.closesAt` has passed or the poll is closed.

### D6: Close time

`Poll.closesAt: DateTime?` defines when a poll stops accepting votes and (for
`AFTER_CLOSE`) when results reveal. Null means open indefinitely until
explicitly closed.

## Risks / Trade-offs

- **Switching voteMode after votes exist** → Disallow changing `voteMode` once
  any `PollVote` row exists; the two modes have incompatible primary keys.
- **`AFTER_CLOSE` leakage** → Tally suppression must be enforced server-side in
  the read path, not by the client; the contract returns no counts to
  non-privileged callers before close. Cover with a test.
- **Anonymous de-anonymization** → The mapping is never serialized in any DTO
  for anonymous polls; only the casting user may see their own vote. Privileged
  audit access (if ever needed) is out of scope and must not reuse the public
  read path.
- **Option referencing a deleted unit** → `PollOption.unitId` uses
  `onDelete: SetNull` (or restrict); a null `unitId` with null `label` must be
  handled in rendering (treat as a tombstoned option, retain `voteCount`).
- **Vote integrity vs anonymity** → Storing `userId` for anonymous polls is a
  deliberate trade-off: integrity (one vote per user, changeable) over
  storage-level anonymity. Documented so it is a conscious product decision.

## Migration Plan

1. Add `UnitType.POLL` enum value (additive).
2. Create `Poll`, `PollOption`, `PollVote` tables with the two candidate primary
   keys handled by `voteMode` (single-choice PK is the default shape; multi adds
   `optionId` to the key — implement as the broader `(pollUnitId, userId,
   optionId)` PK plus a partial unique index `(pollUnitId, userId)` enforced
   only when `voteMode = SINGLE`, OR two code paths; decide in implementation per
   Prisma capability).
3. Add backend `poll` domain and mount it.
4. Add contract DTOs and api client.
5. No backfill — additive only. Rollback is dropping the tables and enum value
   (no existing data depends on them).

## Open Questions

- Single-choice PK enforcement under Prisma: a partial unique index keyed on
  `voteMode` vs two physical shapes. Resolve during implementation; both satisfy
  the spec's database-level guarantee.
- Whether `MULTI` polls need server-enforced min/max selection counts in this
  change or as a follow-up.
