## Context

The reaction service has been wired end-to-end at the protocol level: `@rezics/reaction` exposes `GET /reaction/summary` (public, batch), `GET /reaction/my` (JWT-gated, batch), `POST /internal/{create,remove,cleanup}` (shared-secret); the main server proxies writes through `package/server/src/reaction-boundary/`; the contracts and the `@rezics/api/reaction` client are in place; `ReactionBar` + `VoteGroup` + `useVoteController` exist as the single shared interaction-footer.

What is *not* wired is the read-side hydration on the frontend. Today only `package/app/src/review/pages/ReviewsPage.tsx` and `package/app/src/user/pages/UserUnitsPage.tsx` actually call `useBatchReactionSummary`. Both do it through a `fetch → useEffect → setState` merge pattern that mutates the list objects in component state. Worse: **no surface anywhere** calls `GET /reaction/my`, so a logged-in user's existing votes are invisible on first paint. The mutation hooks finalize with `invalidateQueries({ queryKey: reactionKeys.summaries() })`, refetching every batch on the page after each click. The `engagement-reaction-bar` spec already requires the `more` overflow menu, but `ReactionBar.tsx`'s `case "more"` branch returns `null`. There is also a one-line planning artefact at `package/app/src/engagement/states/reactionStore.ts` that captured the intent but was never implemented.

Stakeholders: any feature that renders content cards or detail pages (`post`, `review`, `remark`, `excerpt`, `shelf`, plus `book-library` / `realm` surfaces that embed cards). All of them currently render zeroed reaction footers.

## Goals / Non-Goals

**Goals:**

- Every list/detail surface that renders `ReactionBar` displays accurate `summary` counts and the user's own reactions on first paint, regardless of which feature owns the surface.
- Reaction state has exactly one source of truth on the client: the React Query cache populated by the batch hydration hook. `ReactionBar` reads from it; mutations write to it.
- A single click updates only the targeted item's cache entry — no page-wide refetch storm.
- `more` token actually renders an overflow menu, matching `engagement-reaction-bar`.
- An unauthenticated user clicking a reaction is routed to a login intent rather than receiving a silent 401.
- The two pages that already hydrate (`ReviewsPage`, `UserUnitsPage`) migrate onto the new pattern, deleting their `useEffect + setState` merge code.

**Non-Goals:**

