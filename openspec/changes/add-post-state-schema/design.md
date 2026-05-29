## Context

The platform classifies "what a post is" with tags, not a fixed enum. The
existing precedent is `OFFICIAL_QUESTION_TAG_SLUG`: a reserved tag slug carrying
special semantics, with `isQuestionThread()` deriving Q&A behavior from the root
post bearing that tag. There is no lifecycle/state concept yet; Q&A "answered" is
derived from the presence of an `ACCEPTED_ANSWER` `PostPin`.

We want posts to carry a lifecycle without a hard `kind` enum for genre — that
would be the one subsystem not tag-driven, and could not grow new genres (todo,
RFC) without a migration. Existing denormalization precedents (`Post.replyCount`,
`Post.lastReplyAt`, `Post.rootTargetUnitType`) justify caching hot-path facts on
`Post`.

The design was settled by reverse-engineering the products that have lived with
this problem longest. Their lessons drive the decisions below:

- **Jira** — `status` + `resolution` are two fields; `resolution` exists "to
  remove the need to have multiple statuses to state why." But its #1 data-rot
  bug is "Done status, empty resolution" → silently counts as Unresolved → every
  report breaks. Lesson: if you allow a reasonless close, you breed that rot.
- **Linear** — single `status` axis; `completed`/`canceled` are *values* mapped
  to a small fixed set of **category types** that features (velocity, cycles)
  reason on, while the status *name* is free. Lesson: closed meaning, open label;
  don't multiply the categories speculatively.
- **GitHub** — refused a separate "solved" state and added `state_reason`
  instead; later adding `duplicate` to that enum **broke clients** that validated
  a closed set. Lesson: reads must tolerate unknown values.
- **Discourse** (closest to rezics) — `solved` / `closed` / `archived` are
  independent; "a topic closed before being marked solved is not reopened when
  marked solved." Lesson: these are orthogonal axes; `solved` is the right word.

## Goals / Non-Goals

**Goals:**

- A generic, behaviorally-inert `Post.state` lifecycle label — a single axis,
  kebab-slug valued — whose vocabulary and rendering are decided by a schema
  keyed on the post's classifying tag.
- Each value resolves to a **tag** for rendering (name/i18n/color/icon),
  inheriting the codebase's most mature presentation surface; absent tag → render
  the slug.
- A minimal machine layer: each value declares a **bucket** (`active`/`closed`)
  used only for derived listing filters.
- Keep hard behavior (reply permission, feed visibility) on backend-owned
  closed-domain fields, never on `state`.
- Filter "unsolved questions" off `state` without an extra index or anti-join.

**Non-Goals:**

- A second outcome/resolution field — single axis only (see D1).
- Per-realm custom *schemas* (a `TagStateSchema` table) — deferred; per-realm
  *rendering* already comes free via value→tag mapping.
- `started` / `backlog` / `canceled` values — recorded as upgrade paths (D8).
- Assignees, milestones, labels-beyond-tags for issues — out of scope.
- New `UnitType` or `UnitStatus` values.

## Decisions

### D1: `Post.state` is a single generic nullable slug, not an enum, not two fields

