## Why

Pinning and accepting answers already work end to end — storage, server-side
authorization, and rendering (promotion badges + sibling ordering) all ship and
are tested. But a moderator or thread author has no way to *trigger* those
actions from the thread itself; the `renderOverflowContent` seam on
`PostTreeNode` / `PostReply` was built for exactly these buttons and left
unwired because the post feature does not load the three signals a button needs:
the viewer's session, the viewer's promotion authority in the thread's realm,
and whether the thread is a question thread. This change wires those buttons.

## What Changes

- Expose two **read-only, viewer-derived** signals on the thread read response so
  the client can gate controls without re-implementing authorization:
  - `viewerCanPromote` — whether the current caller may pin/accept within this
    thread, computed by reusing the existing `assertCanPromoteInThread` predicate
    (OP, realm moderator/owner, or platform admin).
  - `isQuestionThread` — whether the thread root bears the official question tag,
    reusing the existing `isQuestionThread()` service check (gates accept-answer).
- Add interactive in-thread promotion controls, injected through the existing
  `renderOverflowContent` seam (`PostTreeNode → PostReply → ReactionBar`
  overflow menu):
  - **Pin / Unpin** a reply — shown when `viewerCanPromote` is true.
  - **Accept / Unaccept answer** — shown when `viewerCanPromote` is true *and*
    `isQuestionThread` is true *and* the reply is a direct (`depth === 1`) child
    of the thread root, mirroring the server's accept rules.
  - Controls reflect current state (a pinned reply offers Unpin; an accepted
    answer offers Unaccept) and call the existing `POST/DELETE /pins` and
    `POST/DELETE /accepted-answers` endpoints, then invalidate the thread query.
- No new authorization rules: the server gate remains the single source of
  truth; the client controls are an affordance that mirrors it and degrades
  gracefully if a stale 403 is returned.

## Capabilities

### New Capabilities

- `post-promotion-controls`: interactive in-thread pin/unpin and
  accept/unaccept controls — their visibility gating, the actions they invoke,
  optimistic state + thread re-query, and the overflow-seam injection point.

### Modified Capabilities

- `post-pinning`: the thread read response gains viewer-derived `viewerCanPromote`
  and `isQuestionThread` signals, derived from the existing authorization gate and
  question-tag check, so clients can present promotion controls without
  duplicating authorization logic.

## Impact

- **package/contract** (`post.ts`): add `viewerCanPromote` and `isQuestionThread`
  to the thread read response type (thread root / thread payload, not every
  `PostDTO` row). Backward compatible — additive optional fields.
- **package/server** (`post.service.ts`, `post.mapper.ts`, `post.api.ts`): refactor
  `assertCanPromoteInThread` to expose a boolean predicate reused by both the
  guard and the read path; populate the two derived fields on thread read. No
  schema/migration changes; no change to authorization behavior.
- **package/api**: thread query hook + mutation hooks for pin/unpin/accept/unaccept
  with thread-query invalidation (reuse existing endpoints in `@rezics/api`).
- **package/app** (`post/`): a controls component wired through
  `renderOverflowContent` in `PostTreeSection`, consuming `useCurrentUserId` /
  thread-level capability signals. UI follows `rezics-design`.
- No breaking changes; no data migration.
