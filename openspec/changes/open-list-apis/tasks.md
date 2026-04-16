## 1. Contract: Shared Pagination Limit

- [x] 1.1 Add `paginationLimitSchema` to `package/contract/src/pagination.ts` — `t.Optional(t.Number({ minimum: 1, maximum: 100, default: 20 }))`
- [x] 1.2 Replace `limit: t.Optional(t.Number())` / `t.Optional(t.Numeric())` with `paginationLimitSchema` in all list query schemas: `bookListQuerySchema`, `postListQuerySchema`, `realmListQuerySchema`, `shelfListQuerySchema`, `chapterListQuerySchema`, `tagListQuerySchema`, `feedbackListQuerySchema`, and user filter schemas in `package/contract/src/`
- [x] 1.3 Verify compile: `cd package/contract && bun run build` (or type-check)

## 2. Contract: Remove `q` from List Query Schemas

- [x] 2.1 Remove `q: t.Optional(t.String())` from `bookListQuerySchema` in `package/contract/src/book.ts`
- [x] 2.2 Remove `q: t.Optional(t.String())` from `realmListQuerySchema` in `package/contract/src/realm.ts`
- [x] 2.3 Verify `postListQuerySchema` has no `q` field (it shouldn't — confirm and skip if already absent)
- [x] 2.4 Grep for any imports/references to the `q` field from these schemas across the repo and update callers

## 3. Server: Remove SQL LIKE Search Logic

- [x] 3.1 Remove the `q`-based `contains` / LIKE block from `BookService.buildWhereClause` in `package/server/src/book/book.service.ts` (lines ~40-75)
- [x] 3.2 Remove the `q`-based `contains` block from `RealmService` list query builder in `package/server/src/realm/realm.service.ts`
- [x] 3.3 Remove `q` from `BookListQuery` / `RealmListQuery` type references in service files if any remain

## 4. Server: Open List Endpoints with Role-Aware Access

- [x] 4.1 `GET /books/` in `package/server/src/book/book.api.ts`: remove `requireLogin: true`, remove admin role check + `verifyAdminFromDb` call. Add role-aware logic: if caller is not admin, force `status=PUBLISHED` and `visibility=PUBLIC` in query before passing to service
- [x] 4.2 `GET /posts/` in `package/server/src/post/post.api.ts`: remove `requireLogin: true`, remove `BasicAdminPermission` check. Add role-aware logic: if caller is not admin, force published-content-only filtering
- [x] 4.3 `GET /realms/` in `package/server/src/realm/realm.api.ts`: remove `requireLogin: true`, remove `BasicAdminPermission` check. Add role-aware logic: if caller is not admin, force `isPublic=true`
- [x] 4.4 Verify auth macro behavior with `requireLogin: false` — ensure `identity` is still populated (as guest/anonymous) when no token is provided, or handle the `undefined` identity case in handlers

## 5. Verification

- [x] 5.1 Compile check: `cd package/server && bun run build` (or type-check)
- [x] 5.2 Run existing tests (8 pre-existing failures, none related to this change): `cd package/server && bun test` to catch regressions
- [ ] 5.3 Manual test: unauthenticated `GET /books/?limit=20` returns published books (requires running server)
- [ ] 5.4 Manual test: unauthenticated `GET /books/?limit=500` is rejected by Elysia validation (requires running server)
- [ ] 5.5 Manual test: admin `GET /books/?status=DRAFT` returns draft books (requires running server)
