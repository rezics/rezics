## 1. Contract Schema

- [ ] 1.1 Add `UnitRef` and `ContentBlock` primitive types to `package/contract`.
- [ ] 1.2 Add `contentDocSchema` with `schema`, `version`, `main`, `slots`, `layout` and exported TypeScript types.
- [ ] 1.3 Add slot family schemas: `unit-ref`, `entity-list`, `infobox`, plus a preserving `unknown` slot type. Export TypeScript discriminated union `Slot`.
- [ ] 1.4 Add inline directive grammar definition (CommonMark directive `:::slot{id="..."}` block + `:slot[...]{...}` inline). The grammar is a contract; the parser is in the follow-up rendering change.
- [ ] 1.5 Add `scanRefs(doc)` declarative reference walker. Cover all v1 slot shapes; document the extension point for new slot types.
- [ ] 1.6 Add `extractText(doc)` text projection helper. Cover `main` markdown source and every v1 slot type's text-bearing fields.
- [ ] 1.7 Update post and chapter contracts to expose `content: ContentDoc` and remove `body` write/read shapes.
- [ ] 1.8 Update `UnitTranslation` and user-profile contracts so `description` is a `ContentDoc` (or null). Keep `summary` and `bio` as plain strings.
- [ ] 1.9 Update field-key constants: introduce `post.content`, `post.content.main`, `post.content.slots.<slotId>`, `post.content.layout`. Remove `post.body` from new constant exports.
- [ ] 1.10 Add contract tests for: valid ContentDoc; invalid schema/version (write-boundary rejection); unit refs; unsupported slot preservation; `scanRefs` dedup and grouping; `extractText` coverage across slot types; inline+layout mutual exclusivity at write time.

## 2. Database And Prisma

- [ ] 2.1 Add Prisma JSON columns: `Post.content Json?`. Change `UnitTranslation.description String?` → `Json?`. Change `User.description String?` → `Json?`. `UnitTranslation.summary` and `User.bio` are not touched.
- [ ] 2.2 Write a development migration that wraps existing string values as `ContentDoc.main = { type: "markdown", source: <old string> }`; empty strings migrate to JSON `null`.
- [ ] 2.3 Remove `Post.body` from the Prisma schema after migration data is copied.
- [ ] 2.4 Run `bun --filter=@rezics/server run prisma:generate`.

## 3. Server Cutover

- [ ] 3.1 Update post create/update services to accept and persist `ContentDoc` for `content`. Reject string bodies at the input contract.
- [ ] 3.2 Update chapter create/update/materialization services to read and write post content documents instead of `body` strings.
- [ ] 3.3 Update post and chapter mappers to return `content: ContentDoc` and remove body string mapping (`Post.body`, `noContent: !post.body`, etc.).
- [ ] 3.4 Update Unit translation and user profile services to accept and persist `ContentDoc` for `description`. Reject string descriptions at the input contract.
- [ ] 3.5 Update wiki collaborative edit checks to use `post.content` / `post.content.main` / `post.content.slots.<slotId>` field keys.
- [ ] 3.6 Repo-wide grep for `post.body`, `\.body`, `body:`, `description:` in post / chapter / wiki / description contexts and migrate all internal usages. Expect the server to not typecheck again until this task finishes.
- [ ] 3.7 Update seed factories (`seed:factory`, `seed:factory:fast`) and shared fixtures to emit `ContentDoc` for posts, chapters, wikis, and rich descriptions.

## 4. Content Hydration And Extraction Helpers

- [ ] 4.1 Wire `scanRefs` into post / chapter / wiki / description API hydration paths so referenced Unit ids are returned in a batchable form for downstream callers.
- [ ] 4.2 Wire `extractText` into content sync / full reindex code that builds Meilisearch documents.
- [ ] 4.3 Do NOT add slot rendering, hydration UI, directive parsing, or per-slot components in this change. Those are in the follow-up rendering change. Leave a `// FOLLOWUP:` marker at the read site if a temporary minimal renderer is unavoidable.

## 5. Meilisearch Projection

- [ ] 5.1 Update content sync / full reindex to derive `contentText` via `extractText(content)` and `descriptionText` via `extractText(description)`.
- [ ] 5.2 Update content index searchable attributes to include `contentText` and `descriptionText` in the specified priority order (`titles`, `subtitles`, `contentText`, `descriptionText`, `descriptions`, `summaries`, `creditNames`, `tagLabels`, `subjectNames`).
- [ ] 5.3 Confirm no PostgreSQL column named `contentText` or `descriptionText` exists. Add a convention check or comment so future contributors do not add one.
- [ ] 5.4 Add targeted Meili projection tests over fixtures that include `main` markdown, an infobox slot, and an entity-list slot.

## 6. History And Authority

- [ ] 6.1 Update history outbox writers so the `post` editorial revision slot carries the full `ContentDoc` payload. Remove any code path that emits a legacy body string into the slot.
- [ ] 6.2 Update history outbox `changedFieldKeys` emission to use content sub-paths (`post.content`, `post.content.main`, `post.content.slots.<slotId>`, `post.content.layout`). Remove `post.body` from new emissions.
- [ ] 6.3 Update history service / API client compare / restore helpers so the `post` slot is treated as a `ContentDoc`. Restore = write the stored `ContentDoc` back into `Post.content`.
- [ ] 6.4 Update authority lock checks: replace `post.body` lock-key wiring with `post.content`, `post.content.main`, and `post.content.slots.<slotId>` checks. The `*` whole-Unit lock is unchanged.
- [ ] 6.5 Update history-service and authority tests so no test depends on `post.body`.

## 7. Validation

- [ ] 7.1 Run package-level tests for `package/contract`, `package/server`, `package/history`, `package/api`, and affected `package/app` features.
- [ ] 7.2 Run `bun run check:convention`.
- [ ] 7.3 Run `bun run format:check`.
- [ ] 7.4 Run `bun run knip` and confirm no orphan exports were introduced or left behind by the body → content rename.
- [ ] 7.5 Run a local Meilisearch resync smoke test and verify `contentText` / `descriptionText` appear only in search documents.
- [ ] 7.6 Run a browser smoke test for post rendering, chapter detail rendering, wiki view, profile description rendering, and Unit translation description rendering. Confirm renderer fallback by manually feeding a malformed value through a dev fixture (e.g. raw string in `Post.content`) and observing markdown fallback rather than a crash.
