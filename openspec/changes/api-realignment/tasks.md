## 1. Fix broken paths in existing API modules

- [x] 1.1 Fix `tagApi.getForUnit()` in `package/api/src/tag/tag.api.ts`: change path from `/tags?unitId=...` to `/tags/for-unit/${unitId}`, accept optional `language` query param, change return type from `{tags, total}` to `{tags: UnitTagDTO[]}`
- [x] 1.2 Update `tagsForUnitQuery` in `package/api/src/tag/tag.queries.ts` to match new return type `{tags: UnitTagDTO[]}`
- [x] 1.3 Update 3 frontend files that destructure `total` from `tagQueries.forUnit`: `package/app/src/tag/page/TagByUnitPage.tsx` (2 usages), `package/app/src/tag/component/Edit/TagListEdit.tsx` (1 usage)
- [x] 1.4 Fix `realmApi.leave()` in `package/api/src/realm/realm.api.ts`: import `getRezicsSessionClaims` from `../react-query/jwt`, resolve current user's unitId, change path from `/members/me` to `/members/${userId}`, throw if no session
- [x] 1.5 Fix realm content paths in `package/api/src/realm/realm.api.ts`: change `addUnit` from `/realms/${id}/units` to `/realms/${id}/content`, change `removeUnit` from `/realms/${id}/units/${unitId}` to `/realms/${id}/content/${unitId}`
- [x] 1.6 Fix realm tag paths in `package/api/src/realm/realm.api.ts`: change `addTagUnit` from `/realms/${id}/tag-units` to `/realms/${id}/tags`, change `removeTagUnit` from DELETE-with-body to `DELETE /realms/${id}/tags/${tagUnitId}/${contentUnitId}` with URL params
- [x] 1.7 Update `removeTagUnit` signature: change from `(realmUnitId, input: RemoveRealmTagUnitInput)` to `(realmUnitId, tagUnitId, contentUnitId)` in API and mutation

## 2. Remove phantom code

- [x] 2.1 Remove `adminCreate` method from `package/api/src/user/user.api.ts`
- [x] 2.2 Remove `useAdminCreateUserMutation` from `package/api/src/user/user.mutations.ts` and its export from `package/api/src/user/user.ts`
- [x] 2.3 Remove `getMembers()`, `getUnits()`, `getTagUnits()` from `package/api/src/realm/realm.api.ts`
- [x] 2.4 Remove `realmMembersQuery`, `realmUnitsQuery`, `realmTagUnitsQuery` from `package/api/src/realm/realm.queries.ts` and their entries from `realmQueries` object
- [x] 2.5 Remove `members`, `units`, `tagUnits` keys from `package/api/src/realm/realm.keys.ts`
- [x] 2.6 Update realm barrel export `package/api/src/realm/realm.ts` to remove deleted query/key exports
- [x] 2.7 Update realm mutations `removeTagUnit` to match new 3-arg API signature

## 3. Add Link API module

- [x] 3.1 Create `package/api/src/link/link.types.ts` — re-export `LinkDTO`, `CreateLinkInput`, `UpdateLinkInput` from `@rezics/contract`
- [x] 3.2 Create `package/api/src/link/link.api.ts` — `linkApi` with `create`, `get`, `update`, `remove`
- [x] 3.3 Create `package/api/src/link/link.keys.ts` — `linkKeys` with `all`, `lists`, `list`, `details`, `detail`
- [x] 3.4 Create `package/api/src/link/link.queries.ts` — `linkDetailQuery` (10 min stale)
- [x] 3.5 Create `package/api/src/link/link.mutations.ts` — `useCreateLinkMutation`, `useUpdateLinkMutation`, `useDeleteLinkMutation`
- [x] 3.6 Create `package/api/src/link/link.ts` — barrel export

## 4. Add Attribution API module

