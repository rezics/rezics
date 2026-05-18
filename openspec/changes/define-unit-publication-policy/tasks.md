## 1. Contract and Schema

- [ ] 1.1 Add a license registry module in `package/contract/src` with stable license slugs, labels/URLs where appropriate, and a `licenseSlugSchema`.
- [ ] 1.2 Export publication metadata schemas for Unit DTOs and publishable create/update inputs without changing existing `isLicensed` semantics.
- [ ] 1.3 Extend `UserSettings` in `package/contract/src/user.ts` with an optional publishing default license slug and validation tests.
- [ ] 1.4 Extend realm extra/settings contract with an optional advisory default license slug and validation tests.
- [ ] 1.5 Add Prisma schema support for Unit publication metadata (`licenseSlug` and optional copyright notice, or an equivalent Unit-owned structure).
- [ ] 1.6 Generate and review the Prisma migration, including a nullable/backward-compatible rollout path.

## 2. Server Publication Policy

- [ ] 2.1 Add server-side license validation and publication metadata mapping for Unit-backed DTOs.
- [ ] 2.2 Add a shared public eligibility helper for `status=PUBLISHED` and `visibility=PUBLIC` in server code.
- [ ] 2.3 Apply the eligibility helper to public Unit, Book, Shelf, and relevant domain list/detail queries where public discovery is intended.
- [ ] 2.4 Update create/update paths for supported publishable Unit types to persist validated publication metadata.
- [ ] 2.5 Keep Book/Game/Media `isLicensed` filters and mappers unchanged except for tests proving separation from license slug.

## 3. Post Deletion and Visibility

- [ ] 3.1 Update post DTO mapping to expose status/visibility/publication metadata only where the contract requires it.
- [ ] 3.2 Ensure ordinary post lists exclude `UnitStatus.DELETED` and any non-public backing Units for public callers.
- [ ] 3.3 Update direct post detail reads so deleted posts return not-found/gone for public ordinary detail requests.
- [ ] 3.4 Add tombstone DTO behavior for tree/reference paths that need deleted posts to preserve thread structure.
- [ ] 3.5 Keep `kind=POST` visibility controls absent from create/update contract and app composer UI.
- [ ] 3.6 If review-like post visibility is implemented in this change, constrain it to root/thread-level behavior and make replies inherit root visibility.
- [ ] 3.7 Add server tests for deletion, ordinary detail, list exclusion, threaded tombstones, and permission behavior.

## 4. Shelf Discovery and Collection State

- [ ] 4.1 Update `ShelfService.buildWhere` or equivalent public list path to filter public shelf discovery by `status=PUBLISHED` and `visibility=PUBLIC`.
- [ ] 4.2 Preserve owner-authorized shelf reads so a user can still see their private system shelves.
- [ ] 4.3 Replace app shelf preview usage of `containsItemRef` with `containsUnitId`.
- [ ] 4.4 Add regression tests proving book shelf previews and `/shelf/book/:bookId` only return public shelves containing the target Unit.
- [ ] 4.5 Add tests proving another user's Favorites shelf does not appear in public book shelf previews.

## 5. Search and Sync

- [ ] 5.1 Update content sync eligibility so full and single-content sync add only `PUBLISHED + PUBLIC` Units and delete ineligible documents.
- [ ] 5.2 Audit content partial sync functions (`patchContent*`, containedUnitIds sync, realm/tag patches) and route eligibility-sensitive cases through a safe sync/delete path.
- [ ] 5.3 Update post sync so non-public or deleted backing Units are removed from the post index.
- [ ] 5.4 Add tests in `package/search` for private/deleted content and post removal behavior.
- [ ] 5.5 Add or update server Meili filter tests proving public search remains public-only and `isLicensed` still uses the licensed-work field.

## 6. Frontend Defaults and Display

- [ ] 6.1 Add API client exports for license registry and publication metadata types where frontend packages need them.
- [ ] 6.2 Add user settings UI/API handling for default publishing license if settings preferences expose this control now.
- [ ] 6.3 Add realm default license handling where realm settings/editing surfaces expose realm publishing defaults now.
- [ ] 6.4 Add composer default resolution helper: platform default, user default, active realm default, explicit selection.
- [ ] 6.5 Add license selection UI only to supported publishable composer/edit flows; keep generic `kind=POST` without visibility controls.
- [ ] 6.6 Add display treatment for stored license metadata on relevant Unit detail surfaces.

## 7. Migration and Backfill

- [ ] 7.1 Backfill existing publishable Units with `all-rights-reserved` where API output requires a non-null effective license.
- [ ] 7.2 Add a one-off or documented operational step to remove ineligible documents from Meilisearch after deployment.
- [ ] 7.3 Document that existing `isLicensed` data does not migrate to publication license metadata.

## 8. Verification

- [ ] 8.1 Run `bun -F @rezics/contract test` or targeted contract tests for license/user/realm schemas.
- [ ] 8.2 Run targeted server tests for post, shelf, and publication policy changes.
- [ ] 8.3 Run targeted `package/search` tests for content/post sync eligibility.
- [ ] 8.4 Run `bun -F @rezics/app tsc --noEmit` or the repo's accepted app type-check path after public API/type changes.
- [ ] 8.5 Run `bun run check:convention` and document any pre-existing baseline violations separately from this change.
- [ ] 8.6 Manually verify the book review page shelf preview no longer shows private Favorites shelves and only shows shelves containing the target book.
