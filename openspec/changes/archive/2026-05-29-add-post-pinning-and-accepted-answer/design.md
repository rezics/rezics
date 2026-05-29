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
- **Realm-feed-level featuring of whole units** — that is `Realm.extra.pinboard`'s
  job (see the boundary below). `PostPin` is strictly an *in-thread* overlay.
- Per-realm voting on accepted answers.

### Boundary: `PostPin` vs `Realm.extra.pinboard`

These two mechanisms never overlap; the split is by **object** and **surface**,
not by scope:

| | `PostPin` | `Realm.extra.pinboard` |
|---|---|---|
| Object | a **reply** (`depth ≥ 1`) | a **top-level unit** (root post / work / shelf) |
| Surface | inside the thread, reorders siblings | the realm landing page, a curated strip above the feed |
| Scope | always the thread **root post** | always the **realm** |
| Storage | relational overlay (this change) | ordered ID list on `Realm.extra` (unchanged) |

Litmus test for any future code/spec: **"Am I featuring a destination, or
promoting a reply?"** Featuring a whole unit on the realm landing → `pinboard`.
Promoting a reply within a thread → `PostPin`. The "moderator wants a whole
thread at the top of the realm" use case is `pinboard` (a thread root is a
top-level unit), **not** a realm-scoped `PostPin`.

## Decisions

### D1: Overlay table over columns on `Post`
Promotion lives in a `PostPin(scopeUnitId, postUnitId, kind, position,
byUserId, createdAt)` table, `@@id([scopeUnitId, postUnitId])`. **Why over
`Post.pinKind`/`Post.pinRank` columns:** promotion is sparse (most posts are
never pinned) and carries its own metadata (`kind`, `byUserId`, `createdAt`,
`position`) that does not belong on every post row; the overlay keeps promotion
decoupled from post content/`path` and mirrors `RealmTagApplication`, so the
read/write idiom is familiar. **Trade-off:** one extra join at render; trivial
given low cardinality.

### D2: `scopeUnitId` is always the thread root post
Every `PostPin` uses `scopeUnitId = rootPostUnitId` — the thread is the scope
for both accepted answers and pins. **Realm is never a scope.** Promoting a
whole unit to the realm landing is `Realm.extra.pinboard`'s job (see the
Boundary above); collapsing the earlier "realm cross-thread pin" idea into
`pinboard` removes the only source of render-time scope ambiguity. The target
of every `PostPin` is a **reply** (`depth ≥ 1`, `rootPostUnitId == scopeUnitId`),
never a thread root and never a realm member at large. A single
`@@index([scopeUnitId, kind, position])` serves all render-time grouping.

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

- **Authorization drift between accept and pin** → Centralize a single
  capability check in `PostService` (OP-of-thread, realm moderator/owner) used
  by both accept and pin endpoints; cover with tests.
- **Accepted-answer gating bypass** → Enforce `depth == 1`,
  `parentPostUnitId == rootPostUnitId`, and "root bears question tag" server-
  side at write time, not only in the UI.
- **Pin to a post outside the scope thread** → Validate at write time that the
  target is a reply (`depth ≥ 1`) and `target.rootPostUnitId == scopeUnitId`.
  There is no realm scope, so there is no cross-scope merge at render.
- **Multiple accepted answers UX** → Allowed by data model; the renderer orders
  them by `position` and the UI must handle N badges, not assume one.

## Migration Plan

0. Precondition: `redesign-post-index-ltree` has landed and its manual
   `ltree` migration has passed drift verification. This change consumes the
   resulting `path`/`rootPostUnitId` retrieval shape; it does not manage the
   `ltree` extension or raw GiST index.
1. Ordinary additive Prisma schema migration: add `PinKind` enum and `PostPin`
   table with the PK and `(scopeUnitId, kind, position)` index. Additive; no
   backfill.
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
