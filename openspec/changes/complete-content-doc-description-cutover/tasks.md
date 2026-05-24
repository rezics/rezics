## 1. Contract Cutover

- [x] 1.1 Update remaining canonical rich-description input schemas in `package/contract/src/realm.ts`, `package/contract/src/shelf.ts`, and `package/contract/src/entity.ts` so `UnitTranslation.description` write payloads use `contentDocWriteSchema` or nullable variants instead of plain strings.
- [x] 1.2 Review all `description` fields in `package/contract/src` and confirm only canonical rich descriptions use `ContentDoc`; plain text fields such as `User.bio`, `UnitTranslation.summary`, tag batch snippets, link metadata, and zone DTO summaries remain strings.
- [x] 1.3 Update TypeScript call sites in `package/app`, `package/api`, and `package/server` that construct the changed payloads so user-entered markdown is wrapped with `markdownContentDoc()` before crossing canonical API boundaries.

## 2. Server Write Paths

- [x] 2.1 Update `package/server/src/realm/realm.service.ts`, `package/server/src/shelf/shelf.service.ts`, and `package/server/src/entity/entity.service.ts` so they never persist raw string values into `UnitTranslation.description`.
- [x] 2.2 Review `package/server/src/unit/unit.service.ts`, `package/server/src/unit/translation.service.ts`, `package/server/src/book/book.service.ts`, and `package/server/src/user/service/user.service.ts` to ensure their rich-description inputs are already `ContentDoc` or `null` at the boundary.
- [x] 2.3 Add a small server-local helper if useful for wrapping generated markdown strings into `ContentDoc` before Prisma JSON writes, and use it consistently for seed/bootstrap-only string sources.

## 3. Seed and Factory Data

- [x] 3.1 Update `package/server/prisma/factory/users.ts` so `FactoryUserPlan.description` is stored as `markdownContentDoc(plan.description)` or the plan type stores a `ContentDoc` directly.
- [x] 3.2 Update `package/server/prisma/factory/generators.ts` so generated translation descriptions are represented or converted as `ContentDoc` before persistence.
- [x] 3.3 Update all factory writers that persist `UnitTranslation.description` (`books`, `games`, `media`, `tags`, `entities`, `realms`, `shelves`, `zones`) to write `ContentDoc` or `null`.
- [x] 3.4 Update infrastructure seeds under `package/server/prisma/seed/infra/` so default realm and realm taxonomy descriptions write `ContentDoc` or `null`.
- [x] 3.5 Run a repo-wide search for direct writes of `description: <string>` into `User.description` or `UnitTranslation.description` and eliminate or intentionally wrap every remaining occurrence.

## 4. Data Repair and Search Sync

- [x] 4.1 Add an idempotent repair path for `User.description` JSON string values, wrapping non-empty strings into `ContentDoc` and converting empty strings to JSON null.
- [x] 4.2 Add the same idempotent repair path for `UnitTranslation.description` JSON string values.
- [x] 4.3 Decide whether the repair is delivered as a Prisma migration, a one-shot script, or both; document the operator command if a script is added.
- [x] 4.4 Ensure affected search projections can be refreshed after repair, either by invoking existing sync helpers or documenting the required reindex/resync command.

## 5. Tests and Verification

- [x] 5.1 Add focused contract or server tests proving `publicUserSchema`, `userDTOSchema`, and `unitTranslationDTOSchema` reject raw strings and accept seeded `ContentDoc` descriptions.
- [x] 5.2 Add server tests for `PostDTO.author.description` by mapping or serving a post whose author has a generated description and validating against `postListResponseSchema` or `postDTOSchema`.
- [x] 5.3 Add seed/factory tests or lightweight assertions that generated user and unit translation descriptions are `ContentDoc` values before persistence.
- [x] 5.4 Add repair tests for non-empty strings, empty strings, already-valid `ContentDoc`, and null descriptions.
- [x] 5.5 Run targeted tests for changed packages, including contract tests and server tests that cover post/user/unit translation DTO validation.
- [x] 5.6 Run `bun run check:convention` and any package-level type/test command required by the touched files.
