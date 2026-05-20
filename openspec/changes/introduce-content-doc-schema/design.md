## Context

Primary post content is currently stored as `Post.body String?`, while post metadata and wiki-adjacent extensions are stored in `Post.extra Json?`. Unit descriptions are stored as `UnitTranslation.description String?`. This is sufficient for Markdown-only content, but it splits wiki structure across a body string, `extra`, and frontend conventions.

The history service already stores editorial payloads as slot-based JSON snapshots, and the search system already uses Meilisearch as the full-text search surface. The main design problem is therefore the canonical write model: Rezics needs one structured content document schema that can represent Markdown text, slots, layout, and cross-Unit references without turning `extra` into a shadow schema or forcing PostgreSQL to become the text-search store.

## Goals / Non-Goals

**Goals:**

- Define a shared `ContentDoc` contract for long-form editable content.
- Replace `Post.body` with `Post.content` as the canonical post/chapter/wiki content payload.
- Allow rich descriptions to use the same content document shape while keeping short summary/bio fields plain.
- Keep text projections such as `contentText` and `descriptionText` in Meilisearch documents, not PostgreSQL.
- Make cross-Unit slots explicit references that can be batch hydrated.
- Preserve history, authority, and rendering semantics through typed contracts.

**Non-Goals:**

- No CRDT, collaborative cursor, or block-level real-time editing model.
- No PostgreSQL JSON-path querying for content slots.
- No generic frontend plugin marketplace in this change.
- No persistence of rendered HTML.
- No backwards-compatible `body` API after the internal development cutover.

## Decisions

### Decision: `ContentDoc` is the canonical long-form schema

The contract package will expose a `contentDocSchema` shaped around a versioned document:

```json
{
  "schema": "rezics.content",
  "version": 1,
  "main": {
    "type": "markdown",
    "source": "..."
  },
  "slots": {},
  "layout": []
}
```

`schema` identifies the document family. `version` identifies storage-format semantics and is independent from Unit revision sequence or optimistic-concurrency versioning.

Rationale:

- History snapshots remain interpretable after future schema evolution.
- The renderer can reject unsupported schemas or versions with a controlled fallback.
- Markdown remains the first content block type without making the top-level field name Markdown-specific.

Alternatives considered:

- `md_content` top-level key: rejected because it bakes the initial renderer into the storage model.
- Versionless JSON: rejected because archived history payloads would require shape guessing during migration.
- Fully normalized block rows: deferred until edit frequency or partial-update requirements justify the complexity.

### Decision: `Post.body` is removed instead of retained as compatibility

Because the project is still in development, `Post.body` should be removed during the cutover. Existing development rows are migrated into `Post.content.main.source` with `type = "markdown"`.

Rationale:

- A dual `body` + `content` model would create drift and permanent mapper ambiguity.
- Internal callsites can be cut over in one change.
- Text projection remains available through Meilisearch, so keeping `body` as a cache column is unnecessary.

Alternatives considered:

- Keep `body` as a PostgreSQL projection: rejected by project direction; search and text projection belong in Meilisearch.
- Keep `body` temporarily: rejected unless implementation discovers an unsafe migration blocker.

### Decision: Description uses the same schema only when rich content is needed

Short `summary` and compact `bio` fields remain strings. Rich long descriptions use `ContentDoc` through a dedicated description content field, not by overloading summary or extra fields.

Rationale:

- Summary and bio are compact identity fields used in cards and lists.
- Description can benefit from Markdown, slots, and unit references.
- Reusing `ContentDoc` keeps rendering and projection consistent without flattening all text semantics into one storage location.

### Decision: Text projection is Meilisearch-owned

`contentText` and `descriptionText` are derived during sync/full reindex and stored in Meilisearch documents. PostgreSQL stores only canonical content JSON and other typed product fields.

Rationale:

- The user-facing search system is Meilisearch, not PostgreSQL text search.
- PostgreSQL avoids duplicate derived text columns and cache invalidation work.
- Reindex can recompute projections from canonical content and referenced Units.

Alternatives considered:

- Store `contentText` in PostgreSQL for preview/read speed: rejected for this change. If non-search product surfaces later need fast text previews without loading content JSON, a follow-up can add a deliberate projection column.

### Decision: Slots store references, not hydrated snapshots

Slots may contain unit references such as:

```json
{
  "type": "unit-ref",
  "unitId": "...",
  "unitType": "BOOK",
  "view": "card"
}
```

Renderers and API clients scan a content document for refs, batch hydrate the referenced Units, and render unavailable targets through restricted/deleted placeholders.

Rationale:

- Referenced Unit titles, covers, permissions, and visibility remain authoritative in their own Unit records.
- Slot payloads stay small and history snapshots avoid denormalized display drift.
- This aligns with the existing Unit graph and future Api Unit Store direction.

Alternatives considered:

- Embed full referenced Unit DTOs into content: rejected due to stale snapshots, permission leakage, and storage bloat.
- One request per slot: rejected because it creates obvious N+1 behavior. Hydration must be batched.

### Decision: Layout is semantic, not pixel-level styling

`layout` records semantic placement such as main/aside/after-main regions and slot ids. It must not store arbitrary CSS, pixel coordinates, or product-specific visual skins.

Rationale:

- The design system and renderer own presentation.
- Stored content stays portable across web, mobile, search snippets, and history views.

### Decision: Authority moves from `post.body` to content keys

The field-key vocabulary should replace `post.body` with content document keys such as `content.main`, `content.slots`, or a whole-content key. Slot-level locking can be introduced where product UI supports it; whole-content locking remains the fallback.

Rationale:

- The old field key names a removed column.
- Slot-level locks match the wiki mental model without requiring full block-level authorization.

## Risks / Trade-offs

- [Risk] Large JSON updates rewrite the full `content` value. -> Mitigation: phase 1 uses whole-document replace because wiki edits are low-frequency; slot-level patch operations can be added later without changing the stored schema.
- [Risk] Renderers encounter unsupported versions. -> Mitigation: require `schema` and `version`; render unsupported documents with a safe fallback and validation error state.
- [Risk] Slot references create N+1 API calls. -> Mitigation: require ref scanning and batch hydration before rendering rich slot surfaces.
- [Risk] Search text extraction misses plugin content. -> Mitigation: every slot/content block type must define an extractor contribution before it is accepted into the schema.
- [Risk] Content JSON becomes accidental product metadata. -> Mitigation: specs state PostgreSQL product filtering must use typed columns/relations; Meilisearch projection may include descriptive content for full-text search only.
- [Risk] Removing `body` breaks broad callsites. -> Mitigation: this is a development-stage clear cutover; update contract, server mappers, app components, tests, history, and sync code in the same change.

## Migration Plan

1. Add `ContentDoc` schemas and extractor helpers to `package/contract`.
2. Add canonical content JSON columns for posts and rich descriptions.
3. Migrate existing development `Post.body` values into Markdown `ContentDoc.main`.
4. Remove `Post.body` from Prisma, contract DTOs, APIs, mappers, and app callsites.
5. Update chapter and wiki editors/renderers to read and write `ContentDoc`.
6. Update Meilisearch sync to derive `contentText` and `descriptionText` from content docs and referenced Unit display data.
7. Update history outbox payloads and history UI handling for content document snapshots.
8. Update field-key constants and lock checks for content document edits.
9. Run Prisma generation, affected package tests, convention checks, and full reindex smoke tests.

Rollback strategy:

- Before production data exists, rollback is a reverse migration to recreate `body` from `content.main.source`.
- After any durable environment adopts the schema, rollback should preserve `content` and only reintroduce compatibility reads if necessary.

## Open Questions

- Should phase 1 expose slot-level patch APIs, or only whole-document replace with optimistic `updatedAt` checks?
- Should rich `UnitTranslation.description` replace the string field or live in a new `descriptionContent` field while the old string is removed in the same cutover?
- Which exact content field keys should be first-class: `content`, `content.main`, `content.slots`, and/or per-slot ids?
