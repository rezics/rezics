## Why

Posts need a lifecycle (a question is open or solved; an issue is open or
completed/declined) but the platform already classifies "what a post is" with
tags, not with a fixed `kind` enum — the official question tag
(`OFFICIAL_QUESTION_TAG_SLUG`) is the existing precedent for "a reserved tag slug
carrying special semantics." A post that owns a lifecycle is, by definition, that
genre (question / issue / …); making lifecycle a hard enum would be the one
subsystem that is *not* tag-driven, inconsistent with everything around it and
unable to grow new genres without a migration.

Surveying the products that have lived with this longest converges on a clear
shape (Jira `status`/`resolution`, GitHub `state`/`state_reason`, Linear typed
statuses, Discourse `solved`/`closed`/`archived`):

- A bare `closed` is ambiguous — it cannot say *merged vs. won't-do vs. answered
  elsewhere*. Mature systems attach a **reason** to every close.
- Free-form status **labels** destroy machine reasoning (Jira's "status
  explosion": 50+ statuses, half meaning the same). The fix is **closed-meaning,
  open-label**: the system reasons on a small fixed vocabulary; the display name
  is decorative and customizable.
- Linear is **single-axis**: `completed` / `canceled` are *values of status*, not
  a second field. Combined with `isLocked` (already orthogonal), one axis covers
  every real case ("solved but still discussing" = solved + unlocked), so we do
  **not** introduce a separate outcome/resolution field.

The right shape is a **single generic `state` field whose legal values are a
small closed vocabulary decided by a schema keyed on the post's classifying tag,
where each value is a kebab-case slug that resolves to a tag for rendering**,
generalizing the question-tag precedent and reusing the most mature
rendering/i18n surface in the codebase (tags).

## What Changes

- Add a nullable, behaviorally-inert `Post.state: String` — a single-axis
  lifecycle label, always a **kebab-case slug** (matching the repo convention,
  e.g. `cc-by-nc-sa-4.0`). Add `Post.extra.stateSchemaTag`, snapshotting the
  governing tag slug at creation (does not drift; one stateful tag per post).
- Add a **state-schema registry** in code, keyed by official tag slug:
  `{ initial, values, transitions }`, where each value carries a `bucket`
  (`active` | `closed`) and resolves to a tag for rendering (value slug = tag
  slug by default; missing tag → render the raw slug). Ships two schemas:
  - **question** → `open`(active) · `solved` · `not-planned` · `duplicate` ·
    `off-topic` (closed); initial `open`. `solved` caches the existing
    `ACCEPTED_ANSWER` pin (pin stays source of truth) so "unsolved" filters off
    `state`, no anti-join.
  - **issue** → `open`(active) · `completed` · `not-planned` · `duplicate`
    (closed); initial `open`.
- **No bare `closed`**: closing always writes a reason value (the "close"
  affordance is a verb); reopen is a `<closed> → open` transition.
- **`active`/`closed` are derived filter buckets**, never stored — listings match
  the values' bucket slug sets (`state IN (…)`, indexed). Bucket, `isLocked`, and
  `Unit.status` are three orthogonal axes.
- **Read lenient / write strict**: reads type `state` as a plain string (rendered
  via tag-or-slug) so new values never break clients; the closed vocabulary and
  transitions are enforced only on the write path.
- **Hard rule** (design): reply permission and feed visibility depend ONLY on
  `Post.isLocked` / `Unit.status`, never on `Post.state`. Closing does not
  auto-lock; "close and lock" is a separate affordance.
- **Upgrade paths, not built now**: `started`/`backlog`/`canceled` are future
  registry rows (zero migration); per-realm custom *schemas* stay deferred —
  value→tag mapping already gives per-realm *rendering* for free.

## Capabilities

### New Capabilities

- `post-state-schema`: the generic `Post.state` slug field, the
  `extra.stateSchemaTag` snapshot and one-stateful-tag constraint, the
  tag-slug-keyed schema registry (values, buckets, transitions, value→tag
  rendering with slug fallback), the official `question` and `issue` schemas, the
  `active`/`closed` derived buckets, read-lenient/write-strict validation, and
  the hard rule that backend gates never read `state`.

### Modified Capabilities

- `type-extension-post`: `Post` gains a nullable `state` slug field and an
  `extra.stateSchemaTag` key; clarifies that lifecycle is tag-schema driven,
  slug-valued, behaviorally inert, and that each value resolves to a tag for
  rendering.
- `official-question-tag`: the question schema defines
  `open`/`solved`/`not-planned`/`duplicate`/`off-topic` and specifies that
  accepting/unaccepting an answer maintains the `solved` cache in `Post.state`,
  with the `ACCEPTED_ANSWER` pin remaining the source of truth.

## Impact

- **package/server**: Prisma migration adding `Post.state` (nullable string,
  indexed for bucket filtering); a state-schema registry module; service
  enforcement of the one-stateful-tag constraint, transition validation, and the
  `state` snapshot at creation; accept/unaccept answer maintains the `solved`
  cache (mirroring existing `replyCount`/`lastReplyAt` denormalization). The
  official issue tag slug is added alongside `SEED_TAG_SLUGS`.
- **package/contract**: `PostDTO` gains `state` (typed as a string, **not** a
  strict enum, so reads never reject unknown values); `extra` documents
  `stateSchemaTag`; the state-schema shape (values, buckets, transitions, the
  rendering tag slug per value) is exposed so the client can render without
  re-deriving.
- **package/api**: read of post state + schema; mutation for state transitions
  (gated by schema transitions) with thread/post query invalidation; bucket
  filtering for listings.
- **package/app**: state badge rendering (resolve value slug → tag → name/color,
  fallback to slug) and "close and lock" affordance are follow-up UI work; only
  contract surface is in scope here.
- **Backward compatibility**: additive — `state` is nullable and defaults to
  null (no lifecycle) for all existing posts. No behavior changes for posts
  without a stateful tag. New migration required; no breaking changes.
</content>
</invoke>