- [x] 4.1 Create `package/api/src/attribution/attribution.types.ts` — re-export all attribution types from `@rezics/contract`
- [x] 4.2 Create `package/api/src/attribution/attribution.api.ts` — `attributionApi` with person, organization, and credit methods
- [x] 4.3 Create `package/api/src/attribution/attribution.keys.ts` — `attributionKeys` with person, organization, and credit key factories
- [x] 4.4 Create `package/api/src/attribution/attribution.queries.ts` — person and organization list/detail queries
- [x] 4.5 Create `package/api/src/attribution/attribution.mutations.ts` — all 10 mutation hooks (person CRUD, org CRUD, credit link/unlink)
- [x] 4.6 Create `package/api/src/attribution/attribution.ts` — barrel export

## 5. Add DM API module

- [x] 5.1 Create `package/api/src/dm/dm.types.ts` — re-export `DmSendBody` from `@rezics/contract`
- [x] 5.2 Create `package/api/src/dm/dm.api.ts` — `dmApi` with `send` method
- [x] 5.3 Create `package/api/src/dm/dm.keys.ts` — `dmKeys` with base key
- [x] 5.4 Create `package/api/src/dm/dm.queries.ts` — empty for now (no read endpoints yet), export placeholder `dmQueries` object
- [x] 5.5 Create `package/api/src/dm/dm.mutations.ts` — `useSendDmMutation`
- [x] 5.6 Create `package/api/src/dm/dm.ts` — barrel export

## 6. Add user batch lookup

- [x] 6.1 Add `batch(ids: string[])` method to `userApi` in `package/api/src/user/user.api.ts` — `GET /users/batch?ids=...` (comma-separated, returns `Record<string, {name, slug, avatar}>`)
- [x] 6.2 Add `batch` key to `userKeys` in `package/api/src/user/user.keys.ts`
- [x] 6.3 Add `userBatchQuery(ids)` to `package/api/src/user/user.queries.ts` — 5 min stale, enabled when ids.length > 0
- [x] 6.4 Update `package/api/src/user/user.ts` barrel to export new query

## 7. Clean up deprecated API stubs

- [x] 7.1 Delete directory `package/api/src/comment/` (6 files)
- [x] 7.2 Delete directory `package/api/src/review/` (6 files)
- [x] 7.3 Delete directory `package/api/src/readlist/` (6 files)

## 8. Migrate deprecated meili stubs and clean up frontend

- [x] 8.1 Migrate `package/app/src/home/section/TrendingReviewsSection.tsx` from `buildMeiliReviewQuery` to `contentSearchQueryOptions` with type filter for reviews
- [x] 8.2 Migrate `package/app/src/home/section/TrendingReadListSection.tsx` from `buildMeiliReadlistQuery` to `contentSearchQueryOptions` or shelf query
- [x] 8.3 Migrate `package/app/src/readlist/page/ReadListsPage.tsx` from `buildMeiliReadlistQuery` to shelf list query
- [x] 8.4 Migrate `package/app/src/user/page/UserUnitsPage.tsx` — replace both `buildMeiliReadlistQuery` and `buildMeiliReviewQuery` with content search or post/shelf queries
- [x] 8.5 Remove `buildMeiliUnitQuery`, `buildMeiliReadlistQuery`, `buildMeiliReviewQuery` stubs from `package/api/src/meili/meili.queries.ts`
- [x] 8.6 Delete stale mock handler `package/app/src/mock/handler/comment/` directory
- [x] 8.7 Delete stale mock handler `package/app/src/mock/handler/review/` directory
- [x] 8.8 Delete stale mock handler `package/app/src/mock/handler/readlist/` directory
- [x] 8.9 Update `package/app/src/mock/handler/index.ts` — remove comment, review, readlist handler imports and spread entries

## 9. Verification

- [x] 9.1 Run `bun run build` in `package/api` to verify TypeScript compilation
- [x] 9.2 Run `bun run build` in `package/app` to verify no broken imports
- [x] 9.3 Grep for any remaining imports of deleted modules: `@rezics/api/comment`, `@rezics/api/review`, `@rezics/api/readlist`
- [x] 9.4 Grep for any remaining references to `buildMeiliReadlistQuery`, `buildMeiliReviewQuery`, `buildMeiliUnitQuery`
- [x] 9.5 Grep for old realm paths (`/tag-units`, `/members/me`) in API client to confirm no remnants
