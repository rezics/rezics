## 1. Schema & migration (server)

- [x] 1.1 Add `path Unsupported("ltree")?` to `Post` in `package/server/prisma/schema.prisma`; remove `sortPath` and its `@@index` entries; keep `rootPostUnitId` btree index and `depth`.
- [x] 1.2 Create the migration with Prisma's `--create-only` flow but give it a `manual_` name (for example `manual_redesign_post_ltree_index`) so it is distinct from mechanical Prisma-generated migrations. Author the raw SQL by hand: `CREATE EXTENSION IF NOT EXISTS ltree`, create the label `BIGSERIAL` sequence, add the `path` ltree column (nullable), and create the raw-owned `GIST (path)` index. Do not model this GiST index as a normal Prisma-managed `@@index([path], type: Gist)`.
- [x] 1.3 Add the backfill step (in-migration or one-shot script invoked by it): BFS posts by `(parentPostUnitId, createdAt)`, mint a base36 label per node, write `path = parent.path || label` (roots get a single label).
- [x] 1.4 Add post-backfill validation: assert `nlevel(path) = depth + 1`, unique paths, subtree/`replyCount` consistency; fail the migration on mismatch.
- [x] 1.5 Add the final drop-column migration for `Post.sortPath` (sequenced after code cutover so rollback before it is code-only).
- [x] 1.6 Run `bun --filter=@rezics/server run prisma:generate`, then run a second no-op migrate/diff check and confirm Prisma 7.8.0 accepts `Unsupported("ltree")` and does not try to drop/recreate the raw-owned extension, sequence, or GiST index. Also confirm the local source Postgres container includes `ltree` extension files; if not, update the source Postgres image/build used by `tool/external-services/compose.yml`. Do not add a non-ltree compatibility fallback.

## 2. Service: path generation & queries (server)

- [x] 2.1 Replace `generateSortPath` with append-only `generatePath(parentPostUnitId)` using the label sequence via `$queryRaw`/`$executeRaw`; no read-max-then-write.
- [x] 2.2 Update `PostService.create` to write `path` (root = single label; reply = parent.path || label) and keep `depth`/counters; preserve the single parent-read that also derives `rootTargetUnitId`/`rootTargetUnitType`.
- [x] 2.3 Rewrite whole-thread reads in `list`/`byRealm` to bound by `rootPostUnitId` and order by a DB key (`createdAt`); remove all `sortPath` ordering.
- [x] 2.4 Rewrite the `subtreeRootPostUnitId` path to use `path <@ anchor.path` (scoped to `rootPostUnitId`) with `depth <= anchor.depth + maxDepth`; drop the `sortPath startsWith` branch and its 400-error guard.
- [x] 2.5 Audit `delete` and tombstone-in-tree behavior against `path`/`rootPostUnitId` (no `sortPath` dependence).

## 3. Contract & mapper

- [x] 3.1 Remove `sortPath` from `PostDTO` and any list-query field that ordered by it in `package/contract/src/post.ts`; ensure ordering remains DB-expressible.
- [x] 3.2 Update `package/server/src/post/post.mapper.ts` and `types.ts` to stop projecting `sortPath` and to carry `path`/`depth` as needed for the tree.

## 4. App rendering

- [x] 4.1 Rewrite `package/app/src/post/models/postTreeRails.ts` ancestor/descendant helpers to derive structure from `path`/`depth` (or server-provided tree) instead of `sortPath` prefix math.
- [x] 4.2 Update thread views / mocks (`package/app/src/mocks/handlers/post.ts`, any `sortPath` consumers) to the new fields.

## 5. Tests & verification

- [x] 5.1 Update `post.service.test.ts` / `post.mapper.test.ts` for append-only path generation, whole-thread vs partial-subtree queries, and concurrent-reply distinct paths.
- [x] 5.2 Add a migration/backfill test asserting `nlevel(path) = depth + 1` and subtree consistency on a seeded tree.
- [x] 5.3 Run `bun run check:convention`, `bun run knip`, `bun test` in `@rezics/server`, `@rezics/contract`, `@rezics/app`; grep the repo to confirm zero remaining `sortPath` references.
