## Why

The reaction service is fully built — service, main-server boundary, contracts, API client, the shared `ReactionBar`, `useVoteController`, unit-deletion cleanup, and notification dispatch are all in place. But on the frontend only `ReviewsPage` and `UserUnitsPage` actually call `useBatchReactionSummary`; every other list and detail surface (Post, PostReply, PostTree, Remark, Excerpt, Shelf, ReviewDetail, RemarkDetail, ExcerptDetail) ships with reaction counts hard-stuck at zero, and **no surface anywhere** calls `GET /reaction/my`, so a logged-in user who reloads the page sees their own up-arrow rendered as if they had never voted. The ReactionBar's `more` overflow menu also returns `null` despite `engagement-reaction-bar` requiring it, and the existing two pages that do hydrate use a `useEffect + setState` merge pattern that double-stores reaction data and forces every mutation to invalidate **all** summary caches at once. The result is a build that is plumbing-complete but UX-broken — clearly not yet at "real forum can fully operate" level.

This change closes the integration gap end-to-end so that any list or detail surface displays accurate counts and the user's own vote state on first paint, single clicks update the affected target without thrashing the rest of the page, the overflow menu actually renders, and unauthenticated clicks route through a login intent instead of silently 401-ing.

## What Changes

- **NEW** `useReactionHydration(targetIds)` — a side-effect-only hook that fires `GET /reaction/summary` and (when logged in) `GET /reaction/my` in batch and writes results into React Query cache. Returns nothing; intended to be called once per list/detail section.
- **NEW** `useReactionData(unitId)` — a selector hook used inside `ReactionBar` / `VoteGroup` that reads the per-target summary + my-state from the batch cache.
- **NEW** `useBatchUserReactions(targetIds)` — frontend wrapper around `GET /reaction/my`, mirroring the existing `useBatchReactionSummary`. Auto-disabled when no session.
- **CHANGED** `useCreateReactionMutation` / `useDeleteReactionMutation` — replace `invalidateQueries({ queryKey: reactionKeys.summaries() })` with per-target `setQueryData` optimistic updates against the batch cache; rollback on error. Single-target invalidate as a final safety net.
- **CHANGED** `ReactionBar` — stop deriving vote state from `post.reactionSummaries` / `post.userReactions` props; consume `useReactionData(post.unitId)` directly. Render the overflow menu when the `more` token is present (via the existing `OverflowMenu` component).
- **CHANGED** `VoteGroup` — drop `initialScore` / `initialUserVote` props; read from `useReactionData`.
- **CHANGED** `useVoteController` — gate writes on auth state. When unauthenticated, dispatch a shared login-intent action (open login modal / redirect with return-to) instead of firing the mutation.
- **CHANGED** every list/detail section that renders a `ReactionBar`: `PostCard`, `PostReply`, `PostTreeSection`, `RemarkCard`, `RemarkDetail`, `ExcerptCard`, `ExcerptDetail`, `ShelfCard` (and any shelf-discussion section), `ReviewCard`, `ReviewDetail` — call `useReactionHydration(ids)` once at the section level. Existing `ReviewsPage` and `UserUnitsPage` migrate off the `useEffect + setState` merge pattern onto the new hook.
- **REMOVED** `package/app/src/engagement/states/reactionStore.ts` — single-line planning-only file; React Query cache subsumes its role.
- **BREAKING** `reactionSummaries: t.Optional(t.Any())` field deleted from `package/contract/src/{post,unit,shelf,realm,book}.ts`. The field has never been populated server-side; removing it forces all consumers to go through the hydration hooks. (Development-stage cutover per CLAUDE.md — no compatibility shim.)

## Capabilities

### New Capabilities

- `reaction-hydration`: Frontend integration contract for reactions — describes how `useReactionHydration` / `useReactionData` / per-target optimistic mutations / unauthenticated login-intent gate fit together so every list and detail surface displays accurate counts + the user's own vote state on first paint.

### Modified Capabilities

- `engagement-reaction-bar`: `ReactionBar` consumes reaction data via `useReactionData(unitId)` instead of `post.reactionSummaries` / `post.userReactions` props; the `more` overflow token actually renders the existing `OverflowMenu` component instead of returning `null`; `VoteGroup` no longer accepts `initialScore` / `initialUserVote`.
- `reaction-summary`: clarify that consumers MUST call `GET /reaction/summary` directly (typically via the batch hydration hook); the field is no longer carried on list/detail responses.
- `reaction-user-state`: clarify that consumers MUST call `GET /reaction/my` directly (typically via the batch hydration hook); user reaction state is never embedded in list/detail responses.

## Impact

**Affected packages**

- `package/api/src/reaction/` — new `useBatchUserReactions`, `useReactionHydration`, `useReactionData`; rewritten mutation `onSuccess` handlers; extended `reaction.keys.ts` if needed for batch-cache reads.
- `package/app/src/engagement/` — `ReactionBar.tsx`, `VoteGroup.tsx`, `useVoteController.ts`, `OverflowMenu.tsx` wiring; deletion of `states/reactionStore.ts`.
- `package/app/src/{post,review,remark,excerpt,shelf}/` — every list section, card, and detail surface that renders `ReactionBar` calls `useReactionHydration` and stops merging into local state.
- `package/contract/src/{post,unit,shelf,realm,book}.ts` — `reactionSummaries` field removed.
- `package/app/src/review/pages/ReviewsPage.tsx`, `package/app/src/user/pages/UserUnitsPage.tsx` — migrate off `useEffect + setState` merge to the cache-first hook.

**Cross-cutting**

- A shared login-intent helper is needed (open login modal with return-to). Reuse whatever the rest of the app already uses; if no helper exists, the smallest possible one lives in `package/app/src/auth-onboarding/` (or equivalent). The reaction feature does not own login UX.
- React Query cache shape: per-target summary lookup must be derivable from the existing batch query keys without an extra round trip. `reaction.keys.ts` is the source of truth.

**Backward compatibility**

- Development-stage cutover. No compatibility shim, no dual-read on `reactionSummaries`. All affected consumers are inside this monorepo and migrate in the same change.
- Mutation API surface (`useCreateReactionMutation` / `useDeleteReactionMutation`) keeps the same input/output shape; only its cache-update behaviour changes.

**Out of scope**

- Profile reactions tab "Given / Received" lists — covered by separate `profile-reactions-tab-real` change (requires reaction-service schema/endpoint additions).
- `funny` / `award` reaction tokens — remain reserved per `engagement-reaction-bar`.
- Server-side joining of summaries into list responses — explicitly rejected (violates the "reads go direct" boundary in `reaction-auth`).
