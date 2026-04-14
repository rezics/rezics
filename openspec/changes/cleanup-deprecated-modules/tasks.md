## 1. Delete deprecated server modules

- [x] 1.1 Delete `package/server/src/review/` directory entirely (api, service, mapper, types, index)
- [x] 1.2 Delete `package/server/src/readlist/` directory entirely (api, service, mapper, types, index)
- [x] 1.3 Remove any imports or re-exports of `reviewApi` or `readlistApi` from `package/server/src/` barrel files (verify `index.ts` has none)

## 2. Delete deprecated contract permission files

- [x] 2.1 Delete `package/contract/src/permission/review.ts`
- [x] 2.2 Delete `package/contract/src/permission/readlist.ts`
- [x] 2.3 Update `package/contract/src/permission/index.ts` (or barrel) to remove re-exports of deleted files
- [x] 2.4 Grep repo-wide for any remaining imports of `hasPermissionToUpdateReview`, `hasPermissionToDeleteReview`, `hasPermissionToUpdateReadlist`, `hasPermissionToDeleteReadlist` and remove them

## 3. Clean up related artifacts

- [x] 3.1 Delete `package/server/src/test/stress/readlist/` directory (k6 test targeting dead endpoint)
- [x] 3.2 Grep for any remaining references to `UnitType.REVIEW`, `UnitType.REMARK`, `UnitType.READLIST`, `UnitStatus.ACTIVE` across the codebase and remove/fix them

## 4. Verify

- [x] 4.1 Run `tsc --noEmit` for `package/server` — zero errors
- [x] 4.2 Run `tsc --noEmit` for `package/contract` — zero errors
- [x] 4.3 Run `bunx biome check .` from repo root — zero errors related to deleted modules
