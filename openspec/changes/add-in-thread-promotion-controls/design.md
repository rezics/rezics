## Context

Pinning and accepted answers are fully implemented except the in-thread trigger UI:

- **Storage**: `PostPin` overlay (`scopeUnitId`, `postUnitId`, `kind`, `position`,
  `byUserId`, `createdAt`); `pinKind` / `pinPosition` flow onto `PostDTO`.
- **Authorization**: `assertCanPromoteInThread()` in
  `package/server/src/post/post.service.ts` (~L1213) is the single write gate for
  both pin and accept (OP / realm moderator-owner / platform admin). Accept adds
  Q&A validation: target `depth === 1` under the root, and `isQuestionThread()`
  (~L1109) verifies the root's official question tag.
- **Endpoints**: `post.api.ts` — `POST /pins`, `DELETE /pins/:scopeUnitId/:postUnitId`,
  `POST /accepted-answers`, `DELETE /accepted-answers/:scopeUnitId/:postUnitId`.
- **Render**: `PostPinBadge` (badges) and `postTreeRails.ts` `promotionRank` /
  `orderSiblingsByPromotion` (ordering) — done.
- **Seam**: `PostTreeNode.renderOverflowContent?: (post: PostDTO) => ReactNode`
  → `PostReply` `overflowContent` → `ReactionBar` overflow menu. Currently no
  caller passes it.

What blocks the buttons: the client cannot decide *whether to show* a control.
`PostDTO` carries no realm-role signal and no question-tag flag, and there is no
frontend per-realm role hook (`useCurrentUserId` / `useServerPermission` exist, but
not realm membership role). Rather than reproduce `assertCanPromoteInThread` on the
client, the server exposes its already-computed verdict on the thread read.

## Goals / Non-Goals

**Goals:**
- Let OP / realm moderator-owner / admin pin, unpin, accept, and unaccept from
  within the thread, via the existing overflow seam.
- Keep the server as the single source of truth for authorization; the client
  control only mirrors a server-provided capability boolean.
- Additive, backward-compatible contract changes; no schema migration.

**Non-Goals:**
- No drag-to-reorder of pins (fractional `position` reorder UI is out of scope;
  this change pins/unpins, it does not reposition).
- No new authorization rules or role model changes.
- No realm-level pinboard (`Realm.extra.pinboard`) work.
- No `HIGHLIGHT` kind.

## Decisions

**1. Expose two viewer-derived signals on the thread read, not on every PostDTO.**
`viewerCanPromote` and `isQuestionThread` are thread-scoped, so they belong on the
thread read payload (the root/thread envelope), computed once per request — not
duplicated onto each reply `PostDTO`. This keeps reply rows lean and avoids implying
per-row authority differences (authority is per-thread).

**2. Refactor `assertCanPromoteInThread` into a predicate + guard.** Extract a pure
`canPromoteInThread(scope, caller): boolean` that the existing guard calls (throwing
on false) and the read path calls (to populate `viewerCanPromote`). One code path,
no drift between what the UI shows and what the server enforces. `isQuestionThread()`
is already a boolean check and is reused directly.

**3. Client gating mirrors server rules exactly.** Pin/unpin: `viewerCanPromote`
and `depth >= 1`. Accept/unaccept: `viewerCanPromote` and `isQuestionThread` and
`depth === 1`. These are the same conditions the server enforces, so a shown control
should virtually always succeed; the `403` path is a safety net, not the norm.

**4. `PostTreeSection` owns `renderOverflowContent`.** It already reads
`useCurrentUserId` / `useServerPermission` (for editor entry) and has the thread-level
signals in scope, so it builds the callback and passes it down the existing seam.
The control itself is a small presentational component; the mutations live in
`@rezics/api` hooks (pin/unpin/accept/unaccept) that invalidate the thread query
key on success.

**5. Refresh by query invalidation, not hand-rolled local state.** On success we
invalidate the thread query so badges (`PostPinBadge`) and ordering
(`orderSiblingsByPromotion`) recompute from server truth — reusing the existing
render path rather than mutating client state in two places. Optimistic update is
optional polish; correctness comes from re-fetch.

## Risks / Trade-offs

- **Capability staleness**: a viewer's role could change between read and write,
  yielding a `403` on a shown control. Mitigated by treating `403` as re-sync, not
  a destructive failure; acceptable because role changes mid-thread are rare.
- **Extra read-path cost**: computing `viewerCanPromote` adds a membership/role
  lookup per thread read. Mitigated by computing once per request (thread-scoped),
  reusing the same queries the write guard already performs; can be skipped entirely
  for anonymous callers (short-circuit to `false`).
- **Contract surface growth**: two new optional fields on the thread read. Additive
  and optional, so existing consumers are unaffected; documented in `@rezics/contract`.
- **Seam coupling to ReactionBar overflow**: controls live in the reaction overflow
  menu rather than a dedicated affordance. This matches the existing design seam and
  avoids new layout work; if a more prominent affordance is wanted later, the gating
  logic and mutations stay reusable.
