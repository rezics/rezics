## Requirements

### Requirement: Single hydration entry point per surface

Every list and detail surface that renders one or more `ReactionBar` instances SHALL call `useReactionHydration(targetIds)` exactly once at the section level. The hook is responsible for batching `GET /reaction/summary` and (when authenticated) `GET /reaction/my` for the supplied IDs and writing both results into the React Query cache. Surfaces SHALL NOT call `useBatchReactionSummary` directly, SHALL NOT merge reaction data into list-item state, and SHALL NOT pass `reactionSummaries` or `userReactions` as props to `ReactionBar`.

#### Scenario: A list section hydrates once per render
- **WHEN** `ReviewsPage` renders the current page of reviews
- **THEN** the section calls `useReactionHydration(targetIds)` once with the union of all visible review unitIds
- **AND** no individual `ReactionBar` inside the page calls a per-target reaction query

#### Scenario: A detail page hydrates the focal target
- **WHEN** `ReviewDetail` renders for `unitId = "abc"`
- **THEN** the section calls `useReactionHydration(["abc"])` once at mount
- **AND** the `ReactionBar` reads its data via `useReactionData("abc")`

#### Scenario: A threaded post tree hydrates the entire tree
- **WHEN** `PostTreeSection` renders a tree of N posts
- **THEN** the section calls `useReactionHydration(allTreeUnitIds)` once with the full list
- **AND** N individual `ReactionBar` instances each consume `useReactionData` from the same batch cache

### Requirement: `useReactionHydration` is side-effect-only

`useReactionHydration(targetIds)` SHALL trigger the underlying batched queries and write their results into the React Query cache. It MAY return an `{ isLoading, isHydrated }` flag set so callers can render skeleton states, but it SHALL NOT return reaction data. Callers reading reaction data MUST go through `useReactionData(unitId)`.

#### Scenario: Hook does not expose reaction data directly
- **WHEN** a developer inspects the return type of `useReactionHydration`
- **THEN** the type SHALL NOT include `summaries`, `reactionsByTarget`, or any reaction payload
- **AND** the type MAY include loading/hydration flags

#### Scenario: Hook normalises ids before caching
- **WHEN** two list sections call the hook with `["a","b","c"]` and `["c","b","a"]` respectively in the same render
- **THEN** both calls hit the same cache entry (sorted+deduped key) and only one network request fires

### Requirement: `useReactionData(unitId)` is the only consumer surface inside `ReactionBar`

`useReactionData(unitId)` SHALL return `{ summary, userReactions, isHydrated }` for a single target by reading from the largest currently-cached batch containing that target. `ReactionBar` and `VoteGroup` SHALL consume this hook. They SHALL NOT accept `reactionSummaries`, `userReactions`, `initialScore`, or `initialUserVote` as props.

#### Scenario: Bar reads from the batch cache
- **WHEN** a list section has hydrated `["a","b","c"]` and `<ReactionBar post={{unitId:"b"}} ... />` mounts
- **THEN** the bar's internal `useReactionData("b")` returns the summary and user-state derived from the `["a","b","c"]` batch cache
- **AND** no additional network request fires for "b" alone

#### Scenario: Bar surfaces unhydrated state
- **WHEN** `useReactionData("b")` is called before any batch containing "b" has resolved
- **THEN** the hook returns `{ summary: {}, userReactions: [], isHydrated: false }`
- **AND** the bar renders a neutral footer (zero counts, no active vote) without flickering when hydration completes

#### Scenario: Bar re-renders when batch cache updates
- **WHEN** the batch cache containing `unitId` is updated (whether by network response or by `setQueryData`)
- **THEN** every mounted `ReactionBar` for that `unitId` re-renders with the new data

### Requirement: Authenticated-only my-state hydration

`useReactionHydration(targetIds)` SHALL fire the `GET /reaction/my` batch only when an authenticated session is available. When unauthenticated, the my-state batch SHALL NOT fire and `useReactionData(unitId).userReactions` SHALL return `[]`.

