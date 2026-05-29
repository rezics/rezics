## Context

After `redesign-post-index-ltree`, a thread is retrieved by `rootPostUnitId`
(whole) or `path <@ anchor.path` (partial), with sibling order produced by a
DB-expressible `ORDER BY` key (School B). There is no mechanism to promote a
reply above its siblings. The codebase already establishes a promotion idiom
on junction tables: `RealmTagApplication`, `UnitTag`, and `ShelfUnit` all carry
a `pinned`/`position` (fractional index) pair. Tags are `Unit(type=TAG)` with
slugs under `slugScope = tag`, applied globally (`UnitTag`) or per realm
(`RealmTagApplication`). There is no Q&A / accepted-answer concept today.

The scaling profile was assessed in exploration: pins are low-cardinality per
scope and low-write, so fractional indexing has no key-growth, collision, or
rebalancing risk here; render-time grouping is over a handful of rows.

## Goals / Non-Goals

**Goals:**
- One generic promotion overlay (`PostPin`) carrying a descriptive `kind`.
- Q&A threads via a platform-reserved question tag, with accepted answers as a
  gated specialization of the overlay.
- Render contract: promoted-first grouping with badges, layered on the
  existing DB-ordered base, without rewriting paths.

**Non-Goals:**
- Changing the tree storage/retrieval (owned by `redesign-post-index-ltree`).
- Score/Wilson `top/best` ranking implementation.
- Realm-feed-level pinning of whole units (already covered by
  `Realm.extra.pinboard`); `PostPin` is for in-thread / scope-level promotion.
- Per-realm voting on accepted answers.

## Decisions

### D1: Overlay table over columns on `Post`
Promotion lives in a `PostPin(scopeUnitId, postUnitId, kind, position,
byUserId, createdAt)` table, `@@id([scopeUnitId, postUnitId])`. **Why over
`Post.pinKind`/`Post.pinRank` columns:** a post can live in multiple realms and
in a thread simultaneously; "promoted in *which* context" is intrinsic to the
relation, not the post. The overlay also mirrors `RealmTagApplication`, so the
read/write idiom is familiar. **Trade-off:** one extra join at render; trivial
given low cardinality.

### D2: `scopeUnitId` is the thread root post OR a realm
Accepted answers and OP/in-thread pins use `scopeUnitId = rootPostUnitId`
(the question/thread is the scope). Moderator cross-thread pins use
`scopeUnitId = realmUnitId`. **Why one polymorphic scope column:** both are
Unit ids and both express "this post is promoted within this scope"; a single
`@@index([scopeUnitId, kind, position])` serves both. The render layer requests
pins for the loaded root scope plus the realm(s) the thread is being viewed in.

### D3: `position` via fractional indexing
`position` is a LexoRank-style string, consistent with `ShelfUnit.position`,
`RealmTagApplication.position`, `UnitTag.position`. **Why fractional over an
integer rank:** consistency with the codebase idiom and O(1) reorder. **Why no
performance concern:** key-growth, midpoint collision, and rebalancing all
scale with high-frequency insertion between fixed neighbors; pins are rare,
low-cardinality actions, so none apply. A `(scopeUnitId, postUnitId)` PK plus
collision-retry (matching existing tables) is sufficient.

### D4: `PinKind` enum with render precedence
`PinKind = ACCEPTED_ANSWER | PINNED` (`HIGHLIGHT` reserved). Render precedence
within a sibling group: `ACCEPTED_ANSWER` group first, then `PINNED` group,
each ordered by `position`, then ordinary replies by the chosen base sort.
**Why a kind rather than a boolean:** the renderer must show *why* a node is
promoted (✓ accepted vs 📌 pinned); kind also encodes the precedence buckets.

### D5: Accepted answer is a gated specialization, not a separate table
An accepted answer is a `PostPin` with `kind = ACCEPTED_ANSWER` and
`scopeUnitId = rootPostUnitId`, allowed only when the root post bears the
platform-reserved question tag and the target satisfies `depth == 1` and
`parentPostUnitId == rootPostUnitId`. Multiple accepted answers are allowed,
ordered by `position`. **Why reuse `PostPin`:** "accept" and "pin" are the same
promotion act with different `kind` + gating, mirroring Discourse-solved which
links answer↔topic in one relation rather than a post boolean.

### D6: Official question tag = reserved slug
A `Unit(type=TAG)` whose slug equals a platform-reserved constant (e.g.
`question`) marks Q&A. **Why reserved-slug over a `Tag.kind` flag or a
per-realm registry:** it is globally uniform and cross-realm consistent, and
the tag-application plumbing (`UnitTag`) already exists; the only addition is a
contract constant and a "root has this tag?" check. **Alternatives:** a
`kind`/flag on the tag unit (more flexible, but adds a tag-model field and an
admin surface); per-realm question-tag designation (realm-scoped semantics,
heavier). Reserved slug is the smallest correct step.

## Risks / Trade-offs

- **Scope ambiguity at render (root vs realm pins)** → The render contract
  fetches `PostPin` for the loaded root scope and explicitly for the realm
  context being viewed; precedence (D4) resolves overlap deterministically.
- **Authorization drift between accept and pin** → Centralize a single
  capability check in `PostService` (OP-of-thread, realm moderator/owner) used
  by both accept and pin endpoints; cover with tests.
- **Accepted-answer gating bypass** → Enforce `depth == 1`,
  `parentPostUnitId == rootPostUnitId`, and "root bears question tag" server-
  side at write time, not only in the UI.
- **Pin to a post in a different thread/realm than the scope** → Validate at
  write time that the target post's `rootPostUnitId == scopeUnitId` (root
  scope) or that the post is in the realm (realm scope).
- **Multiple accepted answers UX** → Allowed by data model; the renderer orders
  them by `position` and the UI must handle N badges, not assume one.

## Migration Plan

1. Schema migration: add `PinKind` enum and `PostPin` table with the PK and
   `(scopeUnitId, kind, position)` index. Additive; no backfill.
2. Seed the reserved question tag (`Unit(type=TAG)`, reserved slug) via the
   factory/seed so environments have it; idempotent reseed.
3. Ship contract (`PostPinDTO`, `PinKind`, reserved slug constant, `pinKind`
   on `PostDTO`), then server endpoints + render-join, then app rendering.
- **Rollback:** drop `PostPin` + enum; additive change, no data dependency in
  existing posts.

## Open Questions

- Exact reserved slug value(s) — single `question`, or a small reserved set
  (e.g. `question`, `help`)? (Default: single `question`.)
- Whether accepting an answer should also bump the answer's score or lock the
  thread (current plan: neither; promotion only).
- Whether realm-scope `PINNED` is in scope for the first implementation or
  deferred, shipping root-scope (OP/mod accept + OP pin) first.
