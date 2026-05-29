## Context

The platform classifies "what a post is" with tags, not a fixed enum. The
existing precedent is `OFFICIAL_QUESTION_TAG_SLUG`: a reserved tag slug carrying
special semantics, with `isQuestionThread()` deriving Q&A behavior from the root
post bearing that tag. There is no lifecycle/state concept yet; Q&A "answered"
is derived from the presence of an `ACCEPTED_ANSWER` `PostPin`.

We want posts to carry a lifecycle (question: open/answered/closed; issue:
open/closed) without introducing a hard `kind` enum for genre — that would be
the one subsystem not tag-driven, and could not grow new genres (todo, RFC)
without a migration. Existing denormalization precedents (`Post.replyCount`,
`Post.lastReplyAt`, `Post.rootTargetUnitType`) justify caching hot-path facts on
`Post`.

## Goals / Non-Goals

**Goals:**

- A generic, behaviorally-inert `Post.state` lifecycle label whose vocabulary
  and rendering are decided by a schema keyed on the post's classifying tag.
- Generalize the question-tag precedent to a tag-slug-keyed schema registry,
  shipping official `question` and `issue` schemas.
- Keep hard behavior (reply permission, feed visibility) on backend-owned
  closed-domain fields, never on `state`.
- Filter "unanswered questions" off `state` without an extra index or anti-join.

**Non-Goals:**

- Per-realm custom schema override (a `TagStateSchema` table) — deferred; only an
  upgrade path here.
- State badge UI, "close and lock" affordance UI — follow-up.
- Assignees, milestones, labels-beyond-tags for issues — out of scope.
- New `UnitType` or `UnitStatus` values.

## Decisions

### D1: `Post.state` is a generic nullable string, not an enum

`Post.state: String?`. A hard enum would be inconsistent with the tag-driven
system and would require a migration per new genre. The string's legal values
are constrained by the schema (in the service), not by the database. Null means
"no lifecycle" — the default for every existing and non-stateful post.

Trade-off accepted: validation moves from the DB (enum domain) to the service
(schema lookup). The win is extensibility — new genres and, later, per-realm
workflows arrive as data, not migrations.

### D2: Classification stays a tag; the governing schema is snapshotted

"This is a question / issue / todo" remains a tag (`question`, `issue`, ...),
consistent with the whole system. `Post.extra.stateSchemaTag` snapshots the slug
of the tag whose schema governs `state`, captured at creation. It does NOT drift
when tags are later added/removed — otherwise a post's `state` value could
silently become orphaned under a different vocabulary. Re-pointing it is an
explicit migration. The service constrains a post to **at most one stateful
tag**, so the governing schema is unambiguous.

`extra` (JSON) is the right home: the snapshot is used to resolve which schema to
render, not as a hot filter. Classification filtering (e.g. a realm's question
zone) still goes through the tag system, consistent with everything else.

### D3: The schema registry lives in code, keyed by official tag slug

A registry maps official tag slug → schema `{ initial, states[], transitions[]
}`, where each state carries rendering hints (label, tone/color) but **no
behavior flags**. This change ships only:

- **question**: states `open` / `answered` / `closed`; initial `open`.
- **issue**: states `open` / `closed`; initial `open`; plus a close reason
  (`COMPLETED` / `NOT_PLANNED` / `DUPLICATE`) following GitHub's model.

The registry is the generalization of the existing `OFFICIAL_QUESTION_TAG_SLUG`
constant.

### D4: Hard gates never read `state` (the central principle)

Reply permission and feed visibility are hard gates and MUST depend only on
backend-owned, closed-domain fields:

- **reply permission** → `Post.isLocked` (existing boolean).
- **feed visibility / read-only** → `Unit.status` (existing enum; `ARCHIVED`,
  `DELETED`).

`Post.state` MUST NOT gate any behavior. Rationale: `state` is destined to be
user-customizable (per-realm schemas); letting user-supplied data control
authorization or reply permission is a security and correctness hazard. This is
why `state` carries no behavior flags (D3) and why closing does not auto-lock
(D5).

### D5: `closed` does not auto-lock; lock is a separate, explicit action

Closing a post sets `state = closed` only. Locking replies is a separate write
to `isLocked`. The UI offers a combined "close and lock" affordance, but the two
remain decoupled — `answered`, `isLocked` (locked), and `closed` are three
freely combinable orthogonal axes (e.g. "answered but open for discussion",
"answered and locked").

### D6: `answered` is a cache of the accepted-answer pin, stored in `state`

For the question schema, `answered` lives in `Post.state` as a cache of the
`ACCEPTED_ANSWER` pin fact, maintained on accept/unaccept. This lets
"unanswered questions" filter off the existing `state` column instead of an
anti-join against `PostPin`, saving an index (precedent: `replyCount`/
`lastReplyAt` are maintained on write). The `ACCEPTED_ANSWER` `PostPin` remains
the **source of truth**; `state` is its shadow.

Transition rules:

- Accept an answer: if `state == open` → set `state = answered`.
- Unaccept the last accepted answer: if `state == answered` → set `state = open`.
- If the author has manually set `state = closed`, accept/unaccept does NOT
  overwrite it (the pin is still recorded; the manual terminal label wins).

Trade-off accepted: folding `answered` into the single `state` column means a
question cannot simultaneously be `closed` AND `answered` as distinct values.
This is acceptable — the Q&A main axis is `open → answered`, `closed` is the
rare side-exit (duplicate/off-topic), and "answered with continued discussion"
is expressed by leaving `isLocked` false.

### D7: Custom per-realm schemas are deferred

A future `TagStateSchema(tagUnitId, schema Json)` table would override the code
defaults per realm. Explicitly out of scope; recorded so the code registry is
structured to be overridable later. Opening custom states/transitions to users
is effectively a workflow engine (permissions, transition guards) and must not
be conflated with this change.

## Risks / Trade-offs

- **`state` used as a gate by mistake** → Enforce D4 in review and tests: a
  closed/answered post with `isLocked = false` still accepts replies; locking is
  independent.
- **answered cache drift** → All accept/unaccept paths funnel through one service
  method that maintains the cache; the pin remains source of truth so the cache
  can be rebuilt. Add a test for accept→answered, unaccept→open, and
  manual-closed-not-overwritten.
- **Multiple stateful tags on one post** → Service rejects applying a second
  stateful tag; `stateSchemaTag` snapshot is set once at creation.
- **Orphaned `state` after tag changes** → `stateSchemaTag` does not drift;
  changing genre is an explicit migration, not a side effect of tagging.
- **String typos / illegal transitions** → Service validates writes against the
  schema's states and transitions; clients cannot write arbitrary `state`.

## Migration Plan

1. Add `Post.state String?` (nullable) and index it for lifecycle filtering;
   document `extra.stateSchemaTag`. Additive migration.
2. Add the code schema registry with `question` and `issue` defaults (built on
   the existing `OFFICIAL_QUESTION_TAG_SLUG`).
3. Service: snapshot `stateSchemaTag` at creation, enforce one-stateful-tag,
   validate transitions, maintain the `answered` cache on accept/unaccept.
4. Contract: expose `state`, `extra.stateSchemaTag`, and the schema shape.
5. No backfill — all existing posts keep `state = null`. Rollback drops the
   column/index; no existing behavior depends on `state`.

## Open Questions

- None blocking. (Default-lock-on-close, answered-cache, snapshot-immutability,
  and one-stateful-tag are settled as Decisions above.)
