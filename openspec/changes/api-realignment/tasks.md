## 1. Fix broken paths in existing API modules

- [ ] 1.1 Fix `tagApi.getForUnit()` in `package/api/src/tag/tag.api.ts`: change path from `/tags?unitId=...` to `/tags/for-unit/${unitId}`, accept optional `language` query param, change return type from `{tags, total}` to `{tags: UnitTagDTO[]}`
- [ ] 1.2 Update `tagsForUnitQuery` in `package/api/src/tag/tag.queries.ts` to match new return type `{tags: UnitTagDTO[]}`
- [ ] 1.3 Update 3 frontend files that destructure `total` from `tagQueries.forUnit`: `package/app/src/tag/page/TagByUnitPage.tsx` (2 usages), `package/app/src/tag/component/Edit/TagListEdit.tsx` (1 usage)
- [ ] 1.4 Fix `realmApi.leave()` in `package/api/src/realm/realm.api.ts`: import `getRezicsSessionClaims` from `../react-query/jwt`, resolve current user's unitId, change path from `/members/me` to `/members/${userId}`, throw if no session
- [ ] 1.5 Fix realm content paths in `package/api/src/realm/realm.api.ts`: change `addUnit` from `/realms/${id}/units` to `/realms/${id}/content`, change `removeUnit` from `/realms/${id}/units/${unitId}` to `/realms/${id}/content/${unitId}`
- [ ] 1.6 Fix realm tag paths in `package/api/src/realm/realm.api.ts`: change `addTagUnit` from `/realms/${id}/tag-units` to `/realms/${id}/tags`, change `removeTagUnit` from DELETE-with-body to `DELETE /realms/${id}/tags/${tagUnitId}/${contentUnitId}` with URL params
- [ ] 1.7 Update `removeTagUnit` signature: change from `(realmUnitId, input: RemoveRealmTagUnitInput)` to `(realmUnitId, tagUnitId, contentUnitId)` in API and mutation

## 2. Remove phantom code

- [ ] 2.1 Remove `adminCreate` method from `package/api/src/user/user.api.ts`
- [ ] 2.2 Remove `useAdminCreateUserMutation` from `package/api/src/user/user.mutations.ts` and its export from `package/api/src/user/user.ts`
- [ ] 2.3 Remove `getMembers()`, `getUnits()`, `getTagUnits()` from `package/api/src/realm/realm.api.ts`
- [ ] 2.4 Remove `realmMembersQuery`, `realmUnitsQuery`, `realmTagUnitsQuery` from `package/api/src/realm/realm.queries.ts` and their entries from `realmQueries` object
- [ ] 2.5 Remove `members`, `units`, `tagUnits` keys from `package/api/src/realm/realm.keys.ts`
- [ ] 2.6 Update realm barrel export `package/api/src/realm/realm.ts` to remove deleted query/key exports
- [ ] 2.7 Update realm mutations `removeTagUnit` to match new 3-arg API signature

## 3. Add Link API module

- [ ] 3.1 Create `package/api/src/link/link.types.ts` — re-export `LinkDTO`, `CreateLinkInput`, `UpdateLinkInput` from `@rezics/contract`
- [ ] 3.2 Create `package/api/src/link/link.api.ts` — `linkApi` with `create`, `get`, `update`, `remove`
- [ ] 3.3 Create `package/api/src/link/link.keys.ts` — `linkKeys` with `all`, `lists`, `list`, `details`, `detail`
- [ ] 3.4 Create `package/api/src/link/link.queries.ts` — `linkDetailQuery` (10 min stale)
- [ ] 3.5 Create `package/api/src/link/link.mutations.ts` — `useCreateLinkMutation`, `useUpdateLinkMutation`, `useDeleteLinkMutation`
- [ ] 3.6 Create `package/api/src/link/link.ts` — barrel export

## 4. Add Attribution API module

