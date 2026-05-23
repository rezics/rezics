## 1. Contract Schema

- [x] 1.1 Add `UnitRef` and `ContentBlock` primitive types to `package/contract`.
- [x] 1.2 Add `contentDocSchema` with `schema`, `version`, `main`, `slots`, `layout` and exported TypeScript types.
- [x] 1.3 Add slot family schemas: `unit-ref`, `entity-list`, `infobox`, plus a preserving `unknown` slot type. Export TypeScript discriminated union `Slot`.
- [x] 1.4 Add inline directive grammar definition (CommonMark directive `:::slot{id="..."}` block + `:slot[...]{...}` inline). The grammar is a contract; the parser is in the follow-up rendering change.
- [x] 1.5 Add `scanRefs(doc)` declarative reference walker. Cover all v1 slot shapes; document the extension point for new slot types.
- [x] 1.6 Add `extractText(doc)` text projection helper. Cover `main` markdown source and every v1 slot type's text-bearing fields.
- [x] 1.7 Update post and chapter contracts to expose `content: ContentDoc` and remove `body` write/read shapes.
- [x] 1.8 Update `UnitTranslation` and user-profile contracts so `description` is a `ContentDoc` (or null). Keep `summary` and `bio` as plain strings.
- [x] 1.9 Add contract/helper tests for: preferred valid ContentDoc; preferred-shape reporting for invalid schema/version and inline+layout mutual exclusivity; unit refs; unsupported slot preservation; `scanRefs` dedup and grouping; `extractText` coverage across slot types. These tests SHALL NOT imply recursive server write validation.

## 2. Database And Prisma

- [x] 2.1 Add Prisma JSON columns: `Post.content Json?`. Change `UnitTranslation.description String?` → `Json?`. Change `User.description String?` → `Json?`. `UnitTranslation.summary` and `User.bio` are not touched.
- [x] 2.2 Write a development migration that wraps existing string values as `ContentDoc.main = { type: "markdown", source: <old string> }`; empty strings migrate to JSON `null`.
- [x] 2.3 Remove `Post.body` from the Prisma schema after migration data is copied.
- [x] 2.4 Run `bun --filter=@rezics/server run prisma:generate`.

## 3. Server Cutover

- [x] 3.1 Update post create/update services to accept and persist full opaque JSON for `content`; remove legacy string `body` write paths without recursively validating `ContentDoc` semantics. Runtime behavior only interprets `content.main`.
- [x] 3.2 Update chapter create/update/materialization services to read and write post content documents instead of `body` strings.
- [x] 3.3 Update post and chapter mappers to return `content: ContentDoc` and remove body string mapping (`Post.body`, `noContent: !post.body`, etc.).
- [x] 3.4 Update Unit translation and user profile services to accept and persist opaque JSON for rich `description`; remove string-only description write paths without recursively validating `ContentDoc` semantics.
- [x] 3.5 Update wiki collaborative edit endpoints to accept full `ContentDoc` JSON, persist it as submitted, and derive supported edit behavior only from structural comparison of stored vs submitted `content.main`.
- [x] 3.6 Repo-wide grep for `post.body`, `\.body`, `body:`, `description:` in post / chapter / wiki / description contexts and migrate all internal usages. Expect the server to not typecheck again until this task finishes.
- [x] 3.7 Update seed factories (`seed:factory`, `seed:factory:fast`) and shared fixtures to emit `ContentDoc` for posts, chapters, wikis, and rich descriptions.

## 4. Content Hydration And Extraction Helpers

- [x] 4.1 Keep `scanRefs` exported from contract but do NOT wire slot/reference hydration into post / chapter / wiki / description runtime paths in this change.
- [x] 4.2 Keep `extractText` exported from contract; runtime content sync / full reindex derives text from supported `main` Markdown only.
- [x] 4.3 Do NOT add slot rendering, hydration UI, directive parsing, or per-slot components in this change. Those are in the follow-up rendering change. Leave a `// FOLLOWUP:` marker at the read site if a temporary minimal renderer is unavoidable.

## 5. Meilisearch Projection

- [x] 5.1 Update content sync / full reindex to derive `contentText` and `descriptionText` from supported `content.main.source` / `description.main.source` only.
- [x] 5.2 Update content index searchable attributes to include `contentText` and `descriptionText` in the specified priority order (`titles`, `subtitles`, `contentText`, `descriptionText`, `descriptions`, `summaries`, `creditNames`, `tagLabels`, `subjectNames`).
- [x] 5.3 Confirm no PostgreSQL column named `contentText` or `descriptionText` exists. Add a convention check or comment so future contributors do not add one.
- [x] 5.4 Add targeted Meili projection tests proving `main` markdown is indexed and slot/layout text is ignored by runtime v1.

## 6. Editorial PATCH Integration

- [x] 6.1 Precondition: confirm `replace-field-key-with-patch-paths` is archived. Lock, history, and `changedFieldKeys` semantics for `post.content` PATCH paths come from that change; this change does not modify the editorial protocol.
- [x] 6.2 Update post / chapter / wiki / description PATCH input schemas so the canonical PATCH paths use `content` (and `description`) sub-trees consistent with the path vocabulary. Reviewers SHALL confirm no parallel paths exist for the same logical field.
- [x] 6.3 Add an integration test proving that an editorial PATCH on `post.content.main.source` flows through the path-based lock and history protocol exactly like any other PATCH path.

## 7. Validation

- [ ] 7.1 Run package-level tests for `package/contract`, `package/server`, `package/history`, `package/api`, and affected `package/app` features.
- [x] 7.2 Run `bun run check:convention`.
- [x] 7.3 Run `bun run format:check`.
- [ ] 7.4 Run `bun run knip` and confirm no orphan exports were introduced or left behind by the body → content rename.
- [ ] 7.5 Run a local Meilisearch resync smoke test and verify `contentText` / `descriptionText` appear only in search documents.
- [ ] 7.6 Run a browser smoke test for post rendering, chapter detail rendering, wiki view, profile description rendering, and Unit translation description rendering. Confirm renderer fallback by manually feeding a malformed value through a dev fixture (e.g. raw string in `Post.content`) and observing markdown fallback rather than a crash.
