## 1. Search package: index definitions

- [x] 1.1 Add `posts` index definition to `package/search/src/client.ts` (primary key `id`, searchable: `body`, `targetTitles`, `authorName`; filterable: `kind`, `targetUnitId`, `realmUnitId`, `authorUserId`, `depth`, `isLocked`, `rootPostUnitId`, `parentPostUnitId`; sortable: `createdAt`, `updatedAt`, `replyCount`)
- [x] 1.2 Add `realms` index definition to `package/search/src/client.ts` (primary key `id`, searchable: `titles`, `descriptions`; filterable: `isPublic`, `isOfficial`; sortable: `memberCount`, `createdAt`, `updatedAt`)

## 2. Search package: document builders and sync functions

- [x] 2.1 Implement `buildPostDocument(unitId)` in `package/search/src/sync.ts` — reads post with unit, user, target unit (translations + type extension), and ScoreEntry; returns denormalized post document
- [x] 2.2 Implement `buildRealmDocument(unitId)` in `package/search/src/sync.ts` — reads realm with unit and translations; returns denormalized realm document with `titles[]`, `descriptions[]`, `translations[]`
- [x] 2.3 Implement `syncSinglePost(unitId)` — build document and upsert, or delete if post no longer qualifies
- [x] 2.4 Implement `syncSingleRealm(unitId)` — build document and upsert, or delete if realm no longer qualifies
- [x] 2.5 Implement `syncAllPosts()` — cursor-paginated full reindex of all qualifying posts
- [x] 2.6 Implement `syncAllRealms()` — cursor-paginated full reindex of all qualifying realms
- [x] 2.7 Implement `syncPostsByAuthor(userId)` — re-sync all posts by a specific author (for profile change cascading)
- [x] 2.8 Implement `syncPostsByTarget(targetUnitId)` — re-sync all posts targeting a specific unit (for title change cascading)
- [x] 2.9 Export all new functions from `package/search/src/index.ts`

## 3. Contract: search schemas

- [x] 3.1 Create `package/contract/src/meili/post.ts` — define `PostSearchOptions` (keyword, kind, targetUnitId, realmUnitId, authorUserId, rootPostUnitId, parentPostUnitId, depth, isLocked, sort, offset, limit), `PostSearchDocument`, and `PostSearchResult` Typebox schemas
- [x] 3.2 Create `package/contract/src/meili/realm.ts` — define `RealmSearchOptions` (keyword, isPublic, isOfficial, sort, offset, limit), `RealmSearchDocument`, and `RealmSearchResult` Typebox schemas
- [x] 3.3 Export new schemas from `package/contract/src/meili/index.ts` (or barrel)

## 4. Server: search endpoints

- [x] 4.1 Add `POST /meili/posts/search` endpoint in `package/server/src/meili/meili.api.ts` (or new sub-module `meili/posts/`) — accepts `PostSearchOptions`, builds Meilisearch query with filters, returns `PostSearchResult`
- [x] 4.2 Add `POST /meili/realms/search` endpoint — accepts `RealmSearchOptions`, builds Meilisearch query with filters, returns `RealmSearchResult`
- [x] 4.3 Add admin endpoints: `POST /meili/posts/init`, `POST /meili/posts/sync`, `DELETE /meili/posts/deleteAll` (root-only)
- [x] 4.4 Add admin endpoints: `POST /meili/realms/init`, `POST /meili/realms/sync`, `DELETE /meili/realms/deleteAll` (root-only)

## 5. Server: incremental sync triggers

- [x] 5.1 Add `syncSinglePost(unitId)` call in `post.service.create()` after database write (fire-and-forget)
- [x] 5.2 Add `syncSinglePost(unitId)` call in `post.service.update()` after database write
- [x] 5.3 Add post document removal in `post.service.delete()` after soft-delete
- [x] 5.4 Add `syncSingleRealm(unitId)` call in `realm.service.create()` after database write
- [x] 5.5 Add `syncSingleRealm(unitId)` call in `realm.service.update()` after database write
- [x] 5.6 Add `syncSingleRealm(unitId)` call when realm member joins or leaves (memberCount changes)
- [x] 5.7 Add `syncSingleRealm(unitId)` call when a realm unit's translation is created/updated via translation service
- [x] 5.8 Add `syncPostsByAuthor(userId)` call in `user.service` when profile (name/slug/avatar) is updated
- [x] 5.9 Add `syncPostsByTarget(targetUnitId)` call in translation service when a non-realm unit's translation is updated (for denormalized targetTitles)

## 6. Server: restrict DB-backed list endpoints to admin

- [x] 6.1 Add `BasicAdminPermission` check to `GET /posts/` endpoint — return 403 for non-admin users
- [x] 6.2 Add `BasicAdminPermission` check to `GET /realms/` list endpoint — return 403 for non-admin users

## 7. API client: search queries

- [x] 7.1 Add `postSearchApi` functions in `package/api/src/meili/` — `searchPosts(options)` calling `POST /meili/posts/search`
- [x] 7.2 Add `realmSearchApi` functions — `searchRealms(options)` calling `POST /meili/realms/search`
- [x] 7.3 Add React Query hooks: `usePostSearchQuery(options)`, `useRealmSearchQuery(options)` with appropriate stale times
- [x] 7.4 Add infinite query variants for paginated list views

## 8. Frontend: rewire list views

- [x] 8.1 Update `RemarkList` component to use `usePostSearchQuery({ kind: "REMARK", targetUnitId })` instead of DB-backed query
- [x] 8.2 Update `ThreadList` component to use `usePostSearchQuery({ kind: "POST", targetUnitId, depth: 0 })`
- [x] 8.3 Update review list views to use `usePostSearchQuery({ kind: "REVIEW", targetUnitId })`
- [x] 8.4 Update realm landing page to use `useRealmSearchQuery({ isPublic: true })` and `useRealmSearchQuery({ isOfficial: true })`
- [x] 8.5 Update realm search page to use `useRealmSearchQuery({ keyword, ... })`

## 9. Admin UI: index management controls

- [x] 9.1 Add posts index section to `package/admin/src/meili/page/MeiliPage.tsx` — init, sync, delete buttons
- [x] 9.2 Add realms index section to MeiliPage — init, sync, delete buttons
- [x] 9.3 Add admin query hooks for the new admin endpoints in `package/api/src/meili/meili.admin.queries.ts`

## 10. Verify

- [x] 10.1 Run `tsc --noEmit` for `package/search`, `package/server`, `package/contract`, `package/api`, `package/app`, `package/admin` — zero errors (zero new errors; pre-existing errors in book, chapter, jwt modules unrelated to this change)
- [ ] 10.2 Verify posts index: seed database → call `POST /meili/posts/init` → call `POST /meili/posts/sync` → call `POST /meili/posts/search` with empty keyword → confirm results (manual verification needed)
- [ ] 10.3 Verify realms index: call `POST /meili/realms/init` → call `POST /meili/realms/sync` → call `POST /meili/realms/search { keyword: "<realm name>" }` → confirm multilingual search works (manual verification needed)
- [ ] 10.4 Verify incremental sync: create a post via API → confirm it appears in `POST /meili/posts/search` (manual verification needed)
- [ ] 10.5 Verify admin restriction: call `GET /posts/` as non-admin user → confirm 403 (manual verification needed)