- [ ] 4.1 Create `package/api/src/attribution/attribution.types.ts` — re-export all attribution types from `@rezics/contract`
- [ ] 4.2 Create `package/api/src/attribution/attribution.api.ts` — `attributionApi` with person, organization, and credit methods
- [ ] 4.3 Create `package/api/src/attribution/attribution.keys.ts` — `attributionKeys` with person, organization, and credit key factories
- [ ] 4.4 Create `package/api/src/attribution/attribution.queries.ts` — person and organization list/detail queries
- [ ] 4.5 Create `package/api/src/attribution/attribution.mutations.ts` — all 10 mutation hooks (person CRUD, org CRUD, credit link/unlink)
- [ ] 4.6 Create `package/api/src/attribution/attribution.ts` — barrel export

## 5. Add DM API module

- [ ] 5.1 Create `package/api/src/dm/dm.types.ts` — re-export `DmSendBody` from `@rezics/contract`
- [ ] 5.2 Create `package/api/src/dm/dm.api.ts` — `dmApi` with `send` method
- [ ] 5.3 Create `package/api/src/dm/dm.keys.ts` — `dmKeys` with base key
- [ ] 5.4 Create `package/api/src/dm/dm.queries.ts` — empty for now (no read endpoints yet), export placeholder `dmQueries` object
- [ ] 5.5 Create `package/api/src/dm/dm.mutations.ts` — `useSendDmMutation`
- [ ] 5.6 Create `package/api/src/dm/dm.ts` — barrel export

## 6. Add user batch lookup

- [ ] 6.1 Add `batch(ids: string[])` method to `userApi` in `package/api/src/user/user.api.ts` — `GET /users/batch?ids=...` (comma-separated, returns `Record<string, {name, slug, avatar}>`)
- [ ] 6.2 Add `batch` key to `userKeys` in `package/api/src/user/user.keys.ts`
- [ ] 6.3 Add `userBatchQuery(ids)` to `package/api/src/user/user.queries.ts` — 5 min stale, enabled when ids.length > 0
- [ ] 6.4 Update `package/api/src/user/user.ts` barrel to export new query

## 7. Clean up deprecated API stubs

- [ ] 7.1 Delete directory `package/api/src/comment/` (6 files)
- [ ] 7.2 Delete directory `package/api/src/review/` (6 files)
- [ ] 7.3 Delete directory `package/api/src/readlist/` (6 files)

## 8. Migrate deprecated meili stubs and clean up frontend

- [ ] 8.1 Migrate `package/app/src/home/section/TrendingReviewsSection.tsx` from `buildMeiliReviewQuery` to `contentSearchQueryOptions` with type filter for reviews
- [ ] 8.2 Migrate `package/app/src/home/section/TrendingReadListSection.tsx` from `buildMeiliReadlistQuery` to `contentSearchQueryOptions` or shelf query
- [ ] 8.3 Migrate `package/app/src/readlist/page/ReadListsPage.tsx` from `buildMeiliReadlistQuery` to shelf list query
- [ ] 8.4 Migrate `package/app/src/user/page/UserUnitsPage.tsx` — replace both `buildMeiliReadlistQuery` and `buildMeiliReviewQuery` with content search or post/shelf queries
- [ ] 8.5 Remove `buildMeiliUnitQuery`, `buildMeiliReadlistQuery`, `buildMeiliReviewQuery` stubs from `package/api/src/meili/meili.queries.ts`
- [ ] 8.6 Delete stale mock handler `package/app/src/mock/handler/comment/` directory
- [ ] 8.7 Delete stale mock handler `package/app/src/mock/handler/review/` directory
- [ ] 8.8 Delete stale mock handler `package/app/src/mock/handler/readlist/` directory
- [ ] 8.9 Update `package/app/src/mock/handler/index.ts` — remove comment, review, readlist handler imports and spread entries

## 9. Verification

- [ ] 9.1 Run `bun run build` in `package/api` to verify TypeScript compilation
- [ ] 9.2 Run `bun run build` in `package/app` to verify no broken imports
- [ ] 9.3 Grep for any remaining imports of deleted modules: `@rezics/api/comment`, `@rezics/api/review`, `@rezics/api/readlist`
- [ ] 9.4 Grep for any remaining references to `buildMeiliReadlistQuery`, `buildMeiliReviewQuery`, `buildMeiliUnitQuery`
- [ ] 9.5 Grep for old realm paths (`/tag-units`, `/members/me`) in API client to confirm no remnants