#### Scenario: Logged-out user
- **WHEN** an unauthenticated user opens a list page
- **THEN** the summary batch fires
- **AND** the my-state batch does NOT fire
- **AND** `useReactionData(...).userReactions` is `[]` for every target

#### Scenario: Logged-in user
- **WHEN** an authenticated user opens the same list page
- **THEN** both summary and my-state batches fire in parallel
- **AND** `useReactionData(...).userReactions` reflects the user's actual reactions once the my-state batch resolves

### Requirement: Mutations do per-target optimistic update, not page-wide invalidate

`useCreateReactionMutation` and `useDeleteReactionMutation` SHALL implement `onMutate` to optimistically modify every cached batch that contains the affected `targetId`: the summary batch's count for that target/reaction is incremented (create) or decremented (remove); the my-state batch's `reactionsByTarget[targetId]` array gains or loses the reaction. On `onError` the snapshot SHALL be rolled back. On `onSuccess` the mutation SHALL NOT call `invalidateQueries` on the page-wide summary or my-state keys.

#### Scenario: Single click updates only the targeted item
- **WHEN** a logged-in user upvotes one card on a 30-card list
- **THEN** only the cache entries for that single `unitId` change
- **AND** no batch query refetches in the background

#### Scenario: Server error rolls back the optimistic update
- **WHEN** the user upvotes a target and the mutation request fails
- **THEN** the optimistic count and `userReactions` revert to their pre-click values
- **AND** the bar re-renders with the original state

#### Scenario: Server returns a different count than optimistic
- **WHEN** the create response confirms creation but the server-reported summary count differs from the optimistic value (e.g. another user's reaction landed concurrently)
- **THEN** the cache reconciles to the server value
- **AND** the bar reflects the reconciled count without a full refetch

### Requirement: Unauthenticated reaction click triggers login intent

`useVoteController.toggleUp` and `toggleUp.toggleDown`, and any other reaction-creating handler, SHALL check authentication state before dispatching the mutation. When unauthenticated, the controller SHALL invoke the application's login-intent helper with a `returnTo` URL pointing at the current location and an `action: "react"` hint, and SHALL NOT issue a write to the reaction service. The reaction code SHALL NOT contain its own login UI.

#### Scenario: Logged-out user clicks upvote
- **WHEN** an unauthenticated user clicks the up-arrow on a `ReactionBar`
- **THEN** the controller calls the shared login-intent helper with `returnTo` set to the current URL
- **AND** no `POST /reaction` request is sent to the main server
- **AND** the optimistic increment does NOT apply

#### Scenario: Logged-in user clicks upvote
- **WHEN** an authenticated user clicks the up-arrow on a `ReactionBar`
- **THEN** the controller dispatches the create mutation as today
- **AND** the optimistic increment applies

### Requirement: `package/app/src/engagement/states/reactionStore.ts` is removed

The placeholder file `package/app/src/engagement/states/reactionStore.ts` SHALL be deleted. The React Query batch cache is the single source of reaction state on the client.

#### Scenario: File no longer exists
- **WHEN** the change is complete
- **THEN** `package/app/src/engagement/states/reactionStore.ts` SHALL NOT exist
- **AND** no source file SHALL import from `@/engagement/states/reactionStore`

### Requirement: `reactionSummaries` field is removed from contracts

The Typebox schemas in `package/contract/src/{post,unit,shelf,realm,book}.ts` SHALL NOT declare a `reactionSummaries` field. List and detail responses SHALL NOT carry reaction summary data. Frontend consumers SHALL obtain summaries exclusively through the hydration hooks.

#### Scenario: Contract files no longer declare the field
- **WHEN** the change is complete
- **THEN** `rg "reactionSummaries" package/contract/src` SHALL return zero matches
- **AND** the OpenAPI surface for affected list endpoints SHALL NOT include the property
