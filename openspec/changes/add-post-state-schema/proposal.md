## Why

Posts need a lifecycle status (a question is open or answered; an issue is open
or closed) but the platform already classifies "what a post is" with tags, not
with a fixed `kind` enum — the official question tag (`OFFICIAL_QUESTION_TAG_SLUG`)
is the existing precedent for "a reserved tag slug carrying special semantics."
A post that owns a lifecycle is, by definition, that genre (issue / question /
todo); making lifecycle a hard enum would be the one subsystem that is *not*
tag-driven, inconsistent with everything around it and unable to grow new
genres without a migration. The right shape is a **generic `state` field whose
legal values and rendering are decided by a schema keyed on the post's
classifying tag**, generalizing the question-tag precedent.

## What Changes

- Add a generic, nullable `Post.state: String` lifecycle field. It is a **soft,
  presentation-only label** — schema-driven, eventually realm-customizable, and
  it carries **no backend behavior**.
- Add `Post.extra.stateSchemaTag` — a snapshot of the tag slug whose schema
  governs this post's `state`. Captured at creation; it does **not** drift when
  tags are later added/removed (changing it is an explicit migration). The
  service constrains a post to **at most one stateful tag**.
- Introduce a **state-schema registry** in code, keyed by official tag slug,
  defining each schema's legal states, initial state, allowed transitions, and
  rendering. This change ships only the official defaults:
  - **question** → `open` / `answered` / `closed`. `answered` is a **cache** of
    the existing `ACCEPTED_ANSWER` pin fact, stored in `state` and updated when
    an author accepts/unaccepts an answer (so "unanswered questions" filters off
    `state` instead of an anti-join, saving an index). The pin remains the
    source of truth.
  - **issue** → `open` / `closed`, with a close reason following mature issue
    design (`COMPLETED` / `NOT_PLANNED` / `DUPLICATE`).
- Establish the **hard rule** (in design): hard gates — reply permission and
  feed visibility — depend ONLY on backend-owned, closed-domain fields
  (`Post.isLocked`, `Unit.status`), never on `Post.state`. Because `state` will
  become user-customizable, user data must never control authorization or
  behavior. Closing a post does NOT auto-lock replies; the UI offers a separate
  "close and lock" affordance. `answered` / `isLocked` / `closed` are three
  freely combinable orthogonal axes.
- Per-realm custom schema override (a `TagStateSchema` table) is **explicitly
  deferred**; recorded only as an upgrade path in design.

## Capabilities

### New Capabilities

- `post-state-schema`: the generic `Post.state` field, the
  `extra.stateSchemaTag` snapshot and one-stateful-tag constraint, the
  tag-slug-keyed schema registry (legal values, transitions, rendering), the
  official `question` and `issue` schemas, and the hard rule that backend gates
  never read `state`.

### Modified Capabilities

- `type-extension-post`: `Post` gains a nullable `state` field and an
  `extra.stateSchemaTag` key; clarifies that lifecycle status is tag-schema
  driven and behaviorally inert.
- `official-question-tag`: the question schema defines `open`/`answered`/`closed`
  and specifies that accepting/unaccepting an answer maintains the `answered`
  cache in `Post.state`, with the `ACCEPTED_ANSWER` pin remaining the source of
  truth.

## Impact

- **package/server**: Prisma migration adding `Post.state` (nullable string,
  indexed for lifecycle filtering); a state-schema registry module; service
  enforcement of the one-stateful-tag constraint, transition validation, and the
  `state` snapshot at creation; accept/unaccept answer updates the `answered`
  cache (mirroring existing `replyCount`/`lastReplyAt` denormalization).
- **package/contract**: `PostDTO` gains `state`; `extra` documents
  `stateSchemaTag`; the state-schema shape (states, transitions, rendering hints)
  is exposed so the client can render without re-deriving.
- **package/api**: read of post state + schema; mutation for state transitions
  (gated by schema transitions) with thread/post query invalidation.
- **package/app**: state badge rendering and "close and lock" affordance are
  follow-up UI work; only contract surface is in scope here.
- **Backward compatibility**: additive — `state` is nullable and defaults to
  null (no lifecycle) for all existing posts. No behavior changes for posts
  without a stateful tag. New migration required; no breaking changes.
