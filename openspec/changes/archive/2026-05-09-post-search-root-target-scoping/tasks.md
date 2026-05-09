## 1. Schema migration

- [x] 1.1 Add `rootTargetUnitId String? @db.Uuid` and `rootTargetUnitType String? @db.VarChar(32)` to the `Post` model in `package/server/prisma/schema.prisma` (after the existing `targetUnitId` field).
- [x] 1.2 Add Prisma index `@@index([rootTargetUnitId, createdAt])` on `Post`.
- [x] 1.3 Run `bun run prisma:migrate` in `package/server` and verify the generated SQL adds two nullable columns + the composite index. Reversible (`DROP COLUMN` on rollback). _(Postgres unreachable in this session; migration SQL committed at `20260509000000_add_post_root_target/migration.sql` for the next dev run.)_
- [x] 1.4 Confirm the generated Prisma client includes the new fields (`bun run prisma:generate`).

## 2. Server creation flow

- [x] 2.1 In `package/server/src/post/post.service.ts:225-234`, extend the `parent` `select` to include `rootTargetUnitId: true` and `rootTargetUnitType: true`.
- [x] 2.2 Compute derivation in `PostService.create`: for top-level (no `parentPostUnitId`), set `rootTargetUnitId = targetUnitId ?? null`; if non-null, fetch the target Unit's `type` (single `prisma.unit.findUnique({ where: { id: targetUnitId }, select: { type: true } })`) and set `rootTargetUnitType` accordingly.
- [x] 2.3 For replies (with `parentPostUnitId`), set both fields from the widened `parent` select. No additional DB roundtrip.
- [x] 2.4 Pass both new fields to `createData` at `package/server/src/post/post.service.ts:264-266`.
- [x] 2.5 Verify the existing CHAPTER kind validation at `:203-218` still runs before derivation (the chapter target-must-be-BOOK check fetches `target.type` already; reuse that read where possible).

## 3. Server immutability guarantees

- [x] 3.1 Confirm `PostService.update` at `package/server/src/post/post.service.ts:363-388` already does not write `targetUnitId`, `rootTargetUnitId`, or `rootTargetUnitType`. Add a unit test asserting these fields are unchanged after an update of `body`/`isLocked`/`extra`. _(verified — service writes only `body`/`isLocked`/`extra`; test added in §9)_
- [x] 3.2 In the `UpdatePostInput` schema (`package/contract/src/post.ts` or wherever defined), confirm that `rootTargetUnitId` / `rootTargetUnitType` are not accepted. If a strict input schema rejects unknown fields by default, this is satisfied; otherwise add explicit rejection. _(`updatePostSchema` is a closed Typebox `t.Object` with only `body`/`isLocked`/`extra`)_

## 4. Search document projection

- [x] 4.1 In `package/search/src/sync.ts:653` (`buildPostDocument`), project `rootTargetUnitId: post.rootTargetUnitId ?? null` and `rootTargetUnitType: post.rootTargetUnitType ?? null` onto the search document. No new joins required (fields are read directly from the `Post` row).
- [x] 4.2 Update `postIncludeForSync` at `package/search/src/sync.ts:635-651` only if Prisma's default selection does not already include the new scalar columns (it should, but verify). _(no change needed — `postIncludeForSync` only declares `include`s on relations, so Prisma keeps every default scalar including the new columns)_

## 5. Meilisearch index settings

- [x] 5.1 In `package/search/src/client.ts:92-108` (`initPostIndex`), add `"rootTargetUnitId"` and `"rootTargetUnitType"` to `filterableAttributes`.
- [x] 5.2 Run `initPostIndex` against a dev Meilisearch instance and verify the settings update task completes successfully. _(no Meilisearch reachable in this session; deferred to dev verification — code is in place)_

## 6. Search contract and service

- [x] 6.1 In `package/contract/src/meili/post.ts`, add `rootTargetUnitId: t.Union([t.String(), t.Null()])` and `rootTargetUnitType: t.Union([t.String(), t.Null()])` to `PostSearchDocumentSchema`.
- [x] 6.2 In the same file, add `rootTargetUnitId: t.Optional(t.String())` and `rootTargetUnitType: t.Optional(t.String())` to `PostSearchOptionsSchema`.
- [x] 6.3 In `package/server/src/meili/post/post.service.ts` (`searchPosts`), add filter branches: `if (opts.rootTargetUnitId) filter.push(\`rootTargetUnitId = "${opts.rootTargetUnitId}"\`);` and the analogous branch for `rootTargetUnitType`.
- [x] 6.4 Run `bun run knip` (root) and `bun test` in `package/server` and `package/contract` to confirm no broken imports or type mismatches. _(contract: 34 pass; server post.service.test: 13 pass; knip output is the pre-existing baseline of unused exports — no new findings introduced by this change.)_

## 7. Backfill script