- New reaction types (`funny`, `award` stay reserved per `engagement-reaction-bar`).
- Server-side joining of summaries into list responses (explicitly rejected: violates `reaction-auth`'s "reads go direct" boundary).
- Profile reactions tab Given/Received lists (split into `profile-reactions-tab-real`).
- Realm-scoped reaction aggregations.
- Rate limiting of reaction toggles (separate concern).
- Building a generic login-intent system. We use whatever the rest of the app uses; this change does not own that surface.

## Decisions

### D1. Cache-first, bar reads from cache (not from props)

`ReactionBar` and `VoteGroup` stop deriving state from `post.reactionSummaries` / `post.userReactions` props. Instead a new selector hook `useReactionData(unitId)` reads from the React Query batch cache and returns `{ summary: Record<string, number>, userReactions: string[], isHydrated: boolean }`.

**Rationale.** The current "merge into list state" pattern is a double cache: list objects in component state plus React Query under the hood. Mutations have to update both, which is why `invalidateQueries` was used as the lazy synchroniser. Treating React Query cache as the single source — and reading from it directly inside the bar — collapses both problems: optimistic updates become a per-target `setQueryData`, and the bar is decoupled from how the list was loaded.

**Alternatives considered.**
- **A. Continue merging into list state, just systematise it via a hook.** Rejected: keeps the dual cache; every list page still pays a `setReviews` round-trip.
- **B. Introduce a Jotai/Zustand `reactionStore` (the `reactionStore.ts` plan).** Rejected: React Query's cache already keys by `targetIds` and supports per-target mutation, optimistic update, rollback, and stale time. A second store duplicates the work.
- **C. Server-side join: have the main server populate `reactionSummaries` and `userReactions` on every list response.** Rejected: violates the "reads go direct" boundary in `reaction-auth/spec.md`; couples list endpoints to the reaction service; turns public list endpoints into authenticated ones because `userReactions` requires JWT.

### D2. `useReactionHydration(targetIds)` is side-effect-only

The hydration hook is a `useQueries` wrapper that fires summary + my batches and writes their results into cache. It returns nothing useful (or returns `{ isLoading }` for skeleton display); callers cannot accidentally start consuming the data through this hook.

**Rationale.** If the hook returned data, every caller would hand-roll its own merge again. The point of the cache-first model is that the bar reads from cache via `useReactionData`. The hook's only job is "make sure the right batch query is in flight."

**Trade-off.** A hook that exists for side-effects feels unusual. We accept that — the alternative is worse.

### D3. Batch keys mirror `useBatchReactionSummary`'s sorted-deduped form

The summary cache key is already `reactionKeys.summaryBatch(normalizeIds(targetIds))` — sorted + deduped, so order-of-IDs doesn't fragment cache. We add `reactionKeys.myBatch(normalizeIds(targetIds))` with the same convention. `useReactionData(unitId)` finds the *single largest currently-cached batch that contains `unitId`* and reads from it — there is no per-unitId query.

**Why "largest containing batch."** Two list sections may render the same `unitId` with overlapping but non-identical id sets (e.g. one shows the post on the home feed, another on the realm page). We don't want each card to fire its own query. The selector picks any active batch that contains the id; the bar re-renders when that batch updates.

**Alternative considered.** A flat per-unitId cache layer derived from batches via `queryClient.setQueriesData` after each batch settle. Rejected: more code, more invalidation surface, and it duplicates data already addressable through the existing batch cache.

### D4. Mutation `onSuccess` does per-target `setQueryData`, not page-wide invalidate

`useCreateReactionMutation` and `useDeleteReactionMutation` are rewritten:

- `onMutate`: snapshot affected batch caches, optimistically increment/decrement the count for `targetId` and add/remove the reaction from `userReactions` in every batch that contains `targetId`. Return rollback info.
- `onError`: roll back to the snapshot.
- `onSuccess`: server response confirms; if the server's count differs from optimistic, reconcile. No `invalidateQueries`.

**Rationale.** A 30-card forum page should not refetch 30 batches because of one click. `setQueryData` is local, synchronous, and respects the cache-first model.

**Trade-off.** Optimistic update logic is more complex than `invalidate`. We accept the complexity because the alternative (refetch everything) is the headline forum-feel bug.

### D5. `useVoteController` consumes a login-intent helper

When `userId` is unavailable, `useVoteController.toggleUp/toggleDown` does not dispatch the mutation; instead it calls `requestLoginIntent({ returnTo: location.href, action: "react" })`. The helper itself lives in whatever auth package the app already uses (see `Open Questions`). The reaction code does not own login UX — it only owns the gate.

**Trade-off.** We pay a small coupling to whatever login API exists. We do not invent a new one.

### D6. `more` overflow renders via the existing `OverflowMenu` component

`ReactionBar.tsx`'s switch grows a `case "more"` branch that renders `<OverflowMenu items={hidden} ... />`. The `hidden` array comes from the existing `resolvePolicy` function. The dedupe behaviour (overflow item also visible → silently dropped from overflow) is already there. No new component, no new state.

### D7. `reactionSummaries` deleted from contracts (BREAKING, dev-stage)

`reactionSummaries: t.Optional(t.Any())` is removed from `package/contract/src/{post,unit,shelf,realm,book}.ts`. Per `CLAUDE.md`'s development-stage compatibility rule, we do not add a shim or dual-read. All affected list/detail consumers migrate in this change. The field has never been populated server-side — its removal is a no-op at the protocol level.

### D8. `reactionStore.ts` deleted

`package/app/src/engagement/states/reactionStore.ts` contains a single Chinese-language design comment and zero code. Cache-first supersedes it. Delete.

## Risks / Trade-offs

- **[Selector picks the "wrong" batch when multiple active batches contain the same `unitId`.]** → Mitigation: each batch is consistent with itself (server returns truth at fetch time); reading from any of them gives the same answer modulo staleness. Mutation onMutate updates *every* batch that contains the id, so optimistic updates stay coherent.
- **[Optimistic update + rollback complexity.]** → Mitigation: keep the rollback info opaque (snapshot of affected batch caches). Tests cover both create and remove paths, plus the conflict case (server count differs).
- **[Login intent helper not yet present.]** → Mitigation: identify and reuse the existing helper during scoping (likely lives somewhere under `auth-onboarding` / `auth-login-orchestration`); if absolutely none exists, the smallest possible helper is added in that package, not in `engagement`. This is captured as Open Question Q1.
- **[Cache staleness on long-lived list views.]** → Mitigation: existing `staleTime: 1000 * 60 * 2` for summaries and `1000 * 60 * 1` for my-state remain. Optimistic updates close the small window where the user's own clicks lag the cache.
- **[`useReactionData` returns empty data before any batch resolves.]** → Mitigation: hook returns `isHydrated: false` so the bar can render zero-state without a flash; `VoteGroup` shows neutral arrows + dash (or "—") until hydrated, then snaps to the real state. Acceptable for first paint.
- **[Removing `reactionSummaries` from contracts breaks any code still reading it.]** → Mitigation: TypeScript compiler is the safety net — every reference must be updated in the same change. The convention check (`bun run check:convention`) plus per-package `tsc --noEmit` flush them out.

## Migration Plan

1. **Land the new hooks first** (`useBatchUserReactions`, `useReactionHydration`, `useReactionData`) in `package/api/src/reaction/` plus the new mutation `onMutate` / `onError` / `onSuccess` logic. No call sites yet — old behaviour preserved.
2. **Update `ReactionBar` + `VoteGroup` to consume `useReactionData`.** Keep `post.reactionSummaries` / `post.userReactions` props supported as a fallback for one commit so per-feature migration can land independently. Render the `more` overflow at this step too.
3. **Wire `useVoteController` to the login-intent helper.**
4. **Migrate consumers** in this order, one PR-friendly batch at a time: `ReviewsPage` + `UserUnitsPage` (delete merge code first — they have the most reduction), then Post (card + reply + tree), Remark (card + detail), Excerpt (card + detail), Shelf, Review (detail).
5. **Delete the prop fallback in `ReactionBar`** once every consumer is migrated.
6. **Drop `reactionSummaries` from contracts**, delete `reactionStore.ts`, run `bun run check:convention` + per-package `tsc --noEmit`.

Rollback: this change is frontend-only (plus contract field deletion). Rolling back means reverting the merge and restoring the contract field; the reaction service itself is untouched.

## Open Questions

- **Q1.** Which existing module owns the login intent helper, and what is its API? Needs to be answered before D5 can be scoped concretely. Likely candidates: `package/app/src/auth-onboarding/`, the auth-login-orchestration boundary on the server side, or a small helper in `app-shell`.
- **Q2.** Should `useReactionData(unitId)` expose a `subscribe` mode (re-render on any batch update touching the id) or rely on React Query's standard subscription via `useQuery`? Decision can be made in implementation; the spec just requires that `ReactionBar` re-renders when the affected batch cache updates.
- **Q3.** When the user has multiple non-vote reactions (e.g. future `funny` on a post they also liked), the `userReactions` is an array. `VoteGroup` only cares about `like`/`dislike`. Other reaction surfaces in this change? No — `funny`/`award` stay reserved. The array shape is already correct, just confirming no regression.