`Post.state: String?`, always a kebab-case slug. A hard enum would be
inconsistent with the tag-driven system and require a migration per new genre.
We deliberately keep **one axis** (Linear's model), not a Jira-style
`status`+`resolution` pair: the verdict is expressed as richer `state` *values*,
and the one case that seems to need two facts at once — "solved but still open
for discussion" — is covered by the orthogonal `isLocked` (D5). Null means "no
lifecycle" — the default for every existing and non-stateful post.

Trade-off accepted: validation moves from the DB (enum domain) to the service
(schema lookup). The win is extensibility — new genres and values arrive as
registry data, not migrations.

### D2: Classification stays a tag; the governing schema is snapshotted

"This is a question / issue / todo" remains a tag, consistent with the whole
system. `Post.extra.stateSchemaTag` snapshots the slug of the tag whose schema
governs `state`, captured at creation. It does NOT drift when tags are later
added/removed — otherwise a post's `state` could silently become orphaned under
a different vocabulary. Re-pointing it is an explicit migration. The service
constrains a post to **at most one stateful tag**, so the governing schema is
unambiguous. `extra` (JSON) is the right home: the snapshot resolves which schema
to render, not a hot filter.

### D3: The registry maps tag slug → schema; values are slugs that resolve to tags

A code registry maps official tag slug → schema `{ initial, values[],
transitions[] }`. Each entry in `values[]` is `{ slug, bucket }`, where:

- `slug` is the machine identity (a kebab-case slug, closed vocabulary).
- `bucket` is `active` or `closed` (D7).
- **Rendering**: the value resolves to a tag *by slug* — by default the value
  slug IS the tag slug; a schema MAY override the tag slug. The tag
  (`Unit(type=TAG)`) supplies the localized name (`UnitTranslation`,
  `isLanguageNeutral`), color/icon (`extra`), and per-realm customization. If no
  tag exists for the slug, the client renders the raw slug. Mapped tags use
  reserved/official slugs (alongside `SEED_TAG_SLUGS`); they need not be seeded
  (lazy — fallback covers absence).

There are **no behavior flags** on values. This change ships only:

- **question**: `open`(active) · `solved`(closed) · `not-planned`(closed) ·
  `duplicate`(closed) · `off-topic`(closed); initial `open`.
- **issue**: `open`(active) · `completed`(closed) · `not-planned`(closed) ·
  `duplicate`(closed); initial `open`.

The registry is the generalization of the existing `OFFICIAL_QUESTION_TAG_SLUG`
constant.

### D4: Hard gates never read `state` (the central principle)

Reply permission and feed visibility are hard gates and MUST depend only on
backend-owned, closed-domain fields:

- **reply permission** → `Post.isLocked` (existing boolean).
- **feed visibility / read-only** → `Unit.status` (existing enum; `ARCHIVED`,
  `DELETED`).

`Post.state` MUST NOT gate any behavior. Rationale: `state` is destined to be
user-customizable (per-realm rendering today, schemas later); letting
user-influenced data control authorization is a security and correctness hazard.
This is why values carry no behavior flags (D3) and why closing does not
auto-lock (D5).

### D5: Closing does not auto-lock; lock is a separate, explicit action

Closing a post sets a closed-bucket `state` value only. Locking replies is a
separate write to `isLocked`. The UI offers a combined "close and lock"
affordance, but the two remain decoupled. `state.bucket`, `isLocked`, and
`Unit.status` are three freely combinable orthogonal axes (e.g. "solved but open
for discussion" = `solved` + `isLocked=false`).

### D6: `solved` is a cache of the accepted-answer pin, stored in `state`

For the question schema, `solved` lives in `Post.state` as a cache of the
`ACCEPTED_ANSWER` pin fact, maintained on accept/unaccept. This lets "unsolved
questions" filter off the existing `state` column (`bucket = active`, i.e.
`state = open`) instead of an anti-join against `PostPin`, saving an index
(precedent: `replyCount`/`lastReplyAt`). The `ACCEPTED_ANSWER` `PostPin` remains
the **source of truth**; `state` is its shadow. We use **`solved`** (Discourse's
term) rather than `answered`: it covers resolution by means other than a literal
answer, and cleanly separates the fact layer (the pin: "this reply is the
accepted answer") from the lifecycle layer (`state = solved`: "this question is
solved").

Transition rules:

- Accept an answer: if `state == open` → set `state = solved`.
- Unaccept the last accepted answer: if `state == solved` → set `state = open`.
- If the author has manually set a closed reason (e.g. `duplicate`, `off-topic`,
  `not-planned`), accept/unaccept does NOT overwrite it (the pin is still
  recorded; the manual terminal value wins).

Because `solved` and the other closed reasons are distinct *values* (not a single
overloaded `closed`), there is no "solved vs closed" conflict: a question that is
solved and one closed as a duplicate are simply different values, and continued
discussion after solving is expressed by leaving `isLocked` false.

### D7: `active` / `closed` are derived filter buckets, not stored values

Each value declares a `bucket`. `active` = `{ open }` (plus future `started`,
`backlog`); `closed` = `{ solved, completed, not-planned, duplicate, off-topic }`
(plus future `canceled`). Buckets are **never stored** — they are computed
groupings used only for listing filters: "in progress" = `state IN (active
slugs)`, "concluded" = `state IN (closed slugs)`. The bucket sets are static
constants and `state` is indexed, so this is a cheap IN-list, no anti-join.

`bucket` is intentionally **binary**. It is the minimal machine layer — the only
question the system asks of `state` today is "is this concluded?". We do NOT
build out Linear's five category types speculatively; richer buckets are added
only when a second consumer (analytics, cross-value rollups) actually arrives.
The bucket is decoupled from `isLocked` (a `closed`-bucket post may still accept
replies) and from `Unit.status` (visibility).

### D8: Closing requires a reason; no bare `closed` value

There is no bare `closed` value. The "close" affordance is a verb that always
writes a reason value (`not-planned` / `duplicate` / `off-topic`, or the positive
`solved` / `completed`). This avoids Jira's #1 data-rot bug ("closed with empty
resolution → silently Unresolved") and matches community norms (Stack Overflow
always attaches a close reason). The former "just close it, no statement" case is
expressed honestly as `not-planned` or `off-topic`. Reopen is a `<closed value> →
open` transition declared in the schema.

### D9: Read lenient / write strict

The read contract types `state` as an arbitrary **string** (not a strict enum):
the client renders any value via tag-or-slug, so adding a value never breaks an
old client (GitHub's `duplicate` breakage is thereby avoided). The closed
vocabulary and the allowed transitions are enforced **only on the write path**,
server-side, against the schema. "Labels open, writes closed."

### D10: Upgrade paths — values and per-realm schemas

- **More lifecycle values**: `started`/`backlog` (`active`) and `canceled`
  (`closed`, paired with `started`: "started → canceled" vs "started →
  completed") are future registry rows — a single entry plus an optional tag, no
  migration, no core change. They are not shipped now because the current genres
  do not use them (no in-progress/triage workflow yet).
- **Per-realm custom schemas**: a future `TagStateSchema(tagUnitId, schema Json)`
  table would override the code defaults per realm. Deferred. Note value→tag
  mapping already gives per-realm *rendering* customization (name, color, icon,
  translations) for free; the deferred table is only for custom
  *values/transitions*, which is effectively a workflow engine and must not be
  conflated with this change.

## Risks / Trade-offs

- **`state` used as a gate by mistake** → Enforce D4 in review and tests: a
  closed post with `isLocked = false` still accepts replies; locking is
  independent.
- **`solved` cache drift** → All accept/unaccept paths funnel through one service
  method that maintains the cache; the pin remains source of truth so the cache
  can be rebuilt. Test accept→solved, unaccept→open, and
  manual-closed-not-overwritten.
- **Strict read schema breaks clients on new values** → D9: the read DTO types
  `state` as a string and never enum-validates on read.
- **Multiple stateful tags on one post** → Service rejects a second stateful tag;
  `stateSchemaTag` snapshot is set once at creation.
- **Orphaned `state` after tag changes** → `stateSchemaTag` does not drift;
  changing genre is an explicit migration.
- **Illegal values / transitions on write** → Service validates writes against
  the schema's values and transitions; clients cannot write arbitrary `state`.
- **Slug/normalization drift** → Values are stored normalized (lowercase, `-`
  separated) to match the slug namespace and guarantee tag lookup hits.

## Migration Plan

1. Add `Post.state String?` (nullable) and index it for bucket filtering;
   document `extra.stateSchemaTag`. Additive migration.
2. Add the code schema registry with `question` and `issue` defaults (built on
   `OFFICIAL_QUESTION_TAG_SLUG`; add the official issue tag slug constant).
3. Service: snapshot `stateSchemaTag` at creation, enforce one-stateful-tag,
   validate transitions (write-strict), maintain the `solved` cache on
   accept/unaccept.
4. Contract: expose `state` (string, read-lenient), `extra.stateSchemaTag`, and
   the schema shape (values, buckets, transitions, per-value tag slug).
5. No backfill — all existing posts keep `state = null`. Rollback drops the
   column/index; no existing behavior depends on `state`.

## Open Questions

- None blocking. (Single-axis, no-bare-closed, `solved` naming, derived buckets,
  read-lenient/write-strict, and the `started`/`backlog`/`canceled` upgrade paths
  are settled as Decisions above.)
</content>