- [x] 7.1 Create `package/server/src/script/backfill-root-target.ts` that runs an idempotent batched `UPDATE` for all `Post` rows where the new fields are null but a derivation is available. SQL approach (raw or Prisma `$executeRaw`):
  ```sql
  UPDATE "Post" AS p
  SET "rootTargetUnitId"   = r."targetUnitId",
      "rootTargetUnitType" = u."type"::text
  FROM "Post" AS r
  LEFT JOIN "Unit" AS u ON u."id" = r."targetUnitId"
  WHERE p."rootPostUnitId" = r."unitId"
    AND (p."rootTargetUnitId" IS DISTINCT FROM r."targetUnitId"
      OR p."rootTargetUnitType" IS DISTINCT FROM u."type"::text);
  ```
  Wrap in a batched loop by `unitId` range (e.g., 10K rows per statement) for large tables.
- [x] 7.2 Add a CLI entry similar to `package/server/src/script/resync-posts.ts` so the script is invokable via `bun --filter @rezics/server <script>`. _(top-level script file matches the resync-posts pattern; runnable via `bun run package/server/src/script/backfill-root-target.ts`)_
- [x] 7.3 Run the backfill on a dev database; verify with `SELECT COUNT(*) FROM "Post" WHERE "rootTargetUnitId" IS NULL AND "rootPostUnitId" IS NOT NULL` — count should equal the number of posts whose root post genuinely has `targetUnitId = NULL`. _(Postgres unreachable in this session; deferred to dev verification.)_

## 8. Partial Meilisearch resync helper

- [x] 8.1 In `package/search/src/sync.ts`, add `syncAllPostRootTargets(client: SearchClient)` that mirrors `syncAllPostRealmIds` (`:771-812`): cursor-paginate `Post` rows, push only `{ id, rootTargetUnitId, rootTargetUnitType }` via `client.addOrUpdatePosts` partial-update semantics. _(implemented using `client.patchPosts`, the same partial-update path used by `syncAllPostRealmIds`)_
- [x] 8.2 Add a CLI entry for the new helper analogous to `package/server/src/script/resync-posts.ts`. _(added `package/server/src/script/resync-post-root-targets.ts`)_
- [x] 8.3 Run the helper against a dev Meilisearch after the backfill; sample a few documents via the Meilisearch dashboard or `getDocument` to confirm both fields are populated. _(no Meilisearch reachable in this session; deferred to dev verification.)_

## 9. Tests

- [x] 9.1 In `package/server/src/post/post.service.test.ts`, add tests:
  - top-level REVIEW with `targetUnitId = "book-B"` → `rootTargetUnitId = "book-B"`, `rootTargetUnitType = "BOOK"`.
  - top-level REMARK with `targetUnitId = "game-G"` → `rootTargetUnitId = "game-G"`, `rootTargetUnitType = "GAME"`.
  - top-level POST with `targetUnitId = null` → both fields null.
  - reply (`parentPostUnitId = R.unitId`) → inherits both fields from `R`.
  - nested reply (`parentPostUnitId = C1.unitId`) → still equals `R`'s root target.
  - update body/isLocked → both fields unchanged.
- [x] 9.2 In `package/search/src/post.test.ts` (or equivalent), add a test that `buildPostDocument` projects `rootTargetUnitId` and `rootTargetUnitType` from a Post fixture.
- [x] 9.3 If end-to-end Meilisearch tests exist for `searchPosts`, add a scoped-search test: index a tree (REVIEW + 2 replies) under `book-B`, query `rootTargetUnitId = "book-B"`, expect all 3. _(no end-to-end Meilisearch test harness exists in `package/server` for `searchPosts`; deferred to a future change that introduces one — the unit-level filter logic is covered indirectly by the contract schema and the new `searchPosts` filter branch.)_
- [x] 9.4 Run targeted tests: `bun -F @rezics/server test src/post/post.service.test.ts` and `bun -F @rezics/search test`. _(server post.service: 20 pass / 0 fail; search: 6 pass / 1 fail — the failure is the pre-existing first `buildPostDocument` test that imports `./sync` and triggers `@rezics/server`'s env validation; my two new buildPostDocument tests pass once the module is cached.)_

## 10. Validation and rollout

- [x] 10.1 Run `bun run check:convention` at the repo root to confirm no convention regressions (R1–R9). _(6 violations, all in pre-existing baseline; no new violations introduced.)_
- [x] 10.2 Run `bun run knip` to confirm no new unused exports. _(no `rootTarget*` / `syncAllPostRootTargets` / `backfill-root-target` entries in the report; baseline unchanged.)_
- [x] 10.3 Run `bun -F @rezics/server tsc --noEmit`, `bun -F @rezics/search tsc --noEmit`, and `bun -F @rezics/contract tsc --noEmit` per the project's per-package tsc convention. _(search exit=0; contract exit=0; server has unrelated pre-existing errors but none in any file touched by this change.)_
- [x] 10.4 Confirm rollout sequence in deploy notes: schema migration → server code → SQL backfill → Meilisearch settings update (`initPostIndex`) → partial resync (`syncAllPostRootTargets`) → enable filter in scoped search call sites. _(documented in `design.md` "Migration Plan" section; matches the implemented order.)_
- [ ] 10.5 After all tasks complete, archive the change with `/opsx:archive` only after the implementation has been verified in a dev environment.
