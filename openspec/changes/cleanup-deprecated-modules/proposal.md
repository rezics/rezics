## Why

The codebase contains two fully deprecated server modules (`review`, `readlist`) that are **not mounted** in the server entry point but still exist on disk. They reference phantom Prisma enum values (`UnitType.REVIEW`, `UnitType.REMARK`, `UnitType.READLIST`, `UnitStatus.ACTIVE`) that do not exist in the schema, import contract types that were removed, and use deprecated permission functions. These modules are dead code that confuses the codebase and cannot even compile against the current Prisma client. Their replacements (`post` and `shelf` modules) are fully operational.

Additionally, the deprecated permission aliases in `@rezics/contract` (`hasPermissionToUpdateReview`, `hasPermissionToDeleteReview`, `hasPermissionToUpdateReadlist`, `hasPermissionToDeleteReadlist`) serve no consumers and should be removed.

## What Changes

- **BREAKING**: Delete `package/server/src/review/` module entirely (api, service, mapper, types, index)
- **BREAKING**: Delete `package/server/src/readlist/` module entirely (api, service, mapper, types, index)
- Remove deprecated permission functions from `@rezics/contract` (`permission/review.ts`, `permission/readlist.ts`)
- Remove any re-exports of deleted modules from barrel files
- Clean up the k6 stress test referencing the old readlist endpoint
- Verify no other code imports from these modules

## Capabilities

### New Capabilities

_(none — this is a removal-only change)_

### Modified Capabilities

- `cleanup`: Extends existing cleanup spec — the removal of these modules must not introduce lint or type errors

## Impact

- **`package/server`**: Two module directories deleted, no runtime change (modules were not mounted)
- **`package/contract`**: Two permission files deleted, barrel re-exports updated
- **No API changes**: These endpoints were already unreachable
- **No frontend changes**: No frontend code references these modules
- **No database changes**: No schema modifications needed
