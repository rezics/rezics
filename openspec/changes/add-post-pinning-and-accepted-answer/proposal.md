## Why

Threads have no way to promote a reply: a moderator cannot pin an important
comment, and a question asker cannot mark a reply as the accepted answer.
The post tree (after `redesign-post-index-ltree`) orders siblings by a
DB-expressible key but has no overlay for "this reply jumps to the top, and
here is why". We want one generic promotion mechanism that carries a
descriptive `kind`, so the tree renderer can show *why* a post is promoted
(accepted answer vs. moderator pin), and we want a Q&A layer built on top of it
keyed off a platform-reserved "question" tag.

## What Changes

- **New `PostPin` overlay table** (mirrors the `pinned`/`position` shape
  already used by `RealmTagApplication`, `UnitTag`, `ShelfUnit`): a promotion
  of a post within a scope, carrying a descriptive `kind` and a fractional
  `position`.
  - Fields: `scopeUnitId`, `postUnitId`, `kind`, `position`, `byUserId`,
    `createdAt`.
  - `@@id([scopeUnitId, postUnitId])` — a post is promoted at most once per
    scope.
  - `@@index([scopeUnitId, kind, position])` — render-time grouping/ordering.
  - **Scope is always the thread root post**; the target is always a **reply**
    (`depth ≥ 1`, `rootPostUnitId == scopeUnitId`). A realm is never a scope —
    realm-level featuring of whole units is `Realm.extra.pinboard`'s job.
- **`PinKind` enum**: `ACCEPTED_ANSWER`, `PINNED` (with `HIGHLIGHT` reserved).
- **`position` uses fractional indexing**, consistent with existing `position`
  columns; pin cardinality per scope is low, so there is no key-growth or
  rebalancing concern.
- **Official question tag**: a platform-reserved tag slug (a `Unit(type=TAG)`
  whose slug is reserved). A root post carrying that tag makes its thread a
  Q&A thread.
- **Accepted answer** = a `PostPin` with `kind = ACCEPTED_ANSWER` whose target
  post satisfies `depth == 1` and `parentPostUnitId == rootPostUnitId`. A
  question MAY have multiple accepted answers, ordered by `position`.
- **Authorization**:
  - `ACCEPTED_ANSWER`: the thread author (OP) OR a realm moderator/owner.
  - `PINNED`: a realm moderator/owner within any thread of their realm; OR the
    OP within their own thread.
- **Render (School B)**: load the subtree, join `PostPin` for the relevant
  scope(s), group by parent; within each sibling group order is
  `[ACCEPTED_ANSWER group, then PINNED group, each by position]` ++
  `[ordinary replies by the chosen sort]`. Promoted nodes carry their
  `pinKind` so the UI shows a badge (✓ accepted / 📌 pinned).
- **API**: endpoints to accept/unaccept an answer and to pin/unpin a post,
  with the authorization and Q&A gating above.

## Capabilities

### New Capabilities
- `post-pinning`: the generic promotion overlay — `PostPin` model, `PinKind`,
  fractional `position`, scope semantics (always the thread root post; target
  always a reply; realm is never a scope), the `@@id`/index shape, pin/unpin
  API, `PINNED` authorization, and the render-time grouping/ordering + badge
  contract.
- `official-question-tag`: the platform-reserved question tag slug, the rule
  that a root post bearing it makes a thread a Q&A thread, the
  `ACCEPTED_ANSWER` specialization (target `depth == 1` and
  `parentPostUnitId == rootPostUnitId`, multiple allowed, ordered by
  `position`), the accept/unaccept authorization (OP or moderator/owner), and
  the accepted-answer rendering precedence.

### Modified Capabilities
- `work-discussion`: the threaded reply view gains a promotion overlay —
  sibling groups render accepted answers and pins ahead of ordinary replies
  with their `pinKind` badge, layered on the existing DB-ordered base.

## Impact

- **Depends on** `redesign-post-index-ltree` (School-B ordering seam and the
  `path`/`rootPostUnitId` retrieval shape).
- **package/server**: `prisma/schema.prisma` (`PostPin` model, `PinKind`
  enum, indexes), migration, `src/post/post.service.ts` (accept/pin/unpin,
  Q&A tag detection, authorization gating, render-join), `post.api.ts` (new
  routes), `post.mapper.ts`/`types.ts`, tests.
- **package/contract**: `src/post.ts` — `PostPinDTO`, `PinKind`, pin-state on
  `PostDTO` (e.g. `pinKind`), and the reserved question-tag slug constant.
- **package/app**: `src/post/models/postTreeRails.ts` and thread views — apply
  the pin grouping/ordering and render `pinKind` badges; accept/pin affordances
  gated by viewer capability.
- **i18n**: badge/affordance copy keys for accepted answer and pinned states.
- **Backward compatibility:** additive — no existing posts change; threads
  without pins render exactly as before. Clean cutover for any new contract
  fields per AGENTS.md.
