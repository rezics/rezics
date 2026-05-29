## Why

The platform has no first-class poll/voting primitive. Reactions express
unipolar, multi-category, non-exclusive sentiment ("like"), and tags express
multi-valued, crowd-votable classification — neither can express a poll's core
invariant: **pick exactly one (or k) of a fixed option set**. That invariant is
a cross-row mutual-exclusivity constraint, which only a junction table with a
purpose-built primary key can enforce at the database layer. A poll is the third
instance of an existing, proven pattern (`UnitTag`+`TagVote`,
`RealmTagApplication`+`RealmTagApplicationVote`) — a scored junction plus a
per-user vote row — so it should reuse that shape rather than overload
reactions or mint a `Unit` per option.

## What Changes

- Add a **poll** primitive backed by three storage shapes:
  - `Poll` — a `Unit(type=POLL)`; only the *act of polling* is a Unit. Carries
    poll-level configuration (vote mode, result visibility, anonymity, close
    time).
  - `PollOption` — a lightweight per-option row (NOT a Unit). Each option is
    **dual-form**: a free-text `label` for ad-hoc options, OR a `unitId` foreign
    key referencing an existing `Unit` (vote-for-a-book / vote-for-an-answer).
    Exactly one of the two is set; the client renders whichever is present.
  - `PollVote` — a per-user vote row. **Single-choice** uses primary key
    `(pollUnitId, userId)`; **multi-choice** uses `(pollUnitId, userId,
    optionId)`. Single-choice exclusivity is guaranteed by the primary key in
    the database, not by application code. Changing a vote is an update; tallies
    are kept in a denormalized `PollOption.voteCount`, maintained the same way as
    `UnitTag.score`.
- Support **named/anonymous** and **live/closed-tally** results with one model,
  two behaviors. `PollVote` always stores `userId` (to guarantee one-vote-per-
  user and allow vote changes); the differences live only in read/authorization
  paths, gated by poll-level flags (`resultVisibility`, `anonymous`). Anonymity
  is a presentation guarantee (never expose the `userId`↔`optionId` mapping), not
  reduced storage.
- Add `@rezics/contract` DTOs and `@rezics/api` client access for creating
  polls, casting/changing/withdrawing votes, and reading tallies (live or after
  close, identity-bearing or anonymized per poll config).

## Capabilities

### New Capabilities

- `poll-voting`: the poll primitive — `Poll`/`PollOption`/`PollVote` storage,
  dual-form options (label vs unit reference), single- vs multi-choice
  exclusivity via primary key, denormalized tallies, vote change/withdraw, and
  the named/anonymous + live/after-close result modes with their read-path
  gating.

### Modified Capabilities

<!-- None. The `UnitType.POLL` enum addition is defined within the new
     `poll-voting` capability (a poll IS a Unit of the new type), consistent
     with how each unit type owns its own type-extension spec. -->


## Impact

- **package/server**: new Prisma models `Poll`, `PollOption`, `PollVote`; a new
  `UnitType.POLL` value (migration); a new `poll` backend domain
  (`poll.api.ts`, `poll.service.ts`, `poll.mapper.ts`, `poll.types.ts`) mounted
  from `package/server/src/index.ts`. Vote-count denormalization maintained on
  cast/change/withdraw, mirroring tag-score maintenance.
- **package/contract**: poll DTOs and request schemas (create poll, cast vote,
  tally response with conditional identity fields).
- **package/api**: client hooks for poll read/write with query invalidation.
- **package/app**: poll rendering is out of scope for this change except where
  the contract requires it; UI work is a follow-up.
- **Backward compatibility**: purely additive — new enum value, new tables, new
  endpoints. No existing rows or routes change. New migration required.
