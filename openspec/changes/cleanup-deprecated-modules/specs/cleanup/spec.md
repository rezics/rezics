## REMOVED Requirements

### Requirement: Review module server code
**Reason**: The review module (`package/server/src/review/`) is deprecated and replaced by the post module (`package/server/src/post/`). It is not mounted in the server entry point, references non-existent Prisma enum values (`UnitType.REVIEW`, `UnitType.REMARK`, `UnitStatus.ACTIVE`), and imports contract types that no longer exist.
**Migration**: Use the post module with `PostKind.REVIEW` and `PostKind.REMARK` for review/remark functionality.

### Requirement: Readlist module server code
**Reason**: The readlist module (`package/server/src/readlist/`) is deprecated and replaced by the shelf module (`package/server/src/shelf/`). It is not mounted in the server entry point and references non-existent Prisma enum values (`UnitType.READLIST`, `UnitStatus.ACTIVE`).
**Migration**: Use the shelf module for list/collection functionality.

### Requirement: Deprecated review permission functions
**Reason**: `hasPermissionToUpdateReview` and `hasPermissionToDeleteReview` in `package/contract/src/permission/review.ts` are deprecated aliases with no consumers.
**Migration**: Use `hasPermissionToUpdatePost` and `hasPermissionToDeletePost` from `package/contract/src/permission/post.ts`.

### Requirement: Deprecated readlist permission functions
**Reason**: `hasPermissionToUpdateReadlist` and `hasPermissionToDeleteReadlist` in `package/contract/src/permission/readlist.ts` are deprecated aliases with no consumers.
**Migration**: Use `hasPermissionToUpdateShelf` and `hasPermissionToDeleteShelf` from `package/contract/src/permission/shelf.ts`.

## MODIFIED Requirements

### Requirement: Zero TypeScript type errors
Each package SHALL have zero TypeScript errors when running `tsc --noEmit` with its own `tsconfig.json`. After removal of the deprecated modules, no broken imports or references SHALL remain.

#### Scenario: Clean type check after deletion
- **WHEN** `tsc --noEmit` is run for `package/server` and `package/contract`
- **THEN** output reports 0 errors
- **AND** no references to deleted review or readlist modules exist

### Requirement: Zero biome lint errors
The codebase SHALL have zero biome lint errors after the deprecated modules are removed.

#### Scenario: Clean biome check after deletion
- **WHEN** `bunx biome check .` is run from the repo root
- **THEN** output reports 0 errors
