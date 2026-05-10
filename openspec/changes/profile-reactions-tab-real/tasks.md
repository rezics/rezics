## 1. Reaction service: contract & schemas

- [ ] 1.1 In `package/contract/src/reaction/`, add Typebox schemas for `givenQuerySchema`, `givenResponseSchema`, `internalByUserBodySchema`, `internalByUserResponseSchema`. Export from `package/contract/src/reaction/index.ts` (and `internal.ts` for the internal one). Cursor type is `t.Optional(t.String())`.
- [ ] 1.2 Add a small helper `cursor.ts` (server side, not contract) that encodes/decodes `{ createdAt: Date, id: string }` pairs as base64-url strings. Round-trip test in `package/reaction/src/reaction/cursor.test.ts`.

## 2. Reaction service: repository / service methods

- [ ] 2.1 In `package/reaction/src/reaction/reaction.service.ts`, add `listGiven({ userId, reactions, cursor, limit })` returning `{ items, nextCursor }`. Use Prisma `findMany` with `where: { userId, reaction: { in: reactions } }` and the `(createdAt, id) < cursor` predicate when a cursor is supplied. Order by `createdAt desc, id desc`. Take `limit + 1` and slice to compute `nextCursor`.
- [ ] 2.2 Add `listByUser({ targetIds, reactions, excludeUserId, cursor, limit })` mirroring the same pagination contract.
- [ ] 2.3 Cap `targetIds.length <= 1000`; throw a typed error on overflow. Cap `limit` to configured max (default 50) and floor to 1.
- [ ] 2.4 Unit-test both methods (`reaction.service.test.ts`): empty results, full page, cursor continuation, malformed cursor, type-filter.

## 3. Reaction service: routes

- [ ] 3.1 In `package/reaction/src/reaction/reaction.api.ts`, add `GET /reaction/given` that calls `reactionService.listGiven(...)`. Public (no auth).
- [ ] 3.2 In `package/reaction/src/internal/internal.api.ts`, add `POST /internal/by-user` calling `reactionService.listByUser(...)`. Protected by `internalGuard`.
- [ ] 3.3 Wire OpenAPI tags: `Reactions` for the public route, `Internal` for the internal one.

## 4. Main server: client + endpoints

- [ ] 4.1 In `package/server/src/reaction-boundary/reaction-boundary.client.ts`, add `listByUser(body)` calling the new internal endpoint via the existing `postInternal` helper.
- [ ] 4.2 In `package/server/src/reaction-boundary/`, add a small client method to fetch the public `GET /reaction/given` (server-to-service GET; existing client only does POST — extend it).
- [ ] 4.3 New router `package/server/src/profile-reaction-history/profile-reaction-history.api.ts` mounting under `/profile/:userId/reactions`. Add `GET /given` and `GET /received`. Mount it from `package/server/src/index.ts`.
- [ ] 4.4 Add a service `profile-reaction-history.service.ts` that:
  - For `given`: call reaction service, batch-resolve targets via existing unit lookups + content-kind resolver, build hydrated rows.
  - For `received`: resolve owned `unitId` set via existing user-unit query (chunked at 1000 ids), iterate through `listByUser` calls, batch-resolve actor metadata + target metadata, build hydrated rows. Maintain a stable client-visible cursor across ownership chunks (encode `{ createdAt, id, ownershipChunkOffset }` if needed; document the shape).
- [ ] 4.5 Profile visibility check: reuse whatever existing helper enforces "can viewer access this profile?" (likely under the user/profile services). Return 403 if denied.
- [ ] 4.6 Add tests in `package/server/src/profile-reaction-history/profile-reaction-history.api.test.ts` covering: public profile happy path (given + received), private profile 403, deleted-target rendering as `null`, self-reaction excluded from received, multi-chunk ownership pagination.

## 5. Frontend: API hooks

- [ ] 5.1 In `package/api/src/reaction/`, add `useGivenReactionsInfinite(userId, options)` using `useInfiniteQuery` with `getNextPageParam` reading `nextCursor`.
- [ ] 5.2 Add `useReceivedReactionsInfinite(userId, options)` similarly. Hooks call the main-server endpoints (NOT the reaction service directly).
- [ ] 5.3 Add corresponding query keys in `reaction.keys.ts`: `given(userId, reactions?)`, `received(userId, reactions?)`.
- [ ] 5.4 Export the hooks from the reaction barrel.

## 6. Frontend: ReactionsTabSection rewrite

- [ ] 6.1 Replace `package/app/src/user/sections/ReactionsTabSection.tsx` with a real implementation: read `userId` from route params, manage active chip state (`given` default), render the active list via `ReactionList` (new component) backed by the matching infinite-query hook.
- [ ] 6.2 New component `package/app/src/user/components/ReactionList.tsx`: renders flat list of `ReactionHistoryItem`, handles infinite-scroll trigger, end-of-list indicator, error/retry state, empty state.
- [ ] 6.3 New component `package/app/src/user/components/ReactionHistoryItem.tsx`: takes `mode: "given" | "received"` plus the row payload; renders icon + timestamp + target snippet (with `<SafeLink>`); when `mode === "received"`, renders actor avatar + name (with `<SafeLink>`); when `target === null`, renders "[deleted content]" placeholder.
- [ ] 6.4 Re-enable the existing `InnerFilterPanel` chips: `disabled: false`, real `onChipChange`. Keep the chip values `"given"` / `"received"`.
- [ ] 6.5 Remove every `// MOCK:` comment and the "Reaction history is coming soon" string.
- [ ] 6.6 Storybook coverage: a story per chip showing seeded data, plus an empty-state story, a deleted-target story, and a private-profile (403) story.

## 7. Validation

- [ ] 7.1 `bun run check:convention` passes.
- [ ] 7.2 `tsc --noEmit` passes per package: `@rezics/contract`, `@rezics/reaction`, `@rezics/server`, `@rezics/api`, `@rezics/app`.
- [ ] 7.3 `bun test` passes in `package/reaction`, `package/server`, `package/app`.
- [ ] 7.4 Seed a user with reactions given + received, log in as that user and as another viewer, walk through Given and Received tabs end-to-end. Verify cursor pagination by scrolling past the first page boundary; verify deleted-target rendering by deleting one of the target units (triggers existing reaction cleanup) and reloading the tab.
- [ ] 7.5 Confirm the reaction service's new public route is rate-limited by the same gateway/middleware that protects existing public reaction routes; document the configuration if any new hop is needed.
