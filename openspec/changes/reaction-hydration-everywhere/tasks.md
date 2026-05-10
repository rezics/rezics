## 1. New api hooks (no call sites yet)

- [ ] 1.1 In `package/api/src/reaction/reaction.keys.ts`, add `myBatch(normalizedIds)` key alongside the existing `summaryBatch`. Both keys MUST go through `normalizeIds` (sort + dedupe) so order-of-IDs does not fragment cache.
- [ ] 1.2 In `package/api/src/reaction/reaction.queries.ts`, add `useBatchUserReactions(targetIds, options)` mirroring `useBatchReactionSummary` but calling `reactionApi.my`. Auto-disable when no session is detected (use whatever auth-state hook the rest of the app uses; if none exists, accept an `enabled` option from the caller).
- [ ] 1.3 In `package/api/src/reaction/`, create `useReactionHydration.ts` that internally calls `useBatchReactionSummary` and `useBatchUserReactions` and returns `{ isHydrated, isLoading }` only — no reaction data.
- [ ] 1.4 In `package/api/src/reaction/`, create `useReactionData.ts` that takes a `unitId` and returns `{ summary: Record<string, number>, userReactions: string[], isHydrated: boolean }` by reading the largest active batch cache that contains `unitId`. Implement via `useQueryClient().getQueriesData` filtered by the `summaryBatch` / `myBatch` key prefix; pick the cached batch whose normalized id list contains `unitId`. Re-render when any matching batch changes (subscribe through `useQueryClient().getQueryCache()` or by reading via standard `useQuery` against a dummy stable key — implementer's choice, must satisfy "bar re-renders on cache update").
- [ ] 1.5 Export the new hooks from `package/api/src/reaction/index.ts` (or wherever the reaction barrel lives — match the existing export style).

## 2. Mutation rewrites (per-target optimistic update)

- [ ] 2.1 Rewrite `useCreateReactionMutation` in `package/api/src/reaction/reaction.mutations.ts`: implement `onMutate` that snapshots every cached `summaryBatch` and `myBatch` containing the affected `targetId`, and applies the optimistic delta (count +1, append reaction to userReactions array if absent). Return rollback info.
- [ ] 2.2 Rewrite `useDeleteReactionMutation` similarly: snapshot + decrement count + remove reaction from array. Floor count at 0.
- [ ] 2.3 Implement `onError` in both mutations to restore from the snapshot via `setQueryData` per cached batch.
- [ ] 2.4 Implement `onSuccess`: reconcile only the affected cache slice if the server-reported value differs. Do NOT call `invalidateQueries({ queryKey: reactionKeys.summaries() })`; do NOT invalidate `reactionKeys.mine()`.
- [ ] 2.5 Confirm the mutation public surface (input/output shape) is unchanged; only the cache-update behaviour differs.

## 3. ReactionBar / VoteGroup migration

- [ ] 3.1 In `package/app/src/engagement/components/VoteGroup.tsx`, drop `initialScore` and `initialUserVote` props. Read score and userVote via `useReactionData(targetUnitId)`. Render neutral state (zero / muted) when `isHydrated === false`.
- [ ] 3.2 In `package/app/src/engagement/components/ReactionBar.tsx`, remove `reactionSummaries` and `userReactions` from `ReactionBarPost`. Delete the `deriveVoteState` helper. Remove the `parseReactionSummaries` import.
- [ ] 3.3 Replace the `case "more": case "funny": case "award": return null;` block: keep `case "funny"` / `case "award"` returning `null` (still reserved), but `case "more"` MUST return `<OverflowMenu items={hidden} size={size} onInvoke={handleOverflowInvoke} />`. Also drop the `hidden.length > 0 && ...` trailing render that previously rendered the menu — the `more` token now drives it. If no `more` token is present in `actions` but `overflow` has entries, that is now a no-op (matching the "more" contract).
- [ ] 3.4 Update `package/app/src/engagement/components/ReactionBar.stories.tsx`: stop passing `reactionSummaries` / `userReactions` in story args; instead, ensure the storybook setup wraps stories in a QueryClientProvider with cache pre-populated via `setQueryData` for the demo unitId. Use a small helper for this.
- [ ] 3.5 Delete `package/app/src/shared/utils/reaction-summaries-parser.ts` if no other consumer remains; otherwise document the remaining consumer.

## 4. useVoteController login gate

- [ ] 4.1 Identify the existing login-intent helper in the codebase (likely under `auth-onboarding` / `auth-login-orchestration`). Document its module path in this task before continuing.
- [ ] 4.2 In `package/app/src/engagement/hooks/useVoteController.ts`, add an auth check at the top of `apply`. When unauthenticated, call the login-intent helper with `{ returnTo: window.location.href, action: "react" }` and `return` without firing the mutation or applying the optimistic update.
- [ ] 4.3 Add a unit test (`useVoteController.test.ts`) covering: (a) logged-out click → helper called with returnTo, mutation NOT called; (b) logged-in click → mutation called; (c) optimistic increment then server error → rollback.

## 5. Consumer migration — list & detail surfaces

- [ ] 5.1 `package/app/src/review/pages/ReviewsPage.tsx`: replace the `useEffect + setState(reviews)` merge block with a single `useReactionHydration(currentTargetIds)` call. Pass `baseReviews` directly to the paginator. Delete the `reviews` state, the merge `useEffect`, and the `reactionSummaries` field assignment.
- [ ] 5.2 `package/app/src/user/pages/UserUnitsPage.tsx`: same migration for both shelf and review groups. Replace each `useBatchReactionSummary` call with the consolidated `useReactionHydration`. Remove all merge code.
- [ ] 5.3 `package/app/src/post/sections/PostTreeSection.tsx`: collect every unitId in the tree (root + replies, recursively) and call `useReactionHydration` once with the full id list. `PostCard` and `PostReply` no longer pass reaction props.
- [ ] 5.4 `package/app/src/post/components/item/PostCard.tsx`: remove any `reactionSummaries` / `userReactions` prop wiring; pass only `unitId` to `ReactionBar`.
- [ ] 5.5 `package/app/src/post/components/item/PostReply.tsx`: same as above.
- [ ] 5.6 `package/app/src/remark/components/item/RemarkCard.tsx` and `package/app/src/remark/components/detail/RemarkDetail.tsx`: detail call `useReactionHydration([unitId])`; if RemarkCard is rendered inside a list section, the section is responsible for hydration. Audit the call sites of RemarkCard and ensure hydration happens at the section level.
- [ ] 5.7 `package/app/src/excerpt/components/item/ExcerptCard.tsx` and `package/app/src/excerpt/components/detail/ExcerptDetail.tsx`: same audit. Remove the `(excerpt as unknown as { reactionSummaries?: unknown[] }).reactionSummaries` casts.
- [ ] 5.8 `package/app/src/review/components/item/ReviewCard.tsx` and `package/app/src/review/components/detail/ReviewDetail.tsx`: detail call `useReactionHydration([unitId])`.
- [ ] 5.9 `package/app/src/shelf/`: any list section rendering `ShelfCard` calls `useReactionHydration` for the visible IDs. `ShelfDiscussionSection` is a discussion thread — treat it the same as `PostTreeSection` (collect all ids, hydrate once).
- [ ] 5.10 Audit any remaining `<ReactionBar>` call site found by `rg "<ReactionBar"`. Each call site MUST be inside a section that has called `useReactionHydration` for its `unitId`.

## 6. Contract field removal

- [ ] 6.1 Delete the `reactionSummaries: t.Optional(t.Any())` line from `package/contract/src/post.ts`, `package/contract/src/unit.ts`, `package/contract/src/shelf.ts`, `package/contract/src/realm.ts`, and `package/contract/src/book.ts`.
- [ ] 6.2 Run `rg "reactionSummaries" package` (excluding `package/reaction/prisma/generated`) and resolve every remaining hit. Storybook fixtures and stories that pass `reactionSummaries: [...]` must drop the field — `ReactionBar` no longer reads it. The fixtures in `package/app/src/stories/fixtures/{post,review,remark,excerpt,realm,shelf}.ts` are all in scope.
- [ ] 6.3 Verify no remaining type references via `tsc --noEmit` in `package/contract`, `package/api`, `package/server`, `package/app`. Run each per package per the project convention; ignore cross-package alias errors.

## 7. Cleanup

- [ ] 7.1 Delete `package/app/src/engagement/states/reactionStore.ts`.
- [ ] 7.2 If `package/app/src/engagement/states/` becomes empty, delete the directory and prune the `index.ts` export.
- [ ] 7.3 Run `rg "reactionStore" package/app` and confirm zero matches.

## 8. Validation

- [ ] 8.1 `bun run check:convention` passes.
- [ ] 8.2 `tsc --noEmit` passes per package for `@rezics/contract`, `@rezics/api`, `@rezics/server`, `@rezics/app`.
- [ ] 8.3 `bun test` passes in every package whose tests touch reactions (`package/app`, `package/api`, `package/reaction`).
- [ ] 8.4 Run `bun -F @rezics/ui storybook` and confirm the `ReactionBar` stories render with hydrated cache; specifically: a story showing the `more` overflow menu actually opens a menu, and a vote story reflects an `initialUserVote` from cache rather than from props.
- [ ] 8.5 Manual end-to-end check: log in, open a forum post list, verify the upvote arrow is highlighted on items the user has voted on; click an upvote → only that single card's count changes (no network panel storm); refresh → state persists; log out → click upvote → login intent fires, no 401 in the console.
