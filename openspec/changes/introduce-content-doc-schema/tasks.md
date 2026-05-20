## 1. Contract Schema

- [ ] 1.1 Add `contentDocSchema`, block schemas, slot schemas, layout schemas, and exported TypeScript types to `package/contract`.
- [ ] 1.2 Update post and chapter contracts to expose `content: ContentDoc` and remove `body` / `content` string write shapes.
- [ ] 1.3 Add rich description contract fields where required and keep summary/bio fields as plain strings.
- [ ] 1.4 Update field-key constants to replace `post.body` with content document field keys.
- [ ] 1.5 Add contract tests for valid ContentDoc, invalid schema/version, unit refs, and unsupported slot preservation.

## 2. Database And Prisma

- [ ] 2.1 Add Prisma JSON columns for canonical post content and rich description content.
- [ ] 2.2 Write a development migration that wraps existing `Post.body` values as `ContentDoc.main` Markdown payloads.
- [ ] 2.3 Remove `Post.body` from the Prisma schema after migration data is copied.
- [ ] 2.4 Run `bun --filter=@rezics/server run prisma:generate`.

## 3. Server Cutover

- [ ] 3.1 Update post create/update services to accept and persist `ContentDoc`.
- [ ] 3.2 Update chapter create/update/materialization services to read and write post content documents.
- [ ] 3.3 Update post and chapter mappers to return content documents and remove body string mapping.
- [ ] 3.4 Update wiki collaborative edit checks to use content field keys.
- [ ] 3.5 Repo-wide grep for `post.body`, `.body`, and `body:` callsites in post/chapter contexts and migrate all internal usages.

## 4. Content Rendering And Hydration

- [ ] 4.1 Add shared ContentDoc rendering helpers in the app layer using existing Markdown renderer primitives.
- [ ] 4.2 Add ContentDoc reference scanning utilities that return deduplicated Unit refs grouped by type when available.
- [ ] 4.3 Update post, chapter, wiki, and profile description surfaces to render ContentDoc.
- [ ] 4.4 Update editors/forms to save Markdown source into ContentDoc main blocks.
- [ ] 4.5 Add restricted/deleted/unsupported slot placeholders for unavailable referenced Units and unknown slot types.

## 5. Meilisearch Projection

- [ ] 5.1 Add ContentDoc text extraction helpers for Markdown main blocks and supported slots.
- [ ] 5.2 Update content sync/full reindex to derive `contentText` and `descriptionText` directly from canonical JSON and hydrated referenced Units.
- [ ] 5.3 Update content index searchable attributes to include `contentText` and `descriptionText` in the specified priority order.
- [ ] 5.4 Add targeted tests for Meili projection without any PostgreSQL `contentText` or `descriptionText` source column.

## 6. History And Authority

- [ ] 6.1 Update history outbox writers to store ContentDoc snapshots in editorial revision slots.
- [ ] 6.2 Update history service DTO handling and tests to preserve `ContentDoc.schema` and `ContentDoc.version`.
- [ ] 6.3 Update compare/restore helpers to treat ContentDoc as the canonical payload for post/wiki/chapter content.
- [ ] 6.4 Update authority tests so content locks block `ContentDoc.main` edits and no test depends on `post.body`.

## 7. Validation

- [ ] 7.1 Run package-level tests for `package/contract`, `package/server`, `package/history`, `package/api`, and affected `package/app` features.
- [ ] 7.2 Run `bun run check:convention`.
- [ ] 7.3 Run `bun run format:check`.
- [ ] 7.4 Run a local Meilisearch resync smoke test and verify `contentText` / `descriptionText` appear only in search documents.
- [ ] 7.5 Run a browser smoke test for post rendering, chapter detail rendering, wiki edit, and profile description rendering.
