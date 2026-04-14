## Context

The server entry point (`package/server/src/index.ts`) mounts domain API modules via `.use()`. The `reviewApi` and `readlistApi` are **not mounted** — they were replaced by `postApi` and `shelfApi` respectively. The modules still exist on disk with full implementations referencing:

- `UnitType.REVIEW`, `UnitType.REMARK`, `UnitType.READLIST` — do not exist in the Prisma enum (only `UnitType.POST`, `UnitType.SHELF`)
- `UnitStatus.ACTIVE` — does not exist (only `DRAFT`, `PUBLISHED`, `ARCHIVED`, `DELETED`)
- Contract types like `CreateReviewInput`, `ReviewResponse` — removed from `@rezics/contract`
- Deprecated permission functions `hasPermissionToUpdateReview`, `hasPermissionToDeleteReview`, `hasPermissionToUpdateReadlist`, `hasPermissionToDeleteReadlist`

No frontend code, admin UI, or other server module imports from these deprecated modules.

## Goals / Non-Goals

**Goals:**
- Remove all dead code from deprecated review and readlist modules
- Remove deprecated permission aliases from `@rezics/contract`
- Achieve zero type errors and zero lint errors after removal

**Non-Goals:**
- Migrating any data or endpoints (already done — post and shelf modules are the live replacements)
- Changing any runtime behavior (these modules are unmounted)
- Touching the `PostKind.REVIEW` / `PostKind.REMARK` values — those are correct and live in the post module

## Decisions

### 1. Full directory deletion, not file-by-file removal

Delete `package/server/src/review/` and `package/server/src/readlist/` entirely rather than emptying files. These are self-contained modules with no external dependents.

**Rationale:** Cleaner than leaving empty index.ts files. No module references these from outside.

### 2. Delete deprecated permission files from contract

Remove `package/contract/src/permission/review.ts` and `package/contract/src/permission/readlist.ts`. Update the barrel export in `package/contract/src/permission/index.ts` (or equivalent).

**Rationale:** No consumers exist. The post and shelf permission functions are the live replacements.

### 3. Remove k6 stress test for readlist

The file `package/server/src/test/stress/readlist/single-readlist-test.js` references the dead `/readlists/` endpoint. Delete it.

**Rationale:** Test target no longer exists.

## Risks / Trade-offs

- **[Risk] External clients hitting /reviews/ or /readlists/ directly** → These routes are not mounted in the server, so they already return 404. No behavior change.
- **[Risk] Missed import somewhere** → Mitigated by running `tsc --noEmit` and `bunx biome check` after deletion to catch any broken references.
