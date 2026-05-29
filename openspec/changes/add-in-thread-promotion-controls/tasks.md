## 1. Contract

- [ ] 1.1 Add optional `viewerCanPromote: boolean` and `isQuestionThread: boolean` to the thread read response type in `package/contract/src/post.ts` (thread envelope, not per-row `PostDTO`). Keep them additive/optional.
- [ ] 1.2 Run `bun --filter=@rezics/contract` build/typecheck to confirm the contract compiles and downstream packages still resolve types.

## 2. Server read-side

- [ ] 2.1 Refactor `assertCanPromoteInThread()` in `package/server/src/post/post.service.ts` to extract a pure `canPromoteInThread(scope, caller): boolean`; have the existing guard call it and throw on `false` (no behavior change to the guard).
- [ ] 2.2 In the thread read path (service + `post.mapper.ts`), populate `viewerCanPromote` via `canPromoteInThread` and `isQuestionThread` via the existing `isQuestionThread()` check; short-circuit `viewerCanPromote` to `false` for anonymous callers.
- [ ] 2.3 Ensure the two fields are emitted by the thread read endpoint in `post.api.ts`; confirm no change to `POST/DELETE /pins` and `/accepted-answers` authorization.
- [ ] 2.4 Add/extend server tests: `viewerCanPromote` matches the write guard for OP / realm moderator-owner / admin / unrelated / anonymous; `isQuestionThread` true/false per official question tag.

## 3. API client

- [ ] 3.1 In `@rezics/api`, add (or confirm) mutation hooks for pin, unpin, accept-answer, and unaccept-answer calling the existing endpoints with `scopeUnitId` = thread root, `postUnitId` = target reply.
- [ ] 3.2 On mutation success, invalidate the thread query key so badges and ordering recompute from server truth; on `403`, surface a non-destructive error and re-sync (no persisted client-only promotion state).

## 4. App UI — controls

- [ ] 4.1 Create a presentational promotion-controls component in `package/app/src/post/` (overflow-menu entries) per `rezics-design`; labels from existing promotion i18n keys; reflect current `pinKind` (Pin↔Unpin, Accept↔Unaccept).
- [ ] 4.2 In `PostTreeSection`, build the `renderOverflowContent(post)` callback: gate pin/unpin on `viewerCanPromote && depth >= 1`; gate accept/unaccept on `viewerCanPromote && isQuestionThread && depth === 1`; render nothing for anonymous viewers or when no action applies.
- [ ] 4.3 Pass the callback down the existing seam (`PostTreeSection → PostTreeNode → PostReply → ReactionBar`); confirm no new prop chain is introduced beyond `renderOverflowContent`.
- [ ] 4.4 Wire control activation to the `@rezics/api` mutation hooks from task 3.

## 5. Verification

- [ ] 5.1 Add app-level tests/stories: controls hidden for anonymous and non-authorized viewers; accept hidden on non-question threads and on `depth > 1`; pinned/accepted replies show the inverse (unpin/unaccept) action.
- [ ] 5.2 Manual check via `bun run dev`: as OP and as a realm moderator, pin/unpin and accept/unaccept a reply; confirm badge + ordering update after invalidation.
- [ ] 5.3 Run `bun run format:check`, `bun run check:convention`, `bun run knip`, and package test suites; fix fallout.
