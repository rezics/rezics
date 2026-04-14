## 1. Search package: index definitions

- [ ] 1.1 Add `posts` index definition to `package/search/src/client.ts` (primary key `id`, searchable: `body`, `targetTitles`, `authorName`; filterable: `kind`, `targetUnitId`, `realmUnitId`, `authorUserId`, `depth`, `isLocked`, `rootPostUnitId`, `parentPostUnitId`; sortable: `createdAt`, `updatedAt`, `replyCount`)
- [ ] 1.2 Add `realms` index definition to `package/search/src/client.ts` (primary key `id`, searchable: `titles`, `descriptions`; filterable: `isPublic`, `isOfficial`; sortable: `memberCount`, `createdAt`, `updatedAt`)

## 2. Search package: document builders and sync functions

- [ ] 2.1 Implement `buildPostDocument(unitId)` in `package/search/src/sync.ts` — reads post with unit, user, target unit (translations + type extension), and ScoreEntry; returns denormalized post document
- [ ] 2.2 Implement `buildRealmDocument(unitId)` in `package/search/src/sync.ts` — reads realm with unit and translations; returns denormalized realm document with `titles[]`, `descriptions[]`, `translations[]`
- [ ] 2.3 Implement `syncSinglePost(unitId)` — build document and upsert, or delete if post no longer qualifies
- [ ] 2.4 Implement `syncSingleRealm(unitId)` — build document and upsert, or delete if realm no longer qualifies
- [ ] 2.5 Implement `syncAllPosts()` — cursor-paginated full reindex of all qualifying posts
- [ ] 2.6 Implement `syncAllRealms()` — cursor-paginated full reindex of all qualifying realms
- [ ] 2.7 Implement `syncPostsByAuthor(userId)` — re-sync all posts by a specific author (for profile change cascading)
- [ ] 2.8 Implement `syncPostsByTarget(targetUnitId)` — re-sync all posts targeting a specific unit (for title change cascading)
- [ ] 2.9 Export all new functions from `package/search/src/index.ts`

## 3. Contract: search schemas

- [ ] 3.1 Create `package/contract/src/meili/post.ts` — define `PostSearchOptions` (keyword, kind, targetUnitId, realmUnitId, authorUserId, rootPostUnitId, parentPostUnitId, depth, isLocked, sort, offset, limit), `PostSearchDocument`, and `PostSearchResult` Typebox schemas
- [ ] 3.2 Create `package/contract/src/meili/realm.ts` — define `RealmSearchOptions` (keyword, isPublic, isOfficial, sort, offset, limit), `RealmSearchDocument`, and `RealmSearchResult` Typebox schemas
- [ ] 3.3 Export new schemas from `package/contract/src/meili/index.ts` (or barrel)

## 4. Server: search endpoints

- [ ] 4.1 Add `POST /meili/posts/search` endpoint in `package/server/src/meili/meili.api.ts` (or new sub-module `meili/posts/`) — accepts `PostSearchOptions`, builds Meilisearch query with filters, returns `PostSearchResult`
- [ ] 4.2 Add `POST /meili/realms/search` endpoint — accepts `RealmSearchOptions`, builds Meilisearch query with filters, returns `RealmSearchResult`
- [ ] 4.3 Add admin endpoints: `POST /meili/posts/init`, `POST /meili/posts/sync`, `DELETE /meili/posts/deleteAll` (root-only)
- [ ] 4.4 Add admin endpoints: `POST /meili/realms/init`, `POST /meili/realms/sync`, `DELETE /meili/realms/deleteAll` (root-only)

## 5. Server: incremental sync triggers

- [ ] 5.1 Add `syncSinglePost(unitId)` call in `post.service.create()` after database write (fire-and-forget)
- [ ] 5.2 Add `syncSinglePost(unitId)` call in `post.service.update()` after database write
- [ ] 5.3 Add post document removal in `post.service.delete()` after soft-delete
- [ ] 5.4 Add `syncSingleRealm(unitId)` call in `realm.service.create()` after database write
- [ ] 5.5 Add `syncSingleRealm(unitId)` call in `realm.service.update()` after database write
- [ ] 5.6 Add `syncSingleRealm(unitId)` call when realm member joins or leaves (memberCount changes)
- [ ] 5.7 Add `syncSingleRealm(unitId)` call when a realm unit's translation is created/updated via translation service
- [ ] 5.8 Add `syncPostsByAuthor(userId)` call in `user.service` when profile (name/slug/avatar) is updated
- [ ] 5.9 Add `syncPostsByTarget(targetUnitId)` call in translation service when a non-realm unit's translation is updated (for denormalized targetTitles)

## 6. Server: restrict DB-backed list endpoints to admin

- [ ] 6.1 Add `BasicAdminPermission` check to `GET /posts/` endpoint — return 403 for non-admin users
- [ ] 6.2 Add `BasicAdminPermission` check to `GET /realms/` list endpoint — return 403 for non-admin users

## 7. API client: search queries

- [ ] 7.1 Add `postSearchApi` functions in `package/api/src/meili/` — `searchPosts(options)` calling `POST /meili/posts/search`
- [ ] 7.2 Add `realmSearchApi` functions — `searchRealms(options)` calling `POST /meili/realms/search`
- [ ] 7.3 Add React Query hooks: `usePostSearchQuery(options)`, `useRealmSearchQuery(options)` with appropriate stale times
- [ ] 7.4 Add infinite query variants for paginated list views

## 8. Frontend: rewire list views

- [ ] 8.1 Update `RemarkList` component to use `usePostSearchQuery({ kind: "REMARK", targetUnitId })` instead of DB-backed query
- [ ] 8.2 Update `ThreadList` component to use `usePostSearchQuery({ kind: "POST", targetUnitId, depth: 0 })`
- [ ] 8.3 Update review list views to use `usePostSearchQuery({ kind: "REVIEW", targetUnitId })`
- [ ] 8.4 Update realm landing page to use `useRealmSearchQuery({ isPublic: true })` and `useRealmSearchQuery({ isOfficial: true })`
- [ ] 8.5 Update realm search page to use `useRealmSearchQuery({ keyword, ... })`

## 9. Admin UI: index management controls

- [ ] 9.1 Add posts index section to `package/admin/src/meili/page/MeiliPage.tsx` — init, sync, delete buttons
- [ ] 9.2 Add realms index section to MeiliPage — init, sync, delete buttons
- [ ] 9.3 Add admin query hooks for the new admin endpoints in `package/api/src/meili/meili.admin.queries.ts`

## 10. Verify

- [ ] 10.1 Run `tsc --noEmit` for `package/search`, `package/server`, `package/contract`, `package/api`, `package/app`, `package/admin` — zero errors
- [ ] 10.2 Verify posts index: seed database → call `POST /meili/posts/init` → call `POST /meili/posts/sync` → call `POST /meili/posts/search` with empty keyword → confirm results
- [ ] 10.3 Verify realms index: call `POST /meili/realms/init` → call `POST /meili/realms/sync` → call `POST /meili/realms/search { keyword: "<realm name>" }` → confirm multilingual search works
- [ ] 10.4 Verify incremental sync: create a post via API → confirm it appears in `POST /meili/posts/search`
- [ ] 10.5 Verify admin restriction: call `GET /posts/` as non-admin user → confirm 403
