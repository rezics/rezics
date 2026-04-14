## 1. SearchClient patch methods (`@rezics/search`)

- [x] 1.1 Add `patchContent(docs)` method to `SearchClient` using `this.contentIndex.updateDocuments(docs)`
- [x] 1.2 Add `patchPosts(docs)` method to `SearchClient` using `this.postIndex.updateDocuments(docs)`
- [x] 1.3 Add `patchRealms(docs)` method to `SearchClient` using `this.realmIndex.updateDocuments(docs)`
- [x] 1.4 Add `patchUsers(docs)` method to `SearchClient` using `this.userIndex.updateDocuments(docs)`
- [x] 1.5 Add `patchFeedbacks(docs)` method to `SearchClient` using `this.feedbackIndex.updateDocuments(docs)`

## 2. Content partial sync functions (`@rezics/search`)

- [x] 2.1 Add `patchContentTags(client, unitId)` — query UnitTag rows with tag translations, send `tagIds`, `tagScores`, `tagLabels`
- [x] 2.2 Add `patchContentCredits(client, unitId)` — query PersonCredit + OrgCredit rows, send `creditNames`
- [x] 2.3 Add `patchContentTranslations(client, unitId)` — query UnitTranslation rows, send `titles`, `subtitles`, `summaries`, `descriptions`, `languages`, `translations`
- [x] 2.4 Add `patchContentRealmIds(client, unitId)` — query RealmUnit rows, send `realmIds`
- [x] 2.5 Add `patchContentRealmTagKeys(client, unitId)` — query RealmTagUnit rows, send `realmTagKeys`
- [x] 2.6 Add `patchContentMetadata(client, unitId, fields)` — send caller-provided fields directly, no DB query

## 3. Post partial sync functions (`@rezics/search`)

- [x] 3.1 Add `patchPostsAuthor(client, userId, fields)` — query post IDs by `authorUserId`, send caller-provided author fields in batches
- [x] 3.2 Add `patchPostsTarget(client, targetUnitId)` — query post IDs + target unit translations/extension, send `targetTitles`, `targetType`, `targetCoverUrl` in batches
- [x] 3.3 Add `patchPostFields(client, unitId, fields)` — send caller-provided fields directly, no DB query

## 4. Realm partial sync functions (`@rezics/search`)

- [x] 4.1 Add `patchRealmMemberCount(client, unitId, memberCount)` — send only `memberCount`, no DB query
- [x] 4.2 Add `patchRealmMetadata(client, unitId, fields)` — send caller-provided metadata fields, no DB query
- [x] 4.3 Add `patchRealmTranslations(client, unitId)` — query UnitTranslation rows, send `titles`, `descriptions`, `translations`

## 5. User and feedback partial sync functions (`@rezics/search`)

- [x] 5.1 Add `patchUserFields(client, unitId, fields)` — send caller-provided user fields, no DB query
- [x] 5.2 Add `patchFeedbackResolution(client, id, fields)` — send caller-provided resolution fields, no DB query

## 6. Export and wire up server wrappers (`@rezics/server`)

- [x] 6.1 Export all new patch functions from `@rezics/search` package index
- [x] 6.2 Add server-side wrapper functions in `package/server/src/meili/content/sync.ts` for content patch functions
- [x] 6.3 Add server-side wrapper functions in `package/server/src/meili/post/sync.ts` for post patch functions
- [x] 6.4 Add server-side wrapper functions in `package/server/src/meili/realm/sync.ts` for realm patch functions
- [x] 6.5 Add server-side wrapper functions in `package/server/src/meili/user/sync.ts` for user patch function
- [x] 6.6 Add server-side wrapper function in `package/server/src/meili/feedback/sync.ts` for feedback patch function

## 7. Update service-layer call sites (`@rezics/server`)

- [x] 7.1 `tag.service.ts` — replace `syncContentToMeili(unitId)` with `patchContentTagsToMeili(unitId)` in `attachToUnit` and `detachFromUnit`
- [x] 7.2 `attribution.service.ts` — replace `syncContentToMeili(unitId)` with `patchContentCreditsToMeili(unitId)` in `linkPersonCredit`, `unlinkPersonCredit`, `linkOrgCredit`, `unlinkOrgCredit`
- [x] 7.3 `translation.service.ts` — replace `syncContentToMeili(unitId)` / `syncRealmToMeili(unitId)` with `patchContentTranslationsToMeili(unitId)` / `patchRealmTranslationsToMeili(unitId)`, and replace `syncPostsByTargetToMeili(unitId)` with `patchPostsTargetToMeili(unitId)`
- [x] 7.4 `realm.service.ts` — replace `syncRealmToMeili()` with `patchRealmMetadataToMeili()` in `update`, `patchRealmMemberCountToMeili()` in `joinRealm`/`removeMember`, and replace `syncContentToMeili()` with `patchContentRealmIdsToMeili()` / `patchContentRealmTagKeysToMeili()` in realm-unit and realm-tag operations
- [x] 7.5 `book.service.ts` — replace `syncContentToMeili(unitId)` with `patchContentMetadataToMeili(unitId, fields)` in `update` (keep full sync for `create`)
- [x] 7.6 `unit.service.ts` — replace `syncContentToMeili(unitId)` with `patchContentMetadataToMeili(unitId, fields)` in `update` (keep full sync for `create`)
- [x] 7.7 `user.service.ts` — replace `syncUserToMeili(unitId)` with `patchUserFieldsToMeili(unitId, fields)` in `update`, and replace `syncPostsByAuthorToMeili(unitId)` with `patchPostsAuthorToMeili(unitId, fields)` (keep full sync for `create`/`provision`)
- [x] 7.8 `post.service.ts` — replace `syncPostToMeili(unitId)` with `patchPostFieldsToMeili(unitId, fields)` in `update` (keep full sync for `create` and `delete`)
- [x] 7.9 `feedback.service.ts` — replace `syncFeedbackToMeili(id)` with `patchFeedbackResolutionToMeili(id, fields)` in `setResolved` (keep full sync for `create`)

## 8. Validation

- [x] 8.1 Verify `@rezics/search` builds successfully (`bun run build` in `package/search`)
- [x] 8.2 Verify `@rezics/server` builds successfully (`bun run build` in `package/server`)
- [x] 8.3 Run existing tests (`bun test` in relevant packages) to ensure no regressions
